import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Driver, RaceFlag } from '../types';

interface LiveBlogSyncProps {
  drivers: Driver[];
  mode: string;
  syncSetFlag: (flag: RaceFlag, reason?: string) => void;
  syncSetLap: (lap: number) => void;
  syncOrderPitStop: (driverId: string) => void;
  syncRetireDriver: (driverId: string, reason: string) => void;
  syncSetBulkPositions: (orderedCarNumbers: string[], retiredCarNumbers?: string[]) => void;
}

interface BlogPost {
  id: string; // Composite key of datePublished + headline
  headline: string;
  articleBody: string;
  datePublished: string;
}

interface RacetraxDriver {
  rank: number;
  name: string;
  carNumber: string;
  isOut: boolean;
  matchedLocalDriver?: Driver;
}

export const LiveBlogSync: React.FC<LiveBlogSyncProps> = ({
  drivers,
  mode,
  syncSetFlag,
  syncSetLap,
  syncOrderPitStop,
  syncRetireDriver,
  syncSetBulkPositions,
}) => {
  // Feed tabs
  const [subTab, setSubTab] = useState<'standings' | 'blog'>('standings');

  // Live Blog states
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isAutoSync, setIsAutoSync] = useState<boolean>(false);
  const [syncedPostIds, setSyncedPostIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('synced_posts');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Racetrax Leaderboard states
  const [racetraxStandings, setRacetraxStandings] = useState<RacetraxDriver[]>([]);
  const [isAutoRacetraxSync, setIsAutoRacetraxSync] = useState<boolean>(false);
  const [isRacetraxLoading, setIsRacetraxLoading] = useState<boolean>(false);
  const [racetraxError, setRacetraxError] = useState<string | null>(null);

  // Common UI states
  const [logs, setLogs] = useState<{ time: string; msg: string }[]>([]);
  const [isBlogLoading, setIsBlogLoading] = useState<boolean>(false);
  const [blogError, setBlogError] = useState<string | null>(null);

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

  // ---- SCRAPER PARSER HEURISTICS FOR LIVE BLOG ----
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

    // 3. Driver pitting & retirement parsing (using phonetics or exact last name)
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

  // ---- LIVE BLOG FETCHING ----
  const fetchLiveBlog = useCallback(async (silent = false) => {
    if (!silent) setIsBlogLoading(true);
    setBlogError(null);
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
        const latestPost = formattedPosts[0];
        const alreadySynced = syncedPostIdsRef.current.includes(latestPost.id);

        if (!alreadySynced) {
          const actions = parseAndApplyPost(latestPost);
          setSyncedPostIds(prev => [...prev, latestPost.id]);
          if (actions.length > 0) {
            addLog(`Auto-Synced latest post: "${latestPost.headline}" - [${actions.join(', ')}]`);
          } else {
            addLog(`Skipped auto-sync: "${latestPost.headline}" (no updates)`);
          }
        }
      }
    } catch (err: any) {
      console.error('Error fetching live blog updates:', err);
      setBlogError(err.message || 'Unknown network error.');
    } finally {
      if (!silent) setIsBlogLoading(false);
    }
  }, [isAutoSync, parseAndApplyPost, addLog]);

  // ---- RACETRAX LEADERBOARD FETCHING ----
  const fetchRacetrax = useCallback(async (silent = false) => {
    if (!silent) setIsRacetraxLoading(true);
    setRacetraxError(null);
    try {
      const response = await fetch('/api/racetrax');
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: Failed to reach Racetrax proxy.`);
      }
      const pageData = await response.json();
      
      if (!pageData || !pageData.leaderboard || !pageData.leaderboard.leaderboardSections) {
        throw new Error('API data structure does not contain expected event or leaderboard elements.');
      }

      const sections = pageData.leaderboard.leaderboardSections || [];
      const raceSection = sections.find((s: any) => s.parameters && s.parameters.leaderboardId === 'race');
      
      if (!raceSection || !raceSection.leaderboard || !raceSection.leaderboard[0] || !raceSection.leaderboard[0].eventStats || !raceSection.leaderboard[0].eventStats.rows) {
        throw new Error('Could not find the live RACE standings section in the API payload.');
      }

      const rows = raceSection.leaderboard[0].eventStats.rows;
      
      const parsed: RacetraxDriver[] = rows.map((r: any) => {
        const columns = r.columns || [];
        const rank = parseInt(columns[0]?.text || '0', 10);
        const rawName = columns[1]?.imageAltText || columns[1]?.text || 'Unknown';
        const name = rawName === 'Default Headshot' ? (columns[1]?.text || rawName) : rawName;
        const carStr = columns[1]?.superscript || ''; // e.g. "#4"
        const carNumber = carStr.replace('#', '').trim();
        const isOut = r.indicatorColor === '1, 51, 51, 51';
        
        // Find local driver match by last name
        const cleanName = name.toLowerCase().replace(/[^a-z\s]/g, ' ');
        const nameWords = cleanName.split(/\s+/).filter(Boolean);
        const matchedLocalDriver = driversRef.current.find(d => {
          const lastName = d.name.split(' ').pop()?.toLowerCase() || '';
          const localFullName = d.name.toLowerCase();
          return nameWords.includes(lastName) || localFullName.includes(nameWords[nameWords.length - 1]);
        });

        return {
          rank,
          name,
          carNumber,
          isOut,
          matchedLocalDriver
        };
      });

      setRacetraxStandings(parsed);

      // Auto-Sync logic
      if (isAutoRacetraxSync && parsed.length > 0) {
        const runningCarNumbers = parsed
          .filter(p => !p.isOut)
          .map(p => p.matchedLocalDriver?.carNumber)
          .filter(Boolean) as string[];
          
        const retiredCarNumbers = parsed
          .filter(p => p.isOut)
          .map(p => p.matchedLocalDriver?.carNumber)
          .filter(Boolean) as string[];
          
        if (runningCarNumbers.length > 0 || retiredCarNumbers.length > 0) {
          syncSetBulkPositions(runningCarNumbers, retiredCarNumbers);
          addLog(`Auto-Synced standings from FOX Racetrax (${runningCarNumbers.length} running, ${retiredCarNumbers.length} retired).`);
        }
      }

    } catch (err: any) {
      console.error('Error fetching Racetrax leaderboard:', err);
      setRacetraxError(err.message || 'Unknown network error.');
    } finally {
      if (!silent) setIsRacetraxLoading(false);
    }
  }, [isAutoRacetraxSync, syncSetBulkPositions, addLog]);

  // ---- MANUAL BULK STANDINGS APPLY ----
  const handleApplyRacetraxStandings = () => {
    if (racetraxStandings.length === 0) return;
    const runningCarNumbers = racetraxStandings
      .filter(p => !p.isOut)
      .map(p => p.matchedLocalDriver?.carNumber)
      .filter(Boolean) as string[];
      
    const retiredCarNumbers = racetraxStandings
      .filter(p => p.isOut)
      .map(p => p.matchedLocalDriver?.carNumber)
      .filter(Boolean) as string[];
      
    if (runningCarNumbers.length > 0 || retiredCarNumbers.length > 0) {
      syncSetBulkPositions(runningCarNumbers, retiredCarNumbers);
      addLog(`Manually Synced FOX Racetrax Standings (${runningCarNumbers.length} running, ${retiredCarNumbers.length} retired).`);
    } else {
      addLog(`No matching local drivers detected to sync standings.`);
    }
  };

  // ---- FAST-FORWARD ALL LIVE BLOG ENTRIES ----
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

  const handleManualApply = (post: BlogPost) => {
    const actions = parseAndApplyPost(post);
    setSyncedPostIds(prev => {
      if (prev.includes(post.id)) return prev;
      return [...prev, post.id];
    });
    if (actions.length > 0) {
      addLog(`Manually Synced: "${post.headline}" - [${actions.join(', ')}]`);
    } else {
      addLog(`Manually Scanned: "${post.headline}" (no updates)`);
    }
  };

  // Initial and Polling setup
  useEffect(() => {
    fetchLiveBlog();
    fetchRacetrax();

    const interval = setInterval(() => {
      fetchLiveBlog(true);
      fetchRacetrax(true);
    }, 25000); // Poll feeds every 25 seconds

    return () => clearInterval(interval);
  }, [fetchLiveBlog, fetchRacetrax]);

  const formatPostTime = (isoString: string): string => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch (e) {
      return '--:--';
    }
  };

  const activeLoading = subTab === 'standings' ? isRacetraxLoading : isBlogLoading;
  const activeError = subTab === 'standings' ? racetraxError : blogError;

  return (
    <div className="live-blog-sync glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, padding: '14px' }}>
      
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', marginBottom: '8px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>🏁</span> FOX Sports Racetrax Live Sync
        </h3>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button 
            type="button"
            className="reset-btn" 
            onClick={() => {
              if (subTab === 'standings') fetchRacetrax();
              else fetchLiveBlog();
            }} 
            disabled={activeLoading}
            style={{ fontSize: '9px', padding: '3px 6px' }}
          >
            {activeLoading ? 'Refreshing...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {/* Sub-Tabs Selector */}
      <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '6px', padding: '3px', marginBottom: '8px' }}>
        <button
          type="button"
          onClick={() => setSubTab('standings')}
          style={{
            flex: 1,
            padding: '5px 10px',
            border: 'none',
            borderRadius: '4px',
            background: subTab === 'standings' ? 'var(--cyan-accent)' : 'transparent',
            color: subTab === 'standings' ? '#000' : 'var(--text-secondary)',
            fontSize: '9.5px',
            fontWeight: '700',
            textTransform: 'uppercase',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          📊 Live Standings
        </button>
        <button
          type="button"
          onClick={() => setSubTab('blog')}
          style={{
            flex: 1,
            padding: '5px 10px',
            border: 'none',
            borderRadius: '4px',
            background: subTab === 'blog' ? 'var(--accent)' : 'transparent',
            color: subTab === 'blog' ? '#fff' : 'var(--text-secondary)',
            fontSize: '9.5px',
            fontWeight: '700',
            textTransform: 'uppercase',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          📰 Live Blog updates
        </button>
      </div>

      {/* Active Sync Settings Block */}
      {subTab === 'standings' ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0, 229, 255, 0.03)', border: '1px solid rgba(0, 229, 255, 0.12)', borderRadius: '4px', padding: '6px 8px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <span style={{ fontSize: '10px', color: '#ccc', fontWeight: '600' }}>Auto-Sync Standings Order</span>
            <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>Sets grid matching Fox Racetrax list</span>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {mode === 'live' && racetraxStandings.length > 0 && (
              <button
                type="button"
                className="reset-btn"
                onClick={handleApplyRacetraxStandings}
                style={{ fontSize: '9px', padding: '2px 6px', borderColor: 'var(--cyan-accent)', color: 'var(--cyan-accent)' }}
              >
                Apply Standings Now
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsAutoRacetraxSync(!isAutoRacetraxSync);
                addLog(`Auto-Standings Sync toggled ${!isAutoRacetraxSync ? 'ON' : 'OFF'}`);
              }}
              disabled={mode !== 'live'}
              style={{
                background: isAutoRacetraxSync ? 'var(--cyan-accent)' : 'rgba(255,255,255,0.08)',
                color: isAutoRacetraxSync ? '#000' : '#fff',
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
              {isAutoRacetraxSync ? 'ACTIVE' : 'OFF'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 77, 0, 0.03)', border: '1px solid rgba(255, 77, 0, 0.12)', borderRadius: '4px', padding: '6px 8px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <span style={{ fontSize: '10px', color: '#ccc', fontWeight: '600' }}>Auto-Sync Cautions/Laps from Blog</span>
            <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>Applies flags and pit stops from posts</span>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {mode === 'live' && posts.length > 0 && (
              <button
                type="button"
                className="reset-btn"
                onClick={handleFastForwardAll}
                style={{ fontSize: '9px', padding: '2px 6px', borderColor: 'var(--accent)', color: 'var(--accent)' }}
              >
                ⏩ Replay History
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsAutoSync(!isAutoSync);
                addLog(`Auto-Blog Sync toggled ${!isAutoSync ? 'ON' : 'OFF'}`);
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
        </div>
      )}

      {mode !== 'live' && (
        <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textAlign: 'center', fontStyle: 'italic' }}>
          ⚠️ Enable "Broadcast Sync" mode in the Control Panel to sync feeds with the race.
        </span>
      )}

      {activeError && (
        <div style={{ padding: '6px', borderRadius: '4px', background: 'rgba(255,23,68,0.08)', border: '1px solid rgba(255,23,68,0.2)', color: '#ff8a80', fontSize: '10px', marginBottom: '8px' }}>
          Feed Error: {activeError}
        </div>
      )}

      {/* Tab Panels */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '160px', paddingRight: '2px' }}>
        
        {/* TAB 1: STANDINGS LIST */}
        {subTab === 'standings' && (
          racetraxStandings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '11px' }}>
              {isRacetraxLoading ? 'Scraping live leaderboard...' : 'No Racetrax standings found.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {racetraxStandings.map((driver, index) => {
                const isMatched = !!driver.matchedLocalDriver;
                return (
                  <div
                    key={index}
                    style={{
                      padding: '5px 8px',
                      borderRadius: '4px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '11px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', width: '20px', fontWeight: '700' }}>
                        P{driver.rank}
                      </span>
                      <span style={{ color: '#fff', fontWeight: '600', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {driver.name}
                      </span>
                      <span style={{ fontSize: '9px', color: 'var(--cyan-accent)', background: 'rgba(0, 229, 255, 0.08)', padding: '1px 4px', borderRadius: '3px', fontFamily: 'var(--font-mono)' }}>
                        #{driver.carNumber || driver.matchedLocalDriver?.carNumber || '??'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {driver.isOut && (
                        <span style={{ fontSize: '8px', color: '#ff8a80', background: 'rgba(255, 23, 68, 0.12)', border: '1px solid rgba(255, 23, 68, 0.25)', padding: '1.5px 5px', borderRadius: '3px', fontWeight: '800' }}>
                          OUT
                        </span>
                      )}
                      {isMatched ? (
                        <span style={{ fontSize: '9px', color: '#a5d6a7', background: 'rgba(76, 175, 80, 0.08)', padding: '1.5px 5px', borderRadius: '3px', fontWeight: '700' }}>
                          ✓ Matched
                        </span>
                      ) : (
                        <span style={{ fontSize: '9px', color: '#ffcc80', background: 'rgba(255, 152, 0, 0.08)', padding: '1.5px 5px', borderRadius: '3px', fontWeight: '700' }}>
                          Unresolved
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* TAB 2: BLOG POSTS LIST */}
        {subTab === 'blog' && (
          posts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '11px' }}>
              {isBlogLoading ? 'Scraping latest updates...' : 'No blog updates found.'}
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
          )
        )}
      </div>

      {/* Sync Log Feed */}
      <div style={{ marginTop: '8px', borderTop: '1px dashed rgba(255, 77, 0, 0.15)', paddingTop: '6px' }}>
        <label className="stat-label" style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>FOX Sync Event Log</label>
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
