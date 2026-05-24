import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Driver, RaceFlag } from '../types';

interface LiveBlogSyncProps {
  drivers: Driver[];
  mode: string;
  syncSetFlag: (flag: RaceFlag, reason?: string) => void;
  syncSetLap: (lap: number) => void;
  syncOrderPitStop: (driverId: string) => void;
  syncRetireDriver: (driverId: string, reason: string) => void;
}

interface BlogPost {
  id: string; // Composite key of datePublished + headline
  headline: string;
  articleBody: string;
  datePublished: string;
}

const DRIVER_VOICE_VARIANTS: Record<string, string[]> = {
  '1': ['palou', 'pah lou', 'pilou', 'blue', 'plow', 'palo'],
  '2': ['rossi', 'rosy', 'rossy'],
  '3': ['malukas', 'maloukas', 'luca', 'lucas'],
  '4': ['rosenqvist', 'rosenquist', 'rosen'],
  '5': ['ferrucci', 'ferruchi', 'santino'],
  '6': ['o\'ward', 'oward', 'o ward', 'award', 'howard', 'pato'],
  '7': ['simpson', 'kyffin'],
  '8': ['daly', 'daily', 'dailey', 'conor'],
  '9': ['mclaughlin', 'maclaughlin', 'mcloughlin', 'mclaughlen'],
  '10': ['dixon', 'dickson', 'nixon'],
  '11': ['veekay', 'v kay', 'vkey', 'rinus'],
  '12': ['sato', 'satto', 'saddo', 'takuma'],
  '13': ['carpenter'],
  '14': ['castroneves', 'castronevis', 'helio'],
  '15': ['rasmussen'],
  '16': ['armstrong'],
  '17': ['ericsson', 'ericson', 'ericssen'],
  '18': ['lundgaard', 'lundgard', 'lungard'],
  '19': ['power', 'bower'],
  '20': ['siegel', 'seigel', 'segal'],
  '21': ['foster'],
  '22': ['hunter-reay', 'hunter reay', 'hunter'],
  '23': ['newgarden', 'new garden', 'guardian'],
  '24': ['grosjean', 'grojean', 'gros jean'],
  '25': ['schumacher', 'shoemaker'],
  '26': ['herta', 'hurta', 'hurter'],
  '27': ['kirkwood'],
  '28': ['rahal', 'rayhal', 'rahall'],
  '29': ['fittipaldi'],
  '30': ['robb', 'sting ray', 'stingray'],
  '31': ['legge', 'leg'],
  '32': ['collet', 'colet', 'caio'],
  '33': ['harvey']
};

