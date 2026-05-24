import React from 'react';
import type { Driver, SimulationMode } from '../types';

interface PositionInputProps {
  currentPos: number;
  maxPos: number;
  onPositionChange: (newPos: number) => void;
}

const PositionInput: React.FC<PositionInputProps> = ({ currentPos, maxPos, onPositionChange }) => {
  const [val, setVal] = React.useState<string>(String(currentPos));

  React.useEffect(() => {
    setVal(String(currentPos));
  }, [currentPos]);

  const handleSubmit = () => {
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= maxPos) {
      onPositionChange(parsed);
    } else {
      setVal(String(currentPos));
    }
  };

  return (
    <input
      type="text"
      pattern="[0-9]*"
      inputMode="numeric"
      value={val}
      onChange={(e) => setVal(e.target.value.replace(/\D/g, ''))}
      onBlur={handleSubmit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          handleSubmit();
          e.currentTarget.blur();
        }
      }}
      className="sync-pos-input"
      style={{
        width: '28px',
        height: '20px',
        background: 'rgba(0,0,0,0.4)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '3px',
        color: '#fff',
        textAlign: 'center',
        fontSize: '11px',
        fontFamily: 'var(--font-mono)',
        fontWeight: 'bold',
        outline: 'none',
        marginRight: '6px'
      }}
    />
  );
};

