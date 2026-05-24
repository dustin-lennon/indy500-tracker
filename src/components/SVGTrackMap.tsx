import React, { useEffect, useRef, useState } from 'react';
import type { Driver, RaceFlag } from '../types';

interface SVGTrackMapProps {
  drivers: Driver[];
  flag: RaceFlag;
  lap: number;
  selectedDriverId: string | null;
  paceCarDistance: number;
  setSelectedDriverId: (id: string | null) => void;
}

interface Point {
  x: number;
  y: number;
}

export const SVGTrackMap: React.FC<SVGTrackMapProps> = ({
  drivers,
  flag,
  lap,
  selectedDriverId,
  paceCarDistance,
  setSelectedDriverId,
}) => {
  const pathRef = useRef<SVGPathElement | null>(null);
  const pitPathRef = useRef<SVGPathElement | null>(null);
  const [pathPoints, setPathPoints] = useState<Point[]>([]);
  const [pitPoints, setPitPoints] = useState<Point[]>([]);
  const [hoveredDriver, setHoveredDriver] = useState<Driver | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Define the track path
  // Start/Finish is at bottom-center (400, 310), going left (counter-clockwise)
  const trackPathD = "M 400 310 L 150 310 A 100 100 0 0 1 50 210 L 50 150 A 100 100 0 0 1 150 50 L 650 50 A 100 100 0 0 1 750 150 L 750 210 A 100 100 0 0 1 650 310 Z";
  
  // Pit lane path: starts before Turn 4 exit, runs inside (y=290), ends Turn 1 entry
  const pitPathD = "M 700 295 C 680 290 640 290 600 290 L 200 290 C 160 290 120 290 100 310";

  // Pre-calculate path coordinates for smooth O(1) rendering
  useEffect(() => {
    const mainPath = pathRef.current;
    const pitPath = pitPathRef.current;
    if (!mainPath || !pitPath) return;

    const mainLen = mainPath.getTotalLength();
    const tempPoints: Point[] = [];
    const resolution = 1000;
    for (let i = 0; i <= resolution; i++) {
      const pt = mainPath.getPointAtLength((i / resolution) * mainLen);
      tempPoints.push({ x: pt.x, y: pt.y });
    }
    setPathPoints(tempPoints);

    const pitLen = pitPath.getTotalLength();
    const tempPit: Point[] = [];
    for (let i = 0; i <= resolution; i++) {
      const pt = pitPath.getPointAtLength((i / resolution) * pitLen);
      tempPit.push({ x: pt.x, y: pt.y });
    }
    setPitPoints(tempPit);
  }, []);

  // Retrieve coordinate mapping
  const getCarCoordinates = (
    distanceIntoLap: number, 
    isPitting: boolean, 
    lateralOffset = 0,
    customPitProgress?: number
  ): Point => {
    if (pathPoints.length === 0 || pitPoints.length === 0) {
      return { x: 400, y: 310 }; // Default start/finish
    }

    // Wrap distance between 0 and 1
    const d = (distanceIntoLap % 1 + 1) % 1;
    const idx = Math.floor(d * 999);

    if (isPitting) {
      if (customPitProgress !== undefined) {
        const pitIdx = Math.min(Math.max(Math.floor(customPitProgress * 999), 0), 999);
        return pitPoints[pitIdx] || { x: 400, y: 310 };
      }
      // Map distance inside pit lane (pit road entry is roughly 0.90 to 0.15)
      // We map the range [0.90, 1.0] and [0.0, 0.15] into a continuous [0, 1] range for pit lane
      let pitProgress = 0;
      if (d >= 0.90) {
        pitProgress = (d - 0.90) / 0.25; // 0.90 to 1.15 total span
      } else if (d <= 0.15) {
        pitProgress = (d + 0.10) / 0.25;
      } else {
        pitProgress = 1.0;
      }
      
      const pitIdx = Math.min(Math.max(Math.floor(pitProgress * 999), 0), 999);
      return pitPoints[pitIdx] || { x: 400, y: 310 };
    }

    const pt = { ...pathPoints[idx] }; // Clone to avoid mutating cash cache

    if (lateralOffset !== 0) {
      const idx2 = (idx + 2) % 1000;
      const p1 = pathPoints[idx];
      const p2 = pathPoints[idx2] || p1;
      
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      
      if (len > 0) {
        const tx = dx / len;
        const ty = dy / len;
        // Normal unit vector pointing outwards (to the right of direction)
        const nx = ty;
        const ny = -tx;
        
        pt.x += lateralOffset * nx;
        pt.y += lateralOffset * ny;
      }
    }

    return pt;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div className="track-map-container glass-panel" style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Live Track Map</h3>
        <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#fff', border: '1px dashed #ffd600' }} />
            <span>Pace Car</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent)' }} />
            <span>Active Car</span>
          </div>
        </div>
      </div>

      <div style={{ position: 'relative', width: '100%', height: '0', paddingBottom: '45%' }}>
        <svg 
          viewBox="0 0 800 360" 
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
          onMouseMove={handleMouseMove}
        >
          {/* Glowing Filters */}
          <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="neon-glow-accent" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComponentTransfer in="blur" result="glow1">
                <feFuncA type="linear" slope="0.8"/>
              </feComponentTransfer>
              <feMerge>
                <feMergeNode in="glow1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Hidden Paths used for coordinate mapping */}
          <path ref={pathRef} d={trackPathD} fill="none" stroke="none" pointerEvents="none" />
          <path ref={pitPathRef} d={pitPathD} fill="none" stroke="none" pointerEvents="none" />

          {/* Rendered Track surface */}
          <path 
            d={trackPathD} 
            fill="none" 
            stroke="#1a1a24" 
            strokeWidth="32" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />
          <path 
            d={trackPathD} 
            fill="none" 
            stroke="#272736" 
            strokeWidth="28" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />

          {/* Pit Lane surface */}
          <path 
            d={pitPathD} 
            fill="none" 
            stroke="#1e1e2b" 
            strokeWidth="16" 
            strokeLinecap="round"
          />
          <path 
            d={pitPathD} 
            fill="none" 
            stroke="#2d2d3f" 
            strokeWidth="12" 
            strokeLinecap="round"
          />

          {/* Center Track Line (dashed white) */}
          <path 
            d={trackPathD} 
            fill="none" 
            stroke="rgba(255,255,255,0.08)" 
            strokeWidth="1" 
            strokeDasharray="8 8" 
          />

          {/* Start/Finish Yard of Bricks */}
          <line x1="400" y1="294" x2="400" y2="326" stroke="#fff" strokeWidth="4" />
          <line x1="400" y1="294" x2="400" y2="326" stroke="#c2185b" strokeWidth="4" strokeDasharray="2 2" />

          {/* Corners Labels */}
          <text x="75" y="270" fill="var(--text-muted)" fontSize="12" fontWeight="700">TURN 1</text>
          <text x="75" y="105" fill="var(--text-muted)" fontSize="12" fontWeight="700">TURN 2</text>
          <text x="710" y="105" fill="var(--text-muted)" fontSize="12" fontWeight="700">TURN 3</text>
          <text x="710" y="270" fill="var(--text-muted)" fontSize="12" fontWeight="700">TURN 4</text>
          
          <text x="400" y="40" fill="var(--text-muted)" fontSize="10" fontWeight="600" textAnchor="middle" letterSpacing="2">BACKSTRETCH</text>
          <text x="400" y="345" fill="var(--text-muted)" fontSize="10" fontWeight="600" textAnchor="middle" letterSpacing="2">FRONT STRETCH</text>

          {/* Pit Wall line */}
          <line x1="200" y1="281" x2="600" y2="281" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />

          {/* SAFETY / PACE CAR (under yellow flag or pre-race grid) */}
          {(flag === 'yellow' || (flag === 'red' && lap === 0)) && pathPoints.length > 0 && (
            (() => {
              const pt = getCarCoordinates(paceCarDistance, false);
              return (
                <g key="pace-car" style={{ cursor: 'pointer' }}>
                  {/* Glowing ring */}
                  <circle cx={pt.x} cy={pt.y} r="12" fill="none" stroke="#ffd600" strokeWidth="2" opacity="0.6" className="pulse-yellow" />
                  <circle cx={pt.x} cy={pt.y} r="6" fill="#ffffff" stroke="#ffd600" strokeWidth="2" />
                  <text x={pt.x} y={pt.y - 12} fill="#ffd600" fontSize="9" fontWeight="800" textAnchor="middle">PACE CAR</text>
                </g>
              );
            })()
          )}

          {/* DRIVER CAR DOTS */}
          {pathPoints.length > 0 && drivers.map((driver) => {
            if (driver.status === 'out') return null; // Don't draw crashed/retired cars

            const isPreRace = flag === 'red' && lap === 0 && paceCarDistance === 0.93;
            const isRedFlag = flag === 'red' && !isPreRace;

            let customPitProgress: number | undefined = undefined;
            if (isRedFlag) {
              const sortedRunning = [...drivers]
                .filter(d => d.status !== 'out')
                .sort((a, b) => a.currentPos - b.currentPos);
              const runningIndex = sortedRunning.findIndex(d => d.id === driver.id);
              if (runningIndex !== -1) {
                customPitProgress = 0.90 - (runningIndex * 0.025);
              }
            }

            const pt = getCarCoordinates(
              driver.distanceIntoLap, 
              driver.status === 'pitting' || isRedFlag, 
              driver.lateralOffset,
              customPitProgress
            );
            const isSelected = selectedDriverId === driver.id;

            return (
              <g 
                key={driver.id} 
                onClick={() => setSelectedDriverId(driver.id)}
                onMouseEnter={() => setHoveredDriver(driver)}
                onMouseLeave={() => setHoveredDriver(null)}
                style={{ cursor: 'pointer', transition: 'transform 0.1s ease' }}
              >
                {/* Highlight ring for selected driver */}
                {isSelected && (
                  <circle 
                    cx={pt.x} 
                    cy={pt.y} 
                    r="14" 
                    fill="none" 
                    stroke="var(--cyan-accent)" 
                    strokeWidth="2"
                    filter="url(#neon-glow-accent)"
                  />
                )}

                {/* Interactive outer circle */}
                <circle 
                  cx={pt.x} 
                  cy={pt.y} 
                  r={isSelected ? "9" : "7.5"} 
                  fill={driver.carColor} 
                  stroke={isSelected ? "#fff" : "rgba(255,255,255,0.7)"} 
                  strokeWidth={isSelected ? "2.5" : "1.5"} 
                  style={{ boxShadow: '0 0 10px rgba(0,0,0,0.5)' }}
                />

                {/* Car number label inside dot */}
                <text 
                  x={pt.x} 
                  y={pt.y + 3} 
                  fill="#ffffff" 
                  fontSize={isSelected ? "8" : "7"} 
                  fontWeight="800" 
                  textAnchor="middle"
                  style={{ pointerEvents: 'none', userSelect: 'none', fontFamily: 'var(--font-mono)' }}
                >
                  {driver.carNumber}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Dynamic Tooltip on Hover */}
        {hoveredDriver && (
          <div 
            className="track-tooltip fade-in"
            style={{
              position: 'absolute',
              left: `${mousePos.x + 15}px`,
              top: `${mousePos.y - 45}px`,
              backgroundColor: 'rgba(10, 10, 15, 0.95)',
              border: `1px solid ${hoveredDriver.carColor}`,
              borderRadius: '6px',
              padding: '6px 10px',
              pointerEvents: 'none',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              zIndex: 100,
              minWidth: '150px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
              <span style={{ fontWeight: '700', fontSize: '12px' }}>{hoveredDriver.name}</span>
              <span style={{ fontSize: '10px', fontWeight: '800', backgroundColor: hoveredDriver.carColor, color: '#fff', padding: '1px 4px', borderRadius: '3px' }}>
                #{hoveredDriver.carNumber}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', fontSize: '10px', color: 'var(--text-secondary)' }}>
              <span>Standings: <strong>P{hoveredDriver.currentPos}</strong></span>
              <span>Speed: <strong>{hoveredDriver.speed} MPH</strong></span>
              <span>Fuel: <strong>{hoveredDriver.fuel}%</strong></span>
              {hoveredDriver.status === 'pitting' && (
                <span style={{ color: 'var(--cyan-accent)', fontWeight: '800' }}>IN PITS</span>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .pulse-yellow {
          animation: pulse-y 1.5s infinite ease-in-out;
        }
        @keyframes pulse-y {
          0%, 100% { r: 10px; opacity: 0.8; }
          50% { r: 15px; opacity: 0.2; }
        }
        .track-map-container {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background: var(--panel-bg);
          border: 1px solid var(--panel-border);
        }
      `}</style>
    </div>
  );
};
