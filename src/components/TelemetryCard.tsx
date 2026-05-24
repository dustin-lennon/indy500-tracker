import React, { useEffect, useRef, useState } from 'react';
import type { Driver } from '../types';

interface TelemetryCardProps {
  driver: Driver | undefined;
}

export const TelemetryCard: React.FC<TelemetryCardProps> = ({ driver }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeTab, setActiveTab] = useState<'telemetry' | 'profile'>('telemetry');

  // Reset tab to telemetry when driver changes
  useEffect(() => {
    setActiveTab('telemetry');
  }, [driver?.id]);

  // Draw the real-time canvas chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !driver || activeTab !== 'telemetry' || driver.telemetryHistory.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    const gridRows = 4;
    for (let i = 1; i < gridRows; i++) {
      const y = (height / gridRows) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    const gridCols = 8;
    for (let i = 1; i < gridCols; i++) {
      const x = (width / gridCols) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    const history = driver.telemetryHistory;
    const maxPoints = 60; // Represents last 6 seconds of data
    
    // Calculate spacing
    const step = width / (maxPoints - 1);

    // Draw Throttle (Green Fill + Line)
    ctx.beginPath();
    history.forEach((pt, i) => {
      const x = i * step;
      const y = height - (pt.throttle / 100) * (height - 20) - 10;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = 'rgba(0, 230, 118, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw Brake (Red Fill + Line)
    ctx.beginPath();
    history.forEach((pt, i) => {
      const x = i * step;
      const y = height - (pt.brake / 100) * (height - 20) - 10;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = 'rgba(255, 23, 68, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw Speed (Cyan Glowing Line)
    ctx.shadowBlur = 4;
    ctx.shadowColor = 'var(--cyan-accent)';
    ctx.beginPath();
    history.forEach((pt, i) => {
      const x = i * step;
      // Scale speed between 0 and 245 mph
      const normSpeed = Math.min(pt.speed / 245, 1);
      const y = height - normSpeed * (height - 20) - 10;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = 'var(--cyan-accent)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    
    // Reset shadow for subsequent draws
    ctx.shadowBlur = 0;
  }, [driver, activeTab]);

  if (!driver) {
    return (
      <div className="telemetry-card glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Select a driver to inspect live telemetry</p>
      </div>
    );
  }

  const getTireWearColor = (wear: number): string => {
    if (wear >= 80) return 'var(--flag-green)';
    if (wear >= 45) return 'var(--flag-yellow)';
    return 'var(--flag-red)';
  };

  const getFuelColor = (fuel: number): string => {
    if (fuel >= 50) return 'var(--flag-green)';
    if (fuel >= 15) return 'var(--flag-yellow)';
    return 'var(--flag-red)';
  };

  const avgTireWear = Math.round((driver.tireWear.lf + driver.tireWear.rf + driver.tireWear.lr + driver.tireWear.rr) / 4);

  // Map raw baseSpeed to a realistic 0-100 Speed Rating
  const calculatedSpeedRating = Math.round(((driver.skillRatings.baseSpeed - 1.0) / 0.03) * 100);

  return (
    <div className="telemetry-card glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minWidth: 0 }}>
      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="car-badge" style={{ backgroundColor: driver.carColor }}>{driver.carNumber}</span>
            <h3 style={{ fontSize: '18px', fontWeight: '700' }}>{driver.name}</h3>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{driver.team}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className={`status-tag ${driver.status}`}>
            {driver.status === 'out' ? driver.outReason || 'RETIRED' : driver.status === 'pitting' ? 'PITTING' : 'RUNNING'}
          </span>
          <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>Pos: <strong>P{driver.currentPos}</strong> | Lap: <strong>{driver.lap}</strong></p>
        </div>
      </div>

      {/* Tabs Menu */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '4px' }}>
        <button 
          className={`tab-select-btn ${activeTab === 'telemetry' ? 'active' : ''}`}
          onClick={() => setActiveTab('telemetry')}
        >
          📊 Live Telemetry
        </button>
        <button 
          className={`tab-select-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          👤 Driver Profile
        </button>
      </div>

      {/* Conditional Content */}
      {activeTab === 'telemetry' ? (
        /* TELEMETRY VIEW */
        <div className="tab-view-grid fade-in" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '16px', flex: 1 }}>
          {/* Speed, Gear, RPM */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRight: '1px solid rgba(255,255,255,0.04)', paddingRight: '12px' }}>
            <div>
              <label className="stat-label">Live Telemetry</label>
              <div style={{ display: 'flex', alignItems: 'baseline', marginTop: '6px' }}>
                <span className="speed-val font-mono" style={{ fontSize: '36px', fontWeight: '800', color: '#fff', letterSpacing: '-1px' }}>
                  {driver.speed}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '4px', fontWeight: '700' }}>MPH</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
              <div className="gear-indicator font-mono">
                {driver.speed === 0 ? 'N' : driver.gear}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                  <span>Tachometer</span>
                  <span className="font-mono">{driver.rpm} RPM</span>
                </div>
                <div className="rpm-bar-container">
                  <div 
                    className={`rpm-bar ${driver.rpm > 10500 ? 'redline' : ''}`} 
                    style={{ width: `${(driver.rpm / 12000) * 100}%` }} 
                  />
                </div>
              </div>
            </div>

            {/* Throttle & Brake Visualizers */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                  <span>THR</span>
                  <span>{driver.throttle}%</span>
                </div>
                <div className="pedal-bar-container">
                  <div className="pedal-bar throttle" style={{ width: `${driver.throttle}%` }} />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                  <span>BRK</span>
                  <span>{driver.brake}%</span>
                </div>
                <div className="pedal-bar-container">
                  <div className="pedal-bar brake" style={{ width: `${driver.brake}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Tire Wear (Bird's Eye Car layout) */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', borderRight: '1px solid rgba(255,255,255,0.04)', paddingRight: '8px' }}>
            <label className="stat-label" style={{ alignSelf: 'flex-start', marginBottom: '8px' }}>Tire Status</label>
            <div className="tire-grid-container">
              {/* Front Tires */}
              <div className="tire-row">
                <div className="tire-box" style={{ borderColor: getTireWearColor(driver.tireWear.lf) }}>
                  <span className="tire-label">LF</span>
                  <span className="tire-pct font-mono">{driver.tireWear.lf}%</span>
                </div>
                <div className="car-chassis-top" />
                <div className="tire-box" style={{ borderColor: getTireWearColor(driver.tireWear.rf) }}>
                  <span className="tire-label">RF</span>
                  <span className="tire-pct font-mono">{driver.tireWear.rf}%</span>
                </div>
              </div>

              {/* Car body */}
              <div className="car-body-center">
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Avg {avgTireWear}%</span>
              </div>

              {/* Rear Tires */}
              <div className="tire-row">
                <div className="tire-box" style={{ borderColor: getTireWearColor(driver.tireWear.lr) }}>
                  <span className="tire-label">LR</span>
                  <span className="tire-pct font-mono">{driver.tireWear.lr}%</span>
                </div>
                <div className="car-chassis-bot" />
                <div className="tire-box" style={{ borderColor: getTireWearColor(driver.tireWear.rr) }}>
                  <span className="tire-label">RR</span>
                  <span className="tire-pct font-mono">{driver.tireWear.rr}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Fuel & Real-Time Oscillo Chart */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
            {/* Fuel Level */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label className="stat-label">Ethanol Fuel</label>
                <span className="font-mono" style={{ fontSize: '12px', fontWeight: '700', color: getFuelColor(driver.fuel) }}>{driver.fuel}%</span>
              </div>
              <div className="fuel-bar-container">
                <div 
                  className="fuel-bar" 
                  style={{ 
                    width: `${driver.fuel}%`, 
                    backgroundColor: getFuelColor(driver.fuel),
                    boxShadow: `0 0 8px ${getFuelColor(driver.fuel)}44` 
                  }} 
                />
              </div>
            </div>

            {/* Real-time Telemetry Canvas */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginTop: '8px', minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                <span>Live Waveform</span>
                <span style={{ display: 'flex', gap: '8px' }}>
                  <span style={{ color: 'var(--cyan-accent)' }}>● Spd</span>
                  <span style={{ color: 'var(--flag-green)' }}>● Thr</span>
                  <span style={{ color: 'var(--flag-red)' }}>● Brk</span>
                </span>
              </div>
              <div style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '4px', overflow: 'hidden' }}>
                <canvas ref={canvasRef} width="160" height="65" style={{ width: '100%', height: '100%', display: 'block' }} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* DRIVER PROFILE VIEW */
        <div className="profile-tab-content fade-in" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.2fr', gap: '16px', flex: 1 }}>
          {/* Left Side: Stats block */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderRight: '1px solid rgba(255,255,255,0.04)', paddingRight: '16px' }}>
            <label className="stat-label">Driver Stats</label>
            
            <div className="profile-stat-row">
              <span className="profile-stat-lbl">Nationality</span>
              <span className="profile-stat-val" style={{ fontWeight: '700' }}>
                {driver.profile?.nationality === 'USA' ? '🇺🇸 USA' :
                 driver.profile?.nationality === 'Spain' ? '🇪🇸 Spain' :
                 driver.profile?.nationality === 'Mexico' ? '🇲🇽 Mexico' :
                 driver.profile?.nationality === 'New Zealand' ? '🇳🇿 New Zealand' :
                 driver.profile?.nationality === 'Brazil' ? '🇧🇷 Brazil' :
                 driver.profile?.nationality === 'Sweden' ? '🇸🇪 Sweden' :
                 driver.profile?.nationality === 'Denmark' ? '🇩🇰 Denmark' :
                 driver.profile?.nationality === 'Germany' ? '🇩🇪 Germany' :
                 driver.profile?.nationality === 'France' ? '🇫🇷 France' :
                 driver.profile?.nationality === 'United Kingdom' ? '🇬🇧 UK' :
                 driver.profile?.nationality === 'Netherlands' ? '🇳🇱 Netherlands' :
                 driver.profile?.nationality === 'Australia' ? '🇦🇺 Australia' :
                 driver.profile?.nationality || '🏁'}
              </span>
            </div>

            <div className="profile-stat-row">
              <span className="profile-stat-lbl">Age</span>
              <span className="profile-stat-val font-mono">{driver.profile?.age || '--'}</span>
            </div>

            <div className="profile-stat-row">
              <span className="profile-stat-lbl">Indy 500 Wins</span>
              <span className="profile-stat-val font-mono" style={{ color: driver.profile?.indy500Wins ? 'var(--flag-yellow)' : 'var(--text-muted)', fontWeight: '700' }}>
                {driver.profile?.indy500Wins ? `${driver.profile.indy500Wins} 🏆` : '0'}
              </span>
            </div>

            <div className="profile-stat-row">
              <span className="profile-stat-lbl">Astor Cups</span>
              <span className="profile-stat-val font-mono" style={{ fontWeight: '700' }}>
                {driver.profile?.championships || '0'}
              </span>
            </div>

            <div className="profile-stat-row" style={{ borderBottom: 'none' }}>
              <span className="profile-stat-lbl">Qualy Speed</span>
              <span className="profile-stat-val font-mono" style={{ color: 'var(--cyan-accent)', fontWeight: '700' }}>
                {driver.profile?.qualifyingSpeed.toFixed(3) || '0.000'} MPH
              </span>
            </div>
          </div>

          {/* Right Side: Bio & Performance Ratings */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '8px', minWidth: 0 }}>
            <div>
              <label className="stat-label">Driver Biography</label>
              <p className="profile-bio-text">
                "{driver.profile?.bio}"
              </p>
            </div>

            {/* Performance Bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="stat-label">Simulator Profile</label>
              
              {/* Speed bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-secondary)', marginBottom: '1px' }}>
                  <span>Raw Speed</span>
                  <span className="font-mono">{calculatedSpeedRating} / 100</span>
                </div>
                <div className="skill-track">
                  <div className="skill-fill speed" style={{ width: `${Math.max(calculatedSpeedRating, 25)}%` }} />
                </div>
              </div>

              {/* Consistency bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-secondary)', marginBottom: '1px' }}>
                  <span>Consistency</span>
                  <span className="font-mono">{driver.skillRatings.consistency} / 100</span>
                </div>
                <div className="skill-track">
                  <div className="skill-fill consistency" style={{ width: `${driver.skillRatings.consistency}%` }} />
                </div>
              </div>

              {/* Safety bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-secondary)', marginBottom: '1px' }}>
                  <span>Safety / Avoidance</span>
                  <span className="font-mono">{driver.skillRatings.accidentAvoidance} / 100</span>
                </div>
                <div className="skill-track">
                  <div className="skill-fill safety" style={{ width: `${driver.skillRatings.accidentAvoidance}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .status-tag {
          font-size: 10px;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: 4px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .status-tag.running {
          background: rgba(0, 230, 118, 0.15);
          color: var(--flag-green);
          border: 1px solid rgba(0, 230, 118, 0.3);
        }
        .status-tag.pitting {
          background: rgba(0, 229, 255, 0.15);
          color: var(--cyan-accent);
          border: 1px solid rgba(0, 229, 255, 0.3);
          animation: pulse 1s infinite alternate;
        }
        .status-tag.out {
          background: rgba(255, 23, 68, 0.15);
          color: var(--flag-red);
          border: 1px solid rgba(255, 23, 68, 0.3);
        }
        
        .tab-select-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 11px;
          font-weight: 700;
          padding: 6px 12px 4px 12px;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all var(--transition-fast);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .tab-select-btn:hover {
          color: var(--text-primary);
        }
        .tab-select-btn.active {
          color: var(--cyan-accent);
          border-bottom-color: var(--cyan-accent);
          text-shadow: 0 0 8px rgba(0, 229, 255, 0.3);
        }

        .gear-indicator {
          font-size: 26px;
          font-weight: 800;
          color: #fff;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 6px;
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .rpm-bar-container {
          height: 6px;
          background: rgba(255,255,255,0.05);
          border-radius: 3px;
          overflow: hidden;
          width: 100%;
        }
        .rpm-bar {
          height: 100%;
          background: linear-gradient(90deg, var(--flag-green) 70%, var(--flag-yellow) 85%, var(--flag-red) 100%);
          border-radius: 3px;
          transition: width 0.1s ease;
        }
        .rpm-bar.redline {
          animation: redline-flash 0.1s infinite alternate;
        }
        @keyframes redline-flash {
          0% { filter: brightness(1.3); }
          100% { filter: brightness(0.8); }
        }

        .pedal-bar-container {
          height: 5px;
          background: rgba(255,255,255,0.05);
          border-radius: 3px;
          overflow: hidden;
        }
        .pedal-bar {
          height: 100%;
          border-radius: 3px;
        }
        .pedal-bar.throttle {
          background: var(--flag-green);
          box-shadow: 0 0 6px var(--flag-green);
        }
        .pedal-bar.brake {
          background: var(--flag-red);
          box-shadow: 0 0 6px var(--flag-red);
        }

        /* Tire Wear Layout styles */
        .tire-grid-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          margin-top: 6px;
        }
        .tire-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .tire-box {
          border: 2px solid transparent;
          border-radius: 4px;
          background: #111;
          width: 34px;
          height: 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 5px rgba(0,0,0,0.5);
          transition: border-color 0.2s ease;
        }
        .tire-label {
          font-size: 8px;
          font-weight: 700;
          color: var(--text-muted);
        }
        .tire-pct {
          font-size: 10px;
          font-weight: 700;
          color: #fff;
          margin-top: 1px;
        }
        
        .car-chassis-top {
          width: 24px;
          height: 6px;
          background: rgba(255,255,255,0.06);
          border-radius: 2px;
        }
        .car-chassis-bot {
          width: 24px;
          height: 8px;
          background: rgba(255,255,255,0.06);
          border-radius: 2px;
        }
        
        .car-body-center {
          width: 24px;
          height: 28px;
          background: rgba(255,255,255,0.02);
          border-left: 2px solid rgba(255,255,255,0.05);
          border-right: 2px solid rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .fuel-bar-container {
          height: 6px;
          background: rgba(255,255,255,0.05);
          border-radius: 3px;
          overflow: hidden;
          margin-top: 4px;
        }
        .fuel-bar {
          height: 100%;
          border-radius: 3px;
          transition: width 0.2s ease;
        }

        /* Profile styling */
        .profile-stat-row {
          display: flex;
          justify-content: space-between;
          padding: 6px 0;
          border-bottom: 1px solid rgba(255,255,255,0.03);
          font-size: 12px;
        }
        .profile-stat-lbl {
          color: var(--text-secondary);
        }
        .profile-stat-val {
          color: #fff;
        }
        
        .profile-bio-text {
          font-size: 11.5px;
          color: var(--text-secondary);
          line-height: 1.45;
          margin-top: 4px;
          font-style: italic;
          background: rgba(0,0,0,0.15);
          padding: 8px 12px;
          border-radius: 4px;
          border: 1px solid rgba(255,255,255,0.02);
          max-height: 70px;
          overflow-y: auto;
        }
        
        .skill-track {
          height: 5px;
          background: rgba(255,255,255,0.05);
          border-radius: 3px;
          overflow: hidden;
          width: 100%;
        }
        .skill-fill {
          height: 100%;
          border-radius: 3px;
        }
        .skill-fill.speed {
          background: var(--cyan-accent);
          box-shadow: 0 0 6px var(--cyan-accent);
        }
        .skill-fill.consistency {
          background: var(--flag-green);
          box-shadow: 0 0 6px var(--flag-green);
        }
        .skill-fill.safety {
          background: #ff8f00;
          box-shadow: 0 0 6px #ff8f00;
        }
      `}</style>
    </div>
  );
};
