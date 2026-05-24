import React, { useEffect, useRef } from 'react';
import { Driver } from '../types';

interface TelemetryCardProps {
  driver: Driver | undefined;
}

export const TelemetryCard: React.FC<TelemetryCardProps> = ({ driver }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Draw the real-time canvas chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !driver || driver.telemetryHistory.length === 0) return;

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
  }, [driver]);

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

  return (
    <div className="telemetry-card glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minWidth: 0 }}>
      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
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

      {/* Main Telemetry Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '16px', flex: 1 }}>
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
          <div className="tyre-grid-container">
            {/* Front Tires */}
            <div className="tyre-row">
              <div className="tyre-box" style={{ borderColor: getTireWearColor(driver.tireWear.lf) }}>
                <span className="tyre-label">LF</span>
                <span className="tyre-pct font-mono">{driver.tireWear.lf}%</span>
              </div>
              <div className="car-chassis-top" />
              <div className="tyre-box" style={{ borderColor: getTireWearColor(driver.tireWear.rf) }}>
                <span className="tyre-label">RF</span>
                <span className="tyre-pct font-mono">{driver.tireWear.rf}%</span>
              </div>
            </div>

            {/* Car body */}
            <div className="car-body-center">
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Avg {avgTireWear}%</span>
            </div>

            {/* Rear Tires */}
            <div className="tyre-row">
              <div className="tyre-box" style={{ borderColor: getTireWearColor(driver.tireWear.lr) }}>
                <span className="tyre-label">LR</span>
                <span className="tyre-pct font-mono">{driver.tireWear.lr}%</span>
              </div>
              <div className="car-chassis-bot" />
              <div className="tyre-box" style={{ borderColor: getTireWearColor(driver.tireWear.rr) }}>
                <span className="tyre-label">RR</span>
                <span className="tyre-pct font-mono">{driver.tireWear.rr}%</span>
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
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginTop: '10px', minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)', marginBottom: '3px' }}>
              <span>Live Waveform</span>
              <span style={{ display: 'flex', gap: '8px' }}>
                <span style={{ color: 'var(--cyan-accent)' }}>● Speed</span>
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
        .tyre-grid-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          margin-top: 6px;
        }
        .tyre-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .tyre-box {
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
        .tyre-label {
          font-size: 8px;
          font-weight: 700;
          color: var(--text-muted);
        }
        .tyre-pct {
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
      `}</style>
    </div>
  );
};