export const LiveBlogSync: React.FC<LiveBlogSyncProps> = ({
  drivers,
  mode,
  syncSetFlag,
  syncSetLap,
  syncOrderPitStop,
  syncRetireDriver,
}) => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isAutoSync, setIsAutoSync] = useState<boolean>(false);
  const [syncedPostIds, setSyncedPostIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('synced_posts');
    return saved ? JSON.parse(saved) : [];
  });
  const [logs, setLogs] = useState<{ time: string; msg: string }[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const syncedPostIdsRef = useRef(syncedPostIds);
  useEffect(() => {
    syncedPostIdsRef.current = syncedPostIds;
    localStorage.setItem('synced_posts', JSON.stringify(syncedPostIds));
  }, [syncedPostIds]);

  const addLog = useCallback((msg: string) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [{ time: timeStr, msg }, ...prev].slice(0, 50));
  }, []);

  const driversRef = useRef(drivers);
  useEffect(() => {
    driversRef.current = drivers;
  }, [drivers]);

  // Unified parser helper
  const parseAndApplyPost = useCallback((post: BlogPost): string[] => {
    const applied: string[] = [];
    const text = (post.headline + ' ' + post.articleBody).toLowerCase();

    // 1. Lap parsing (regex check for "lap 45" or similar)
    const lapMatch = text.match(/\blap\s+(\d+)\b/);
    if (lapMatch) {
      const lapNum = parseInt(lapMatch[1], 10);
      if (lapNum >= 0 && lapNum <= 200) {
        syncSetLap(lapNum);
        applied.push(`Synced lap to ${lapNum}`);
      }
    }

    // 2. Flag parsing
    if (text.includes('green flag') || text.includes('racing resumes') || text.includes('racing again') || text.includes('restart')) {
      syncSetFlag('green');
      applied.push('Synced flag to GREEN');
    } else if (text.includes('red flag') || text.includes('race is stopped') || text.includes('stopped the race') || text.includes('red-flagged')) {
      syncSetFlag('red');
      applied.push('Synced flag to RED');
    } else if (text.includes('yellow flag') || text.includes('caution') || text.includes('safety car') || text.includes('pace car') || text.includes('first crash') || text.includes('crashed') || text.includes('spun out') || text.includes('spin')) {
      let reason = 'Caution flag synced from live updates';
      if (text.includes('crash') || text.includes('accident') || text.includes('wall') || text.includes('hit')) {
        reason = 'Caution: Incident reported on track';
      } else if (text.includes('debris')) {
        reason = 'Caution: Debris reported on track';
      } else if (text.includes('spin') || text.includes('spun')) {
        reason = 'Caution: Spin reported on track';
      }
      syncSetFlag('yellow', reason);
      applied.push(`Synced flag to YELLOW (${reason})`);
    } else if (text.includes('white flag') || text.includes('final lap') || text.includes('one lap to go') || text.includes('last lap')) {
      syncSetFlag('white');
      applied.push('Synced flag to WHITE');
    } else if (text.includes('checkered flag') || text.includes('wins the race') || text.includes('winner crossing') || text.includes('crosses the line')) {
      syncSetFlag('checkered');
      applied.push('Synced flag to CHECKERED');
    }

    // 3. Driver pitting & retirement parsing
    for (const d of driversRef.current) {
      const lastName = d.name.split(' ').pop()?.toLowerCase() || '';
      const fullName = d.name.toLowerCase();
      const customVariants = DRIVER_VOICE_VARIANTS[d.id] || [];
      
      const isMentioned = text.includes(lastName) || 
                          text.includes(fullName) || 
                          customVariants.some(v => text.includes(v)) ||
                          text.includes(`car #${d.carNumber}`) ||
                          text.includes(`car ${d.carNumber}`);

      if (isMentioned) {
        const pitWords = ['pit', 'pits', 'pitting', 'pit road', 'pit lane', 'box box', 'service', 'stops'];
        const retireWords = [
          'crash', 'crashed', 'retired', 'out of the race', 'over', 'hits the wall', 'hit the wall', 
          'blown engine', 'engine failure', 'mechanical issue', 'garage', 'broken down', 'out'
        ];

        const isRetiring = retireWords.some(w => text.includes(w));
        const isPitting = pitWords.some(w => text.includes(w)) && !isRetiring;

        if (isRetiring && d.status === 'running') {
          let reason = 'Retired (via Live Updates)';
          if (text.includes('engine') || text.includes('blowout') || text.includes('smoke')) {
            reason = 'Engine failure';
          } else if (text.includes('wall') || text.includes('crash') || text.includes('crashed') || text.includes('wreck') || text.includes('contact')) {
            reason = 'Accident';
          }
          syncRetireDriver(d.id, reason);
          applied.push(`Retired: ${d.name} (${reason})`);
        } else if (isPitting && d.status === 'running') {
          syncOrderPitStop(d.id);
          applied.push(`Pitted: ${d.name}`);
        }
      }
    }

    return applied;
  }, [syncSetFlag, syncSetLap, syncOrderPitStop, syncRetireDriver]);

  const fetchLiveBlog = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/live-blog');
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: Failed to reach Vite blog proxy.`);
      }
      const htmlText = await response.text();
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');
      const scriptTag = doc.getElementById('jsonData');
      
      if (!scriptTag || !scriptTag.textContent) {
        throw new Error('Could not find live blog data schema in response page.');
      }

      const schema = JSON.parse(scriptTag.textContent);
      const updates = schema.liveBlogUpdate || [];

      const formattedPosts: BlogPost[] = updates.map((p: any) => {
        const id = `${p.datePublished}_${p.headline}`.replace(/[^a-zA-Z0-9]/g, '_');
        return {
          id,
          headline: p.headline || 'Update',
          articleBody: p.articleBody || '',
          datePublished: p.datePublished || new Date().toISOString()
        };
      });

      // Sort newest first
      formattedPosts.sort((a, b) => new Date(b.datePublished).getTime() - new Date(a.datePublished).getTime());

      setPosts(formattedPosts);

      // Auto-Sync logic for newly fetched posts
      if (isAutoSync && formattedPosts.length > 0) {
        // Take the latest post
        const latestPost = formattedPosts[0];
        const alreadySynced = syncedPostIdsRef.current.includes(latestPost.id);

        if (!alreadySynced) {
          const actions = parseAndApplyPost(latestPost);
          setSyncedPostIds(prev => [...prev, latestPost.id]);
          if (actions.length > 0) {
            addLog(`Auto-Synced latest post: "${latestPost.headline}" - [${actions.join(', ')}]`);
          } else {
            addLog(`Skipped auto-sync: "${latestPost.headline}" (no actionable updates detected)`);
          }
        }
      }
    } catch (err: any) {
      console.error('Error fetching live blog updates:', err);
      setError(err.message || 'Unknown network error.');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [isAutoSync, parseAndApplyPost, addLog]);

  const handleManualApply = (post: BlogPost) => {
    const actions = parseAndApplyPost(post);
    setSyncedPostIds(prev => {
      if (prev.includes(post.id)) return prev;
      return [...prev, post.id];
    });
    if (actions.length > 0) {
      addLog(`Manually Synced: "${post.headline}" - [${actions.join(', ')}]`);
    } else {
      addLog(`Manually Scanned: "${post.headline}" (no actionable updates detected)`);
    }
  };

  const handleFastForwardAll = () => {
    if (posts.length === 0) return;
    const chronological = [...posts].sort((a, b) => new Date(a.datePublished).getTime() - new Date(b.datePublished).getTime());
    let appliedCount = 0;
    const newSyncedIds: string[] = [];
    
    chronological.forEach(post => {
      const actions = parseAndApplyPost(post);
      newSyncedIds.push(post.id);
      if (actions.length > 0) {
        appliedCount += actions.length;
      }
    });
    
    setSyncedPostIds(newSyncedIds);
    addLog(`Fast-forward: Replayed ${posts.length} blog updates chronologically (${appliedCount} actions applied).`);
  };

  // Poll intervals
  useEffect(() => {
    fetchLiveBlog(); // initial fetch

    const interval = setInterval(() => {
      fetchLiveBlog(true); // silent fetch every 20 seconds
    }, 20000);

    return () => clearInterval(interval);
  }, [fetchLiveBlog]);

  const formatPostTime = (isoString: string): string => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch (e) {
      return '--:--';
    }
  };

  return (
    <div className="live-blog-sync glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, padding: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', marginBottom: '8px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>📰</span> FOX Sports Live Updates
        </h3>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {mode === 'live' && posts.length > 0 && (
            <button 
              type="button"
              className="reset-btn" 
              onClick={handleFastForwardAll}
              style={{ fontSize: '9px', padding: '3px 6px', borderColor: 'var(--cyan-accent)', color: 'var(--cyan-accent)' }}
            >
              ⏩ Replay Blog History
            </button>
          )}
          <button 
            type="button"
            className="reset-btn" 
            onClick={() => fetchLiveBlog()} 
            disabled={isLoading}
            style={{ fontSize: '9px', padding: '3px 6px' }}
          >
            {isLoading ? 'Refreshing...' : '🔄 Refresh Feed'}
          </button>
        </div>
      </div>

      {/* Sync settings */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 77, 0, 0.03)', border: '1px solid rgba(255, 77, 0, 0.12)', borderRadius: '4px', padding: '6px 8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '10px', color: '#ccc', fontWeight: '600' }}>Auto-Sync Standings/Flags from Blog</span>
        <button
          type="button"
          onClick={() => {
            setIsAutoSync(!isAutoSync);
            addLog(`Auto-Sync toggled ${!isAutoSync ? 'ON' : 'OFF'}`);
          }}
          disabled={mode !== 'live'}
          style={{
            background: isAutoSync ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
            color: '#fff',
            border: 'none',
            borderRadius: '3px',
            padding: '2px 8px',
            fontSize: '9px',
            fontWeight: '700',
            cursor: mode === 'live' ? 'pointer' : 'not-allowed',
            textTransform: 'uppercase',
            opacity: mode === 'live' ? 1 : 0.4
          }}
        >
          {isAutoSync ? 'ACTIVE' : 'OFF'}
        </button>
      </div>

      {mode !== 'live' && (
        <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textAlign: 'center', fontStyle: 'italic' }}>
          ⚠️ Enable "Broadcast Sync" mode in the Control Panel to sync the blog with the race.
        </span>
      )}

      {error && (
        <div style={{ padding: '6px', borderRadius: '4px', background: 'rgba(255,23,68,0.08)', border: '1px solid rgba(255,23,68,0.2)', color: '#ff8a80', fontSize: '10px', marginBottom: '8px' }}>
          Proxy Error: {error}
        </div>
      )}

      {/* Posts List container */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '160px', paddingRight: '2px' }}>
        {posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '11px' }}>
            {isLoading ? 'Scraping latest articles...' : 'No blog updates found.'}
          </div>
        ) : (
          posts.map(post => {
            const isSynced = syncedPostIds.includes(post.id);
            return (
              <div 
                key={post.id} 
                style={{ 
                  padding: '8px', 
                  borderRadius: '5px', 
                  background: isSynced ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.03)', 
                  border: isSynced ? '1px solid rgba(255,255,255,0.04)' : '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '9.5px', color: '#ffcc80', fontWeight: '700', fontFamily: 'var(--font-mono)' }}>
                    [{formatPostTime(post.datePublished)}]
                  </span>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <span style={{ 
                      fontSize: '8px', 
                      fontWeight: '800', 
                      textTransform: 'uppercase', 
                      padding: '1.5px 4px', 
                      borderRadius: '3px',
                      background: isSynced ? 'rgba(76, 175, 80, 0.12)' : 'rgba(255,255,255,0.06)',
                      color: isSynced ? '#a5d6a7' : '#888',
                      border: isSynced ? '1px solid rgba(76, 175, 80, 0.2)' : '1px solid rgba(255,255,255,0.05)'
                    }}>
                      {isSynced ? 'Synced' : 'Pending'}
                    </span>
                    {mode === 'live' && !isSynced && (
                      <button
                        type="button"
                        onClick={() => handleManualApply(post)}
                        style={{
                          background: 'rgba(0, 229, 255, 0.1)',
                          border: '1px solid rgba(0, 229, 255, 0.2)',
                          borderRadius: '3px',
                          color: 'var(--cyan-accent)',
                          padding: '1px 5px',
                          fontSize: '8px',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          cursor: 'pointer'
                        }}
                      >
                        Apply
                      </button>
                    )}
                  </div>
                </div>
                <h4 style={{ fontSize: '11px', fontWeight: '700', margin: 0, color: '#fff' }}>{post.headline}</h4>
                <p style={{ fontSize: '10px', color: '#aaa', margin: 0, lineHeight: '1.3' }}>{post.articleBody}</p>
              </div>
            );
          })
        )}
      </div>

      {/* Sync Log Feed */}
      <div style={{ marginTop: '8px', borderTop: '1px dashed rgba(255, 77, 0, 0.15)', paddingTop: '6px' }}>
        <label className="stat-label" style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Blog Sync Log</label>
        <div style={{
          marginTop: '3px',
          background: 'rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.03)',
          borderRadius: '4px',
          padding: '4px 6px',
          maxHeight: '65px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '3px'
        }}>
          {logs.length === 0 ? (
            <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center' }}>No sync events logged yet.</span>
          ) : (
            logs.map((log, index) => (
              <div key={index} style={{ display: 'flex', gap: '4px', fontSize: '9px', fontFamily: 'var(--font-mono)', lineHeight: '1.2' }}>
                <span style={{ color: 'var(--text-muted)' }}>[{log.time}]</span>
                <span style={{ color: '#ffcc80' }}>{log.msg}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