interface LeaderboardProps {
  drivers: Driver[];
  selectedDriverId: string | null;
  mode: SimulationMode;
  setSelectedDriverId: (id: string | null) => void;
  syncMoveDriver: (driverId: string, direction: 'up' | 'down') => void;
  syncSetDriverPosition: (driverId: string, newPosition: number) => void;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  drivers,
  selectedDriverId,
  mode,
  setSelectedDriverId,
  syncMoveDriver,
  syncSetDriverPosition,
}) => {
  // Leader is always first in the array since useRaceSimulation updates positions
  const leader = drivers[0];

  const calculateGap = (driver: Driver, index: number): string => {
    if (driver.status === 'out') return 'OUT';
    if (index === 0) return 'LEADER';
    
    const lapDiff = leader.lap - driver.lap;
    if (lapDiff > 0) {
      return `+${lapDiff} ${lapDiff === 1 ? 'Lap' : 'Laps'}`;
    }

    // Time gap estimation: gap in miles divided by speed in miles/sec
    // 2.5 miles per lap.
    const distGapLaps = leader.totalDistance - driver.totalDistance;
    const speedMph = Math.max(driver.speed, 100); // Prevent divide by zero
    const gapSeconds = (distGapLaps * 2.5 / speedMph) * 3600;
    
    return `+${gapSeconds.toFixed(3)}s`;
  };

  const getPosChange = (driver: Driver) => {
    const change = driver.startingPos - driver.currentPos;
    if (change > 0) {
      return <span style={{ color: 'var(--flag-green)', fontWeight: 'bold' }}>▲ {change}</span>;
    } else if (change < 0) {
      return <span style={{ color: 'var(--flag-red)', fontWeight: 'bold' }}>▼ {Math.abs(change)}</span>;
    }
    return <span style={{ color: 'var(--text-muted)' }}>--</span>;
  };

  return (
    <div className="leaderboard-container glass-panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px 10px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Live Standings</h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {drivers.filter(d => d.status === 'running').length} / {drivers.length} Cars Active
          </span>
        </div>
      </div>

      {/* Standings Grid Headers */}
      <div className="leaderboard-header">
        <span className="col-pos">Pos</span>
        <span className="col-change">Chg</span>
        <span className="col-num">No</span>
        <span className="col-name">Driver</span>
        <span className="col-gap">Gap</span>
        <span className="col-speed">Speed</span>
        <span className="col-pits">Pit</span>
        {mode === 'live' && <span className="col-actions">Sync</span>}
      </div>

      {/* Scrollable list of drivers */}
      <div className="leaderboard-list">
        {drivers.map((driver, index) => {
          const isSelected = selectedDriverId === driver.id;
          const isOut = driver.status === 'out';
          const isPitting = driver.status === 'pitting';

          return (
            <div 
              key={driver.id} 
              className={`driver-row ${isSelected ? 'selected' : ''} ${isOut ? 'out' : ''} ${isPitting ? 'pitting' : ''}`}
              onClick={() => setSelectedDriverId(driver.id)}
            >
              {/* Position */}
              <span className="col-pos font-mono">
                {isOut ? 'OUT' : driver.currentPos}
              </span>

              {/* Position Change */}
              <span className="col-change text-center font-mono">
                {getPosChange(driver)}
              </span>

              {/* Car Number with team colored badge */}
              <span className="col-num">
                <span 
                  className="car-badge"
                  style={{ backgroundColor: driver.carColor }}
                >
                  {driver.carNumber}
                </span>
              </span>

              {/* Driver Name & Team */}
              <span className="col-name text-truncate">
                <span className="driver-name-text">{driver.name}</span>
                <span className="team-text">{driver.team}</span>
              </span>

              {/* Gap to Leader */}
              <span className="col-gap font-mono">
                {calculateGap(driver, index)}
              </span>

              {/* Speed */}
              <span className={`col-speed font-mono ${isPitting ? 'pitting-glow' : ''}`}>
                {isOut ? (
                  <span className="out-tag">{driver.outReason || 'Retired'}</span>
                ) : isPitting ? (
                  <span className="pit-tag">PIT ROAD</span>
                ) : (
                  `${driver.speed} MPH`
                )}
              </span>

              {/* Pit Stops */}
              <span className="col-pits font-mono">{driver.pitStops}</span>

              {/* Sync controls for live broadcast position adjustments */}
              {mode === 'live' && (
                <span className="col-actions" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center' }}>
                  <PositionInput 
                    currentPos={driver.currentPos} 
                    maxPos={drivers.filter(d => d.status !== 'out').length}
                    onPositionChange={(newPos) => syncSetDriverPosition(driver.id, newPos)}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <button 
                      disabled={index === 0 || isOut}
                      className="sync-arrow-btn" 
                      onClick={() => syncMoveDriver(driver.id, 'up')}
                      title="Move position up"
                      style={{ width: '16px', height: '10px', fontSize: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0 }}
                    >
                      ▲
                    </button>
                    <button 
                      disabled={index === drivers.filter(d => d.status !== 'out').length - 1 || isOut}
                      className="sync-arrow-btn" 
                      onClick={() => syncMoveDriver(driver.id, 'down')}
                      title="Move position down"
                      style={{ width: '16px', height: '10px', fontSize: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0 }}
                    >
                      ▼
                    </button>
                  </div>
                </span>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        .leaderboard-header {
          display: grid;
          grid-template-columns: 35px 35px 35px 1fr 75px 85px 30px;
          gap: 6px;
          padding: 8px 16px;
          font-size: 11px;
          text-transform: uppercase;
          color: var(--text-muted);
          font-weight: 700;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          background: rgba(0,0,0,0.15);
        }
        
        .leaderboard-container:has(.col-actions) .leaderboard-header {
          grid-template-columns: 35px 35px 35px 1fr 70px 75px 25px 85px;
        }

        .leaderboard-list {
          overflow-y: auto;
          flex: 1;
        }

        .driver-row {
          display: grid;
          grid-template-columns: 35px 35px 35px 1fr 75px 85px 30px;
          gap: 6px;
          padding: 10px 16px;
          align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.02);
          cursor: pointer;
          font-size: 13px;
          transition: background var(--transition-fast), border-left-color var(--transition-fast);
          border-left: 3px solid transparent;
        }
        
        .leaderboard-container:has(.col-actions) .driver-row {
          grid-template-columns: 35px 35px 35px 1fr 70px 75px 25px 85px;
        }

        .driver-row:hover {
          background: rgba(255,255,255,0.015);
        }

        .driver-row.selected {
          background: rgba(0, 229, 255, 0.04);
          border-left-color: var(--cyan-accent);
        }

        .driver-row.pitting {
          background: rgba(0, 229, 255, 0.02);
        }

        .driver-row.out {
          opacity: 0.45;
          background: rgba(255, 23, 68, 0.01);
        }

        .col-pos {
          font-weight: 700;
        }
        
        .col-change {
          text-align: center;
        }

        .car-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 20px;
          border-radius: 4px;
          color: #fff;
          font-weight: 800;
          font-size: 11px;
          font-family: var(--font-mono);
          text-shadow: 0 1px 2px rgba(0,0,0,0.8);
          border: 1px solid rgba(255,255,255,0.2);
        }

        .driver-name-text {
          font-weight: 600;
          color: var(--text-primary);
          display: block;
        }

        .team-text {
          font-size: 10px;
          color: var(--text-muted);
          display: block;
        }

        .font-mono {
          font-family: var(--font-mono);
        }

        .pit-tag {
          font-size: 10px;
          background: rgba(0, 229, 255, 0.15);
          border: 1px solid rgba(0, 229, 255, 0.3);
          color: var(--cyan-accent);
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 700;
          letter-spacing: 0.05em;
        }
        
        .pitting-glow {
          animation: pit-glow-pulse 1s infinite ease-in-out;
        }
        
        @keyframes pit-glow-pulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }

        .out-tag {
          font-size: 9px;
          background: rgba(255, 23, 68, 0.15);
          border: 1px solid rgba(255, 23, 68, 0.3);
          color: var(--flag-red);
          padding: 1px 4px;
          border-radius: 3px;
          font-weight: 700;
          text-transform: uppercase;
          display: inline-block;
          max-width: 75px;
          text-overflow: ellipsis;
          overflow: hidden;
          white-space: nowrap;
        }

        .sync-arrow-btn {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: var(--text-secondary);
          width: 20px;
          height: 20px;
          font-size: 9px;
          border-radius: 3px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-right: 3px;
          transition: all var(--transition-fast);
        }

        .sync-arrow-btn:hover:not(:disabled) {
          background: var(--accent);
          color: #fff;
          border-color: transparent;
        }

        .sync-arrow-btn:disabled {
          opacity: 0.25;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};
