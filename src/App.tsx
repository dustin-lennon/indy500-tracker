import { useState, useEffect } from 'react';
import { useRaceSimulation } from './hooks/useRaceSimulation';
import { ControlPanel } from './components/ControlPanel';
import { SVGTrackMap } from './components/SVGTrackMap';
import { Leaderboard } from './components/Leaderboard';
import { TelemetryCard } from './components/TelemetryCard';
import { SpotterLog } from './components/SpotterLog';
import { LiveBlogSync } from './components/LiveBlogSync';

function App() {
  const [activeTab, setActiveTab] = useState<'spotter' | 'blog'>('spotter');

  const {
    drivers,
    flag,
    lap,
    elapsedTime,
    mode,
    isPlaying,
    speedMultiplier,
    selectedDriverId,
    events,
    paceCarDistance,
    togglePlay,
    setSpeedMultiplier,
    setMode,
    setSelectedDriverId,
    resetRace,
    // Broadcast manual overrides
    syncSetFlag,
    syncSetLap,
    syncOrderPitStop,
    syncRetireDriver,
    syncReinstateDriver,
    syncMoveDriver,
    syncSetDriverPosition,
    syncSetBulkPositions
  } = useRaceSimulation();

  useEffect(() => {
    if (mode === 'live') {
      setActiveTab('blog');
    } else {
      setActiveTab('spotter');
    }
  }, [mode]);

  const selectedDriver = drivers.find((d) => d.id === selectedDriverId);

  return (
    <div className="app-container">
      {/* Header Banner */}
      <header className="header-panel glass-panel">
        <div className="brand-section">
          <h1 className="brand-logo">
            Indy 500 <span>Live Tracker</span>
          </h1>
          <span className={`live-badge ${mode === 'live' ? '' : 'inactive'}`}>
            {mode === 'live' ? 'LIVE BROADCAST' : 'SIMULATOR MODE'}
          </span>
        </div>

        {/* Flag Condition and Laps Banner */}
        <div className="status-banner">
          <div className="flag-status-container">
            <div className={`flag-light ${flag}`} />
            <span className={`flag-text ${flag}`}>{flag} Flag</span>
          </div>

          <div className="status-stat">
            <span className="stat-label">Current Lap</span>
            <span className="stat-value font-mono">
              {lap >= 200 ? 'FINISH' : `${lap} / 200`}
            </span>
          </div>

          <div className="status-stat">
            <span className="stat-label">Race Clock</span>
            <span className="stat-value font-mono">{elapsedTime}</span>
          </div>

          <div className="status-stat">
            <span className="stat-label">Leader</span>
            <span className="stat-value font-mono" style={{ color: drivers[0]?.carColor || '#fff' }}>
              {drivers[0] ? `#${drivers[0].carNumber} ${drivers[0].name.split(' ')[1]}` : '--'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="dashboard-grid">
        {/* Left Standings Column */}
        <section className="left-column">
          <Leaderboard
            drivers={drivers}
            selectedDriverId={selectedDriverId}
            mode={mode}
            setSelectedDriverId={setSelectedDriverId}
            syncMoveDriver={syncMoveDriver}
            syncSetDriverPosition={syncSetDriverPosition}
          />
        </section>

        {/* Right Map/Telemetry Columns */}
        <section className="right-column">
          {/* Map visualization */}
          <SVGTrackMap
            drivers={drivers}
            flag={flag}
            lap={lap}
            selectedDriverId={selectedDriverId}
            paceCarDistance={paceCarDistance}
            setSelectedDriverId={setSelectedDriverId}
          />

          {/* Controls, Telemetry & Spotter split row */}
          <div className="bottom-split">
            <TelemetryCard driver={selectedDriver} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', minWidth: 0 }}>
              <ControlPanel
                flag={flag}
                lap={lap}
                mode={mode}
                isPlaying={isPlaying}
                speedMultiplier={speedMultiplier}
                drivers={drivers}
                togglePlay={togglePlay}
                setSpeedMultiplier={setSpeedMultiplier}
                setMode={setMode}
                resetRace={resetRace}
                syncSetFlag={syncSetFlag}
                syncSetLap={syncSetLap}
                syncOrderPitStop={syncOrderPitStop}
                syncRetireDriver={syncRetireDriver}
                syncReinstateDriver={syncReinstateDriver}
                syncSetBulkPositions={syncSetBulkPositions}
                selectedDriverId={selectedDriverId}
                setSelectedDriverId={setSelectedDriverId}
              />
              
              {/* Tabbed view for Spotter and Fox Live updates */}
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div style={{ display: 'flex', gap: '4px', paddingLeft: '8px' }}>
                  <button 
                    type="button"
                    style={{
                      padding: '8px 16px',
                      background: activeTab === 'spotter' ? 'var(--panel-bg)' : 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderBottom: activeTab === 'spotter' ? '1px solid transparent' : '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '8px 8px 0 0',
                      color: activeTab === 'spotter' ? '#fff' : 'var(--text-secondary)',
                      fontSize: '9.5px',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      cursor: 'pointer',
                      zIndex: 2,
                      marginBottom: '-1px',
                      borderTop: activeTab === 'spotter' ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.06)',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => setActiveTab('spotter')}
                  >
                    📻 Spotter
                  </button>
                  <button 
                    type="button"
                    style={{
                      padding: '8px 16px',
                      background: activeTab === 'blog' ? 'var(--panel-bg)' : 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderBottom: activeTab === 'blog' ? '1px solid transparent' : '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '8px 8px 0 0',
                      color: activeTab === 'blog' ? '#fff' : 'var(--text-secondary)',
                      fontSize: '9.5px',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      cursor: 'pointer',
                      zIndex: 2,
                      marginBottom: '-1px',
                      borderTop: activeTab === 'blog' ? '2px solid var(--cyan-accent)' : '1px solid rgba(255,255,255,0.06)',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => setActiveTab('blog')}
                  >
                    📰 FOX updates
                  </button>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  {activeTab === 'spotter' ? (
                    <SpotterLog events={events} />
                  ) : (
                    <LiveBlogSync
                      drivers={drivers}
                      mode={mode}
                      syncSetFlag={syncSetFlag}
                      syncSetLap={syncSetLap}
                      syncOrderPitStop={syncOrderPitStop}
                      syncRetireDriver={syncRetireDriver}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer copyright */}
      <footer className="footer-panel glass-panel">
        <span>110th Indianapolis 500 • Indianapolis Motor Speedway • Live Telemetry Companion</span>
        <span>
          Built with React & Canvas • <a href="https://github.com/dustin-lennon/indy500-tracker" target="_blank" rel="noreferrer">GitHub Repo</a>
        </span>
      </footer>
    </div>
  );
}

export default App;
