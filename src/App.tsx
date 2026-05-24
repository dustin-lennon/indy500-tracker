import { useRaceSimulation } from './hooks/useRaceSimulation';
import { ControlPanel } from './components/ControlPanel';
import { SVGTrackMap } from './components/SVGTrackMap';
import { Leaderboard } from './components/Leaderboard';
import { TelemetryCard } from './components/TelemetryCard';
import { SpotterLog } from './components/SpotterLog';

function App() {
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
    syncSetDriverPosition
  } = useRaceSimulation();

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
                selectedDriverId={selectedDriverId}
                setSelectedDriverId={setSelectedDriverId}
              />
              <SpotterLog events={events} />
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
