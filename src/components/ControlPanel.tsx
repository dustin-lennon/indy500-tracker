import React, { useState } from 'react';
import type { RaceFlag, SimulationMode, Driver } from '../types';

interface ControlPanelProps {
  flag: RaceFlag;
  lap: number;
  mode: SimulationMode;
  isPlaying: boolean;
  speedMultiplier: number;
  drivers: Driver[];
  togglePlay: () => void;
  setSpeedMultiplier: (mult: number) => void;
  setMode: (mode: SimulationMode) => void;
  resetRace: () => void;
  syncSetFlag: (flag: RaceFlag, reason?: string) => void;
  syncSetLap: (lap: number) => void;
  syncOrderPitStop: (driverId: string) => void;
  syncRetireDriver: (driverId: string, reason: string) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  flag,
  lap,
  mode,
  isPlaying,
  speedMultiplier,
  drivers,
  togglePlay,
  setSpeedMultiplier,
  setMode,
  resetRace,
  syncSetFlag,
  syncSetLap,
  syncOrderPitStop,
  syncRetireDriver,
}) => {
  const [syncLapVal, setSyncLapVal] = useState<number>(lap);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [retireReason, setRetireReason] = useState<string>('Crash Turn 2');
  const [cautionReasonInput, setCautionReasonInput] = useState<string>('');

  const activeDrivers = drivers.filter((d) => d.status === 'running');

  const handleLapSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (syncLapVal >= 0 && syncLapVal <= 200) {
      syncSetLap(syncLapVal);
    }
  };

  const handleRetire = () => {
    if (selectedDriverId) {
      syncRetireDriver(selectedDriverId, retireReason);
    }
  };

  const handlePit = () => {
    if (selectedDriverId) {
      syncOrderPitStop(selectedDriverId);
    }
  };

  const handleYellowTrigger = () => {
    const reason = cautionReasonInput.trim() || 'YELLOW FLAG! Incident reported on track.';
    syncSetFlag('yellow', reason);
    setCautionReasonInput('');
  };

  return (
    <div className="control-panel glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Race Control Deck</h3>
        <button className="reset-btn" onClick={resetRace}>Reset Race</button>
      </div>

      {/* Primary Deck Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label className="stat-label">Simulator Mode</label>
          <div className="mode-select-group">
            <button className={`mode-btn ${mode === 'scripted' ? 'active' : ''}`} onClick={() => setMode('scripted')}>Scripted</button>
            <button className={`mode-btn ${mode === 'sandbox' ? 'active' : ''}`} onClick={() => setMode('sandbox')}>Sandbox</button>
            <button className={`mode-btn ${mode === 'live' ? 'active' : ''}`} onClick={() => setMode('live')}>Broadcast Sync</button>
          </div>
        </div>

        <div>
          <label className="stat-label">Playback Controls</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className={`play-btn ${isPlaying ? 'playing' : ''}`} 
              onClick={togglePlay}
              style={{
                borderColor: flag === 'red' ? 'var(--flag-red)' : flag === 'yellow' ? 'var(--flag-yellow)' : 'var(--flag-green)'
              }}
            >
              {isPlaying ? 'PAUSE' : 'START SIM'}
            </button>
            
            <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
              {[1, 5, 25, 100].map((mult) => (
                <button 
                  key={mult} 
                  className={`mult-btn ${speedMultiplier === mult ? 'active' : ''}`}
                  onClick={() => setSpeedMultiplier(mult)}
                  disabled={mode === 'live'}
                >
                  {mult}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Broadcast Sync Panel - ONLY visible in Live Mode */}
      {mode === 'live' && (
        <div className="live-sync-deck fade-in" style={{ backgroundColor: 'rgba(255,77,0,0.02)', border: '1px solid rgba(255,77,0,0.15)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span className="live-badge">Broadcast Sync Active</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sync tracker with TV feed</span>
          </div>

          {/* 1. Flag Overrides */}
          <div style={{ marginBottom: '16px' }}>
            <label className="stat-label">Manual Flag Control</label>
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
              <button className="flag-override-btn green" onClick={() => syncSetFlag('green')}>Green</button>
              <button className="flag-override-btn red" onClick={() => syncSetFlag('red')}>Red</button>
              <button className="flag-override-btn white" onClick={() => syncSetFlag('white')}>White</button>
              <button className="flag-override-btn checkered" onClick={() => syncSetFlag('checkered')}>Checkered</button>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <input 
                type="text" 
                placeholder="Reason for yellow flag (e.g. Spin Turn 4)..." 
                value={cautionReasonInput} 
                onChange={(e) => setCautionReasonInput(e.target.value)}
                style={{ flex: 1, padding: '6px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: '12px' }}
              />
              <button className="flag-override-btn yellow" onClick={handleYellowTrigger}>Trigger Caution</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '16px' }}>
            {/* 2. Lap Sync */}
            <form onSubmit={handleLapSubmit}>
              <label className="stat-label">Sync Current Lap</label>
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <input 
                  type="number" 
                  min="0" 
                  max="200"
                  value={syncLapVal}
                  onChange={(e) => setSyncLapVal(parseInt(e.target.value) || 0)}
                  style={{ width: '60px', padding: '6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: '#fff', textAlign: 'center', fontSize: '13px' }}
                />
                <button type="submit" className="sync-btn">Set Lap</button>
              </div>
            </form>

            {/* 3. Driver Live Control */}
            <div>
              <label className="stat-label">Driver Incident Controller</label>
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <select 
                  value={selectedDriverId} 
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: '#121218', color: '#fff', fontSize: '12px' }}
                >
                  <option value="">Select Driver...</option>
                  {activeDrivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      #{d.carNumber} - {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedDriverId && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                  <button className="sync-driver-action pit" onClick={handlePit}>Force Pit Stop</button>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <select 
                      value={retireReason}
                      onChange={(e) => setRetireReason(e.target.value)}
                      style={{ padding: '4px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: '#121218', color: '#fff', fontSize: '11px', flex: 1 }}
                    >
                      <option value="Crash Turn 1">Crash Turn 1</option>
                      <option value="Crash Turn 2">Crash Turn 2</option>
                      <option value="Crash Turn 3">Crash Turn 3</option>
                      <option value="Crash Turn 4">Crash Turn 4</option>
                      <option value="Crash Front Stretch">Crash Front Stretch</option>
                      <option value="Crash Backstretch">Crash Backstretch</option>
                      <option value="Engine Blowout">Engine Blowout</option>
                      <option value="Gearbox Failure">Gearbox Failure</option>
                      <option value="Electrical Issue">Electrical Issue</option>
                    </select>
                    <button className="sync-driver-action retire" onClick={handleRetire}>Force Retire</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Control panel inline styles */}
      <style>{`
        .mode-select-group {
          display: flex;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 6px;
          padding: 3px;
          margin-top: 4px;
        }
        .mode-btn {
          flex: 1;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          padding: 6px 8px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          cursor: pointer;
          border-radius: 4px;
          transition: background var(--transition-fast), color var(--transition-fast);
        }
        .mode-btn:hover {
          color: #fff;
        }
        .mode-btn.active {
          background: var(--accent);
          color: #fff;
        }
        .play-btn {
          padding: 6px 14px;
          border-radius: 6px;
          border: 2px solid var(--flag-green);
          background: transparent;
          color: #fff;
          font-weight: 700;
          font-size: 11px;
          text-transform: uppercase;
          cursor: pointer;
          transition: all var(--transition-fast);
          min-width: 90px;
        }
        .play-btn:hover {
          background: rgba(255,255,255,0.05);
        }
        .play-btn.playing {
          background: rgba(255,255,255,0.03);
          animation: pulse-glow 2s infinite ease-in-out;
        }
        @keyframes pulse-glow {
          0%, 100% { border-color: rgba(255,255,255,0.2); }
          50% { border-color: var(--accent); }
        }
        .mult-btn {
          flex: 1;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06);
          color: var(--text-secondary);
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          border-radius: 4px;
          transition: all var(--transition-fast);
        }
        .mult-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .mult-btn.active:not(:disabled) {
          background: rgba(255,255,255,0.15);
          color: #fff;
          border-color: rgba(255,255,255,0.3);
        }
        .reset-btn {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: var(--text-secondary);
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 4px;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .reset-btn:hover {
          background: rgba(255, 23, 68, 0.1);
          border-color: rgba(255, 23, 68, 0.4);
          color: var(--flag-red);
        }
        .flag-override-btn {
          flex: 1;
          padding: 6px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all var(--transition-fast);
        }
        .flag-override-btn.green {
          background: rgba(0, 230, 118, 0.15);
          border-color: rgba(0, 230, 118, 0.3);
          color: var(--flag-green);
        }
        .flag-override-btn.green:hover { background: rgba(0, 230, 118, 0.3); }
        .flag-override-btn.yellow {
          background: rgba(255, 214, 0, 0.15);
          border-color: rgba(255, 214, 0, 0.3);
          color: var(--flag-yellow);
        }
        .flag-override-btn.yellow:hover { background: rgba(255, 214, 0, 0.3); }
        .flag-override-btn.red {
          background: rgba(255, 23, 68, 0.15);
          border-color: rgba(255, 23, 68, 0.3);
          color: var(--flag-red);
        }
        .flag-override-btn.red:hover { background: rgba(255, 23, 68, 0.3); }
        .flag-override-btn.white {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.3);
          color: var(--flag-white);
        }
        .flag-override-btn.white:hover { background: rgba(255, 255, 255, 0.2); }
        .flag-override-btn.checkered {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.2);
          color: #fff;
        }
        .flag-override-btn.checkered:hover { background: rgba(255, 255, 255, 0.15); }
        
        .sync-btn {
          background: var(--accent);
          border: none;
          color: #fff;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          cursor: pointer;
        }
        .sync-btn:hover {
          opacity: 0.9;
        }
        .sync-driver-action {
          border: 1px solid transparent;
          color: #fff;
          padding: 6px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          cursor: pointer;
          width: 100%;
          transition: all var(--transition-fast);
        }
        .sync-driver-action.pit {
          background: rgba(0, 229, 255, 0.15);
          border-color: rgba(0, 229, 255, 0.3);
          color: var(--cyan-accent);
        }
        .sync-driver-action.pit:hover { background: rgba(0, 229, 255, 0.3); }
        
        .sync-driver-action.retire {
          background: rgba(255, 23, 68, 0.15);
          border-color: rgba(255, 23, 68, 0.3);
          color: var(--flag-red);
          flex: 1;
        }
        .sync-driver-action.retire:hover { background: rgba(255, 23, 68, 0.3); }
      `}</style>
    </div>
  );
};
