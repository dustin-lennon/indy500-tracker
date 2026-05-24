import React, { useState } from 'react';
import type { RaceEvent } from '../types';

interface SpotterLogProps {
  events: RaceEvent[];
}

export const SpotterLog: React.FC<SpotterLogProps> = ({ events }) => {
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    return localStorage.getItem('spotter_muted') === 'true';
  });

  const toggleMute = () => {
    const newMuteState = !isMuted;
    setIsMuted(newMuteState);
    localStorage.setItem('spotter_muted', String(newMuteState));
  };

  const getEventBadgeColor = (type: RaceEvent['type']): string => {
    switch (type) {
      case 'green': return 'var(--flag-green)';
      case 'yellow': case 'crash': return 'var(--flag-yellow)';
      case 'red': return 'var(--flag-red)';
      case 'white': return '#e2e8f0';
      case 'checkered': return '#ffffff';
      case 'pit': return 'var(--cyan-accent)';
      case 'lead_change': return '#ff8f00';
      default: return 'var(--text-muted)';
    }
  };

  return (
    <div className="spotter-log-container glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
      {/* Header with audio toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="terminal-dot" />
          <h3 style={{ fontSize: '15px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Audio Spotter Feed</h3>
        </div>
        <button 
          className={`spotter-audio-btn ${isMuted ? 'muted' : ''}`} 
          onClick={toggleMute}
          title={isMuted ? 'Unmute Audio Spotter' : 'Mute Audio Spotter'}
        >
          {isMuted ? '🔇 SPOTTER OFF' : '🔊 SPOTTER ON'}
        </button>
      </div>

      {/* Chronological Event feed */}
      <div className="event-feed-list">
        {events.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '12px' }}>
            <span>Awaiting telemetry feed...</span>
          </div>
        ) : (
          events.map((event, idx) => {
            const isLatest = idx === 0;
            return (
              <div 
                key={event.id} 
                className={`event-feed-row ${isLatest ? 'spotter-alert' : ''}`}
                style={{
                  borderLeft: `3px solid ${getEventBadgeColor(event.type)}`
                }}
              >
                <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline', marginBottom: '2px' }}>
                  <span className="event-time font-mono">{event.time}</span>
                  <span className="event-lap font-mono">LAP {event.lap}</span>
                  <span 
                    className="event-badge font-mono" 
                    style={{ 
                      color: getEventBadgeColor(event.type),
                      borderColor: `${getEventBadgeColor(event.type)}33`
                    }}
                  >
                    {event.type.replace('_', ' ')}
                  </span>
                </div>
                <p className="event-msg">{event.message}</p>
              </div>
            );
          })
        )}
      </div>

      <style>{`
        .terminal-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: var(--accent);
          box-shadow: 0 0 8px var(--accent);
          display: inline-block;
          animation: blink 1.2s infinite;
        }
        @keyframes blink {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        
        .spotter-audio-btn {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          color: var(--text-secondary);
          padding: 4px 10px;
          font-size: 10px;
          font-weight: 700;
          border-radius: 4px;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .spotter-audio-btn:hover {
          background: rgba(255,255,255,0.08);
          color: #fff;
        }
        .spotter-audio-btn.muted {
          background: rgba(255, 23, 68, 0.05);
          border-color: rgba(255, 23, 68, 0.2);
          color: var(--flag-red);
        }
        .spotter-audio-btn.muted:hover {
          background: rgba(255, 23, 68, 0.15);
        }

        .event-feed-list {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding-right: 4px;
        }

        .event-feed-row {
          background: rgba(0,0,0,0.15);
          padding: 8px 12px;
          border-radius: 0 4px 4px 0;
          font-size: 12px;
          transition: background 0.3s ease;
        }

        .event-time {
          color: var(--text-muted);
          font-size: 10px;
        }
        
        .event-lap {
          color: var(--cyan-accent);
          font-size: 10px;
          font-weight: 700;
        }

        .event-badge {
          font-size: 9px;
          text-transform: uppercase;
          font-weight: 700;
          border: 1px solid;
          padding: 0px 4px;
          border-radius: 3px;
          letter-spacing: 0.05em;
          background: rgba(0,0,0,0.2);
        }

        .event-msg {
          color: var(--text-primary);
          line-height: 1.4;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
};
