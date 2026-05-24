import { useState, useEffect, useRef, useCallback } from 'react';
import type { Driver, RaceEvent, RaceFlag, SimulationMode, TelemetryPoint } from '../types';
import { INITIAL_DRIVERS } from '../data/initialDrivers';
import { getDriverProfile } from '../data/driverProfiles';

// Helpers
const formatTime = (totalSeconds: number): string => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const ms = Math.floor((totalSeconds % 1) * 10);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
};

export const useRaceSimulation = () => {
  // State
  const [drivers, setDrivers] = useState<Driver[]>(() => {
    // Distribute starting distances 3-wide (11 rows of 3)
    return INITIAL_DRIVERS.map((d, i) => {
      const r = Math.floor(i / 3); // Row 0 to 10
      const p = i % 3;             // Position: 0=Inside, 1=Middle, 2=Outside
      const dist = 0.88 - (r * 0.015) - (p * 0.002); // 3-wide stagger spacing
      return {
        ...d,
        distanceIntoLap: dist,
        totalDistance: dist,
        lateralOffset: (p === 0) ? -7 : (p === 1) ? 0 : 7, // Inside, Middle, Outside shifts
        profile: getDriverProfile(d.id, d.name, d.team, i + 1)
      };
    });
  });
  
  const [flag, setFlag] = useState<RaceFlag>('red'); // Start under red (paused/warmup)
  const [prevFlag, setPrevFlag] = useState<RaceFlag>('yellow'); // To resume after red (start under yellow pace laps)
  const [lap, setLap] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00.0');
  const [mode, setMode] = useState<SimulationMode>('scripted');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>('1'); // Select Palou by default
  const [events, setEvents] = useState<RaceEvent[]>([]);
  const [paceCarDistance, setPaceCarDistance] = useState<number>(0.93); // Start just ahead of pole position (0.88)
  
  // Refs for loop timing and tickers
  const simTimeRef = useRef<number>(0);
  const cautionLapsLeftRef = useRef<number>(0);
  const lastEventLapRef = useRef<number>(0);
  const cautionOrderRef = useRef<string[]>([]); // Saves standing order at caution start
  
  // Audio Speech Synthesis queue helper
  const speak = useCallback((text: string) => {
    if (localStorage.getItem('spotter_muted') === 'true') return;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Cancel current to read the latest alert
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.1;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // Event logger helper
  const addEvent = useCallback((
    type: RaceEvent['type'], 
    message: string, 
    flagColor: RaceFlag
  ) => {
    const newEvent: RaceEvent = {
      id: Math.random().toString(36).substr(2, 9),
      lap: Math.max(...drivers.map(d => d.lap), 0),
      time: formatTime(simTimeRef.current),
      type,
      message,
      flagColor
    };
    setEvents(prev => [newEvent, ...prev].slice(0, 100)); // Cap at 100 events
    speak(message);
  }, [drivers, speak]);

  // Reset function
  const resetRace = useCallback(() => {
    simTimeRef.current = 0;
    cautionLapsLeftRef.current = 0;
    lastEventLapRef.current = 0;
    cautionOrderRef.current = [];
    
    setDrivers(
      INITIAL_DRIVERS.map((d, i) => {
        const r = Math.floor(i / 3); // Row 0 to 10
        const p = i % 3;             // Position: 0=Inside, 1=Middle, 2=Outside
        const dist = 0.88 - (r * 0.015) - (p * 0.002);
        return {
          ...d,
          distanceIntoLap: dist,
          totalDistance: dist,
          lateralOffset: (p === 0) ? -7 : (p === 1) ? 0 : 7,
          profile: getDriverProfile(d.id, d.name, d.team, i + 1),
          status: 'running',
          outReason: undefined,
          pitTimeRemaining: undefined,
          pitStops: 0,
          lastPitLap: 0,
          lap: 0,
          speed: 0,
          rpm: 0,
          gear: 1,
          throttle: 0,
          brake: 0,
          fuel: 100,
          tireWear: { lf: 100, rf: 100, lr: 100, rr: 100 },
          telemetryHistory: []
        };
      })
    );
    setFlag('red');
    setPrevFlag('yellow'); // Warmup pace laps first
    setLap(0);
    setElapsedTime('00:00:00.0');
    setEvents([]);
    setPaceCarDistance(0.93); // Placed just in front of pole
    setIsPlaying(false);
    
    const introMsg = "Welcome to the 110th Indianapolis 500. The field of 33 is lined up on the grid. Ready for command.";
    setTimeout(() => {
      const newEvent: RaceEvent = {
        id: 'start',
        lap: 0,
        time: '00:00:00.0',
        type: 'info',
        message: introMsg,
        flagColor: 'red'
      };
      setEvents([newEvent]);
      speak(introMsg);
    }, 200);
  }, [speak]);

  // Handle initial greeting
  useEffect(() => {
    resetRace();
  }, []);

  // Zero out speeds and telemetry when RED flag is triggered
  useEffect(() => {
    if (flag === 'red') {
      setDrivers(prev => prev.map(d => {
        if (d.status === 'out') return d;
        return {
          ...d,
          speed: 0,
          rpm: 0,
          gear: 1,
          throttle: 0,
          brake: 0
        };
      }));
    }
  }, [flag]);

  // Update loop logic (tick occurs every 100ms in real time)
  const tick = useCallback(() => {
    if (flag === 'red') return; // Red flag stops all movement

    // 1. Advance simulation time
    const tickTime = 0.1 * speedMultiplier;
    simTimeRef.current += tickTime;
    setElapsedTime(formatTime(simTimeRef.current));

    setDrivers(prevDrivers => {
      // Find current leader's lap to set race lap state
      const currentLeader = [...prevDrivers].sort((a, b) => b.totalDistance - a.totalDistance)[0];
      if (currentLeader && currentLeader.lap !== lap) {
        const nextLap = currentLeader.lap;
        setLap(nextLap);

        // Decrement caution laps when the leader completes a lap under caution
        if (mode !== 'live' && flag === 'yellow' && cautionLapsLeftRef.current > 0) {
          cautionLapsLeftRef.current -= 1;
          if (cautionLapsLeftRef.current === 0) {
            // Restart!
            setFlag(nextLap >= 199 ? 'white' : 'green');
            addEvent('restart', `GREEN FLAG! Race restart on lap ${nextLap}! The green flag is waving.`, 'green');
          } else {
            addEvent('info', `Caution Lap ${nextLap}: Safety car leading. ${cautionLapsLeftRef.current} caution laps remaining.`, 'yellow');
          }
        }
      }

      // Track flag transitions or scripted events based on leader's lap
      const leaderLap = currentLeader ? currentLeader.lap : 0;
      
      // ---- WARMUP TO GREEN TRANSITION (Pace Car pits, field goes green) ----
      if (flag === 'yellow' && leaderLap === 0 && paceCarDistance >= 0.33 && paceCarDistance < 0.50) {
        setFlag('green');
        addEvent('green', "GREEN FLAG! Green, green, green! The 110th Indianapolis 500 is underway!", 'green');
      }

      // ---- SCRIPTED STORY ENGINE ----
      if (mode === 'scripted') {
        if (leaderLap === 12 && lastEventLapRef.current < 12) {
          lastEventLapRef.current = 12;
          // Pato O'Ward takes the lead
          addEvent('lead_change', "Pato O'Ward (Car #5) makes a bold move in Turn 1 and takes the lead!", 'green');
        } 
        else if (leaderLap === 35 && lastEventLapRef.current < 35 && flag === 'green') {
          lastEventLapRef.current = 35;
          setFlag('yellow');
          cautionLapsLeftRef.current = 4;
          // Spin Turn 4
          const driverToCrash = prevDrivers.find(d => d.carNumber === '51'); // Legge
          if (driverToCrash) {
            addEvent('crash', "YELLOW FLAG! Spin in Turn 4 by Katherine Legge, Car #51! Field is slowing down.", 'yellow');
          }
        }
        else if (leaderLap === 65 && lastEventLapRef.current < 65 && flag === 'green') {
          lastEventLapRef.current = 65;
          addEvent('info', "Pit Stop cycles have begun. Leaders are diving onto pit road!", 'green');
        }
        else if (leaderLap === 110 && lastEventLapRef.current < 110) {
          lastEventLapRef.current = 110;
          addEvent('info', "Conor Daly, Car #24 is slow on the backstretch, pulling into the pits. Smoke from the engine. He is OUT.", 'green');
        }
        else if (leaderLap === 150 && lastEventLapRef.current < 150 && flag === 'green') {
          lastEventLapRef.current = 150;
          setFlag('yellow');
          cautionLapsLeftRef.current = 5;
          addEvent('crash', "YELLOW FLAG! Heavy crash in Turn 2 involving Romain Grosjean (Car #77) and Sting Ray Robb (Car #41). Medical crews are responding.", 'yellow');
        }
        else if (leaderLap === 185 && lastEventLapRef.current < 185 && flag === 'green') {
          lastEventLapRef.current = 185;
          setFlag('yellow');
          cautionLapsLeftRef.current = 4;
          addEvent('crash', "YELLOW FLAG! Single car incident. Alexander Rossi, Car #7 spins out of Turn 4 and hits the pit wall! Debris on front stretch.", 'yellow');
        }
        else if (leaderLap === 199 && lastEventLapRef.current < 199 && flag === 'green') {
          lastEventLapRef.current = 199;
          addEvent('white', "WHITE FLAG! 1 lap to go! Josef Newgarden leads Alex Palou by a car length!", 'white');
        }
        else if (leaderLap >= 200) {
          setIsPlaying(false);
          setFlag('checkered');
          const winner = [...prevDrivers].sort((a, b) => b.totalDistance - a.totalDistance)[0];
          addEvent('checkered', `CHECKERED FLAG! ${winner.name} wins the 110th Indianapolis 500! What a spectacular finish!`, 'checkered');
          return prevDrivers.map(d => ({ ...d, speed: 0, throttle: 0, brake: 0 }));
        }
      }

      // ---- SANDBOX PROCEDURAL ENGINE ----
      if (mode === 'sandbox' && flag === 'green' && leaderLap < 200) {
        // Random crash probability check (roughly once every 40-50 laps average)
        const crashProbability = 0.00015 * speedMultiplier;
        if (Math.random() < crashProbability) {
          // Trigger crash
          const activeDrivers = prevDrivers.filter(d => d.status === 'running');
          if (activeDrivers.length > 5) {
            // Select driver based on accident avoidance (lower avoidance = higher weight)
            const sortedByRisk = [...activeDrivers].sort((a, b) => a.skillRatings.accidentAvoidance - b.skillRatings.accidentAvoidance);
            const crashVictim = sortedByRisk[Math.floor(Math.random() * 4)]; // Pick from highest risk 4
            
            setFlag('yellow');
            cautionLapsLeftRef.current = Math.floor(Math.random() * 3) + 3; // 3-5 caution laps
            
            const turns = ['Turn 1', 'Turn 2', 'Turn 3', 'Turn 4', 'the front stretch', 'the backstretch'];
            const turn = turns[Math.floor(Math.random() * turns.length)];
            const reasons = ['spins out', 'touches the wall', 'suffers a tire blowout and crashes', 'loses control'];
            const reason = reasons[Math.floor(Math.random() * reasons.length)];
            
            addEvent('crash', `YELLOW FLAG! Caution is out! ${crashVictim.name} (Car #${crashVictim.carNumber}) ${reason} in ${turn}!`, 'yellow');
          }
        }
        
        // Random mechanical failure check (very rare)
        if (Math.random() < 0.00004 * speedMultiplier) {
          const activeDrivers = prevDrivers.filter(d => d.status === 'running');
          if (activeDrivers.length > 5) {
            const victim = activeDrivers[Math.floor(Math.random() * activeDrivers.length)];
            addEvent('info', `${victim.name} (Car #${victim.carNumber}) reports engine issues. He is retiring to the garage.`, 'green');
          }
        }

        // Leaderboard check for white/checkered in sandbox
        if (leaderLap === 199 && lastEventLapRef.current < 199) {
          lastEventLapRef.current = 199;
          addEvent('white', `WHITE FLAG! One lap to go! ${currentLeader.name} leads the field!`, 'white');
        } else if (leaderLap >= 200) {
          setIsPlaying(false);
          setFlag('checkered');
          addEvent('checkered', `CHECKERED FLAG! ${currentLeader.name} (Car #${currentLeader.carNumber}) wins the Indianapolis 500!`, 'checkered');
          return prevDrivers.map(d => ({ ...d, speed: 0, throttle: 0, brake: 0 }));
        }
      }

      // Live Spotter for Sandbox / General race restarts
      if (flag === 'yellow' && cautionLapsLeftRef.current > 0) {
        // If leader completes another lap, reduce caution laps remaining
        // We'll track it using the pace car or leader lap completion
      }

      // Handle Caution Laps countdown
      if (flag === 'yellow' && cautionLapsLeftRef.current > 0) {
        // Find pace car movement and decrement caution laps
        // In this implementation, we decrement caution laps when the leader crosses the start/finish line (lap completes)
      }

      // 2. Pace Car logic
      let newPaceCarDist = paceCarDistance;
      if (flag === 'yellow') {
        newPaceCarDist += (80 * tickTime) / 9000; // Pace car runs at constant 80mph
        if (newPaceCarDist >= 1.0) newPaceCarDist -= 1.0;
        setPaceCarDistance(newPaceCarDist);
      }

      // 3. Save Standing order when Caution starts, to lock positions
      if (flag === 'yellow' && cautionOrderRef.current.length === 0) {
        const sortedStandings = [...prevDrivers].sort((a, b) => b.totalDistance - a.totalDistance);
        cautionOrderRef.current = sortedStandings.map(d => d.id);
      } else if (flag === 'green' || flag === 'white') {
        cautionOrderRef.current = []; // Clear caution standings lock
      }

      // 4. Update individual drivers
      const updatedDrivers: Driver[] = prevDrivers.map((driver): Driver => {
        // If driver is out, they don't move and speed is 0
        if (driver.status === 'out') {
          return {
            ...driver,
            speed: 0,
            rpm: 0,
            gear: 1,
            throttle: 0,
            brake: 0
          };
        }

        // Scripted retirements
        if (mode === 'scripted') {
          if (leaderLap >= 35 && driver.carNumber === '51') {
            return { ...driver, status: 'out', outReason: 'Crash Turn 4', speed: 0, throttle: 0, brake: 0 };
          }
          if (leaderLap >= 110 && driver.carNumber === '24') {
            return { ...driver, status: 'out', outReason: 'Engine Failure', speed: 0, throttle: 0, brake: 0 };
          }
          if (leaderLap >= 150 && (driver.carNumber === '77' || driver.carNumber === '41')) {
            return { ...driver, status: 'out', outReason: 'Crash Turn 2', speed: 0, throttle: 0, brake: 0 };
          }
          if (leaderLap >= 185 && driver.carNumber === '7') {
            return { ...driver, status: 'out', outReason: 'Crash Front Stretch', speed: 0, throttle: 0, brake: 0 };
          }
        }

        // Determine track position zones (straightaways vs corners)
        const dist = driver.distanceIntoLap;
        const isCorner = 
          (dist >= 0.15 && dist <= 0.225) || // Turn 1
          (dist >= 0.25 && dist <= 0.325) || // Turn 2
          (dist >= 0.65 && dist <= 0.725) || // Turn 3
          (dist >= 0.75 && dist <= 0.825);   // Turn 4

        let targetSpeed = 220; // Default
        let targetThrottle = 100;
        let targetBrake = 0;

        // Decelerate/Accelerate based on flag
        if (flag === 'yellow') {
          targetSpeed = 80;
          targetThrottle = 35;
          targetBrake = 0;
          
          // Bunch up logic
          if (cautionOrderRef.current.length > 0) {
            const cautionRank = cautionOrderRef.current.indexOf(driver.id);
            
            if (cautionRank === 0) {
              // Leader follows the Pace Car
              const distToPaceCar = (paceCarDistance - dist + 1) % 1;
              if (distToPaceCar > 0.02) {
                targetSpeed = 95; // Catch up
                targetThrottle = 50;
              } else if (distToPaceCar < 0.008) {
                targetSpeed = 70; // Back off
                targetThrottle = 20;
                targetBrake = 10;
              }
            } else if (cautionRank > 0) {
              // Follow the car in front
              const carInFrontId = cautionOrderRef.current[cautionRank - 1];
              const carInFront = prevDrivers.find(d => d.id === carInFrontId);
              if (carInFront) {
                const distToFront = (carInFront.distanceIntoLap - dist + 1) % 1;
                const targetGap = 0.005; // Tight bunch spacing
                
                if (distToFront > targetGap + 0.003) {
                  targetSpeed = 90; // Close the gap
                  targetThrottle = 45;
                } else if (distToFront < targetGap - 0.001) {
                  targetSpeed = 72; // Brake to avoid collision
                  targetThrottle = 15;
                  targetBrake = 15;
                }
              }
            }
          }
        } else if (driver.status === 'pitting') {
          // Pit road logic
          // Pit entry starts around 0.90, exit around 0.15
          if (dist >= 0.90 || dist <= 0.15) {
            targetSpeed = 60; // Pit road speed limit
            targetThrottle = 30;
            
            // Check if at pit box (simulated around 0.98)
            const atPitBox = dist >= 0.96 && dist <= 0.98;
            if (atPitBox && (driver.pitTimeRemaining === undefined || driver.pitTimeRemaining > 0)) {
              // Stop!
              targetSpeed = 0;
              targetThrottle = 0;
              targetBrake = 100;
            }
          }
        } else {
          // GREEN / WHITE FLAG racing physics
          const speedMultiplierSkill = driver.skillRatings.baseSpeed;
          
          if (isCorner) {
            targetSpeed = 190 * speedMultiplierSkill;
            targetThrottle = 75 + Math.random() * 10;
            targetBrake = Math.random() * 8;
          } else {
            targetSpeed = 230 * speedMultiplierSkill;
            targetThrottle = 100;
            targetBrake = 0;
            
            // Draft effect
            // Look for a car within 0.03 ahead (close draft)
            const aheadCar = prevDrivers
              .filter(d => d.id !== driver.id && d.status === 'running')
              .find(d => {
                const diff = (d.distanceIntoLap - dist + 1) % 1;
                return diff > 0.005 && diff < 0.025;
              });
              
            if (aheadCar) {
              targetSpeed += 6.5; // Draft speed boost
            }
          }

          // Tire wear degradation effect
          const avgTireWear = (driver.tireWear.lf + driver.tireWear.rf + driver.tireWear.lr + driver.tireWear.rr) / 4;
          if (avgTireWear < 60) {
            // Tires losing grip
            targetSpeed -= (60 - avgTireWear) * 0.3;
          }
        }

        // Apply smooth speed transition
        let currentSpeed = driver.speed;
        const accelRate = 4 * speedMultiplier; // Speed change rate per tick
        if (currentSpeed < targetSpeed) {
          currentSpeed = Math.min(currentSpeed + accelRate, targetSpeed);
        } else if (currentSpeed > targetSpeed) {
          currentSpeed = Math.max(currentSpeed - accelRate * 1.5, targetSpeed);
        }

        // Keep speed positive
        currentSpeed = Math.max(currentSpeed, 0);

        // Simulated gear and RPM
        let gear = 6;
        if (currentSpeed < 65) gear = 1;
        else if (currentSpeed < 100) gear = 2;
        else if (currentSpeed < 140) gear = 3;
        else if (currentSpeed < 170) gear = 4;
        else if (currentSpeed < 200) gear = 5;
        
        let rpm = 0;
        if (currentSpeed > 0) {
          const baseRpmForGear = [0, 5000, 6500, 7800, 8800, 9500, 10200];
          rpm = baseRpmForGear[gear] + ((currentSpeed % 40) / 40) * 1800;
          rpm = Math.min(Math.max(rpm, 4000), 12000);
        } else {
          rpm = driver.status === 'pitting' && driver.fuel < 98 ? 1000 : 0; // idle vs dead engine
        }

        // Tire wear and Fuel consumption (only when moving)
        let fuel = driver.fuel;
        let tireWear = { ...driver.tireWear };
        let pitStops = driver.pitStops;
        let lastPitLap = driver.lastPitLap;
        let status = driver.status;
        let pitTimeRemaining = driver.pitTimeRemaining;

        if (currentSpeed > 0) {
          // Yellow flag burns 4x less fuel/tires
          const degradationFactor = flag === 'yellow' ? 0.25 : 1.0;
          const consumption = 0.00007 * speedMultiplier * degradationFactor;
          
          fuel = Math.max(fuel - consumption * 1.1, 0);
          
          // Indy ovals put heavy wear on Right-Front (RF) and Right-Rear (RR) tires
          tireWear.lf = Math.max(tireWear.lf - consumption * 0.8, 0);
          tireWear.rf = Math.max(tireWear.rf - consumption * 1.4, 0); // RF wears fastest
          tireWear.lr = Math.max(tireWear.lr - consumption * 0.9, 0);
          tireWear.rr = Math.max(tireWear.rr - consumption * 1.2, 0);
        }

        // Automatic pitting logic (only in sandbox/scripted modes, not broadcast sync)
        const avgTire = (tireWear.lf + tireWear.rf + tireWear.lr + tireWear.rr) / 4;
        if (mode !== 'live' && status === 'running' && flag === 'green' && (fuel < 12 || avgTire < 35)) {
          // Pit next time we reach front stretch entry
          if (dist >= 0.85 && dist <= 0.92) {
            status = 'pitting';
            pitTimeRemaining = 7.0 + Math.random() * 2.5; // 7.0 to 9.5 seconds
            addEvent('info', `${driver.name} (Car #${driver.carNumber}) enters pit road.`, flag);
          }
        }

        // Stopped in pit box refuels/retreads
        if (status === 'pitting' && currentSpeed === 0) {
          if (pitTimeRemaining === undefined) {
            pitTimeRemaining = 7.0 + Math.random() * 2.0; // 7-9 seconds default if undefined
          }

          // Decrement pit time remaining by simulation tickTime
          pitTimeRemaining = Math.max(pitTimeRemaining - tickTime, 0);

          // Refuel & change tires at a realistic rate
          // A standard stop is ~8 seconds. We want to reach 100% in that time.
          fuel = Math.min(fuel + 12.5 * tickTime, 100);
          tireWear.lf = Math.min(tireWear.lf + 25 * tickTime, 100);
          tireWear.rf = Math.min(tireWear.rf + 25 * tickTime, 100);
          tireWear.lr = Math.min(tireWear.lr + 25 * tickTime, 100);
          tireWear.rr = Math.min(tireWear.rr + 25 * tickTime, 100);

          if (pitTimeRemaining === 0) {
            pitStops += 1;
            lastPitLap = driver.lap;
            // Complete pit stop
            addEvent('info', `${driver.name} (Car #${driver.carNumber}) service complete. Departing pit stall.`, flag);
          }
        }

        // Advance position along track
        let distanceIntoLap = dist;
        let driverLap = driver.lap;

        if (currentSpeed > 0) {
          distanceIntoLap += (currentSpeed * tickTime) / 9000;
          
          if (distanceIntoLap >= 1.0) {
            distanceIntoLap -= 1.0;
            driverLap += 1;
          }

          // Release pitting status once exiting pit lane (around Turn 1 entry, 0.15)
          if (status === 'pitting' && distanceIntoLap >= 0.15 && distanceIntoLap <= 0.50) {
            status = 'running';
            pitTimeRemaining = undefined;
          }
        }

        // 3-wide start and racing line lateral offset simulation
        let targetOffset = 0;
        const isStartGrid = (driverLap === 0 && flag === 'yellow') || (driverLap === 0 && distanceIntoLap < 0.92);
        
        if (isStartGrid) {
          const gridCol = (driver.startingPos - 1) % 3;
          targetOffset = (gridCol === 0) ? -7 : (gridCol === 1) ? 0 : 7;
        } else if (flag === 'yellow') {
          targetOffset = 0; // Bunch up single file behind pace car
        } else {
          // Green flag active racing
          if (isCorner) {
            targetOffset = -3; // Hug the inside line in corners
          } else {
            targetOffset = 0; // Default center straightaway line
          }
          
          // Overtaking offset
          const carAhead = prevDrivers.find(d => {
            if (d.id === driver.id || d.status !== 'running') return false;
            const diff = d.totalDistance - driver.totalDistance;
            // Car within 200 feet ahead
            return diff > 0.002 && diff < 0.012;
          });
          
          if (carAhead) {
            // Pull out of line (inside or outside depending on driver ID parity)
            targetOffset = (parseInt(driver.id) % 2 === 0) ? 6 : -6;
          }
        }

        const currentOffset = driver.lateralOffset !== undefined ? driver.lateralOffset : 0;
        // Smoothly interpolate towards target offset
        const newOffset = currentOffset + (targetOffset - currentOffset) * Math.min(0.04 * speedMultiplier, 1.0);
        const clampedOffset = Math.max(Math.min(newOffset, 9), -9);

        // Update telemetry history (for the active driver details graph, cap history size)
        const historyPoint: TelemetryPoint = {
          time: simTimeRef.current,
          speed: Math.round(currentSpeed),
          throttle: Math.round(targetThrottle),
          brake: Math.round(targetBrake),
          rpm: Math.round(rpm)
        };
        const telemetryHistory = [...driver.telemetryHistory, historyPoint].slice(-60); // Last 60 points (6 seconds of data)

        return {
          ...driver,
          speed: Math.round(currentSpeed),
          rpm: Math.round(rpm),
          gear,
          throttle: Math.round(targetThrottle),
          brake: Math.round(targetBrake),
          fuel: Math.round(fuel),
          tireWear: {
            lf: Math.round(tireWear.lf),
            rf: Math.round(tireWear.rf),
            lr: Math.round(tireWear.lr),
            rr: Math.round(tireWear.rr)
          },
          distanceIntoLap,
          lap: driverLap,
          totalDistance: driverLap + distanceIntoLap,
          status,
          pitStops,
          lastPitLap,
          pitTimeRemaining,
          telemetryHistory,
          lateralOffset: clampedOffset
        };
      });

      // 5. Standings Sorting
      // If we are under yellow, positions are locked, sorting remains unchanged.
      // Otherwise under Green, we sort by totalDistance descending to update ranks.
      let sortedDrivers = [...updatedDrivers];
      
      if (flag !== 'yellow') {
        const running = sortedDrivers.filter(d => d.status !== 'out');
        const retired = sortedDrivers.filter(d => d.status === 'out');
        
        // Sort running by distance
        running.sort((a, b) => b.totalDistance - a.totalDistance);
        
        // retired stay at the bottom, sorted in reverse order of laps completed (or original sorting)
        retired.sort((a, b) => {
          if (b.lap !== a.lap) return b.lap - a.lap;
          return b.totalDistance - a.totalDistance;
        });

        const merged = [...running, ...retired];
        
        // Map current ranks
        return merged.map((d, index) => {
          const prevRank = prevDrivers.find(p => p.id === d.id)?.currentPos || d.startingPos;
          
          // Log Lead Changes
          if (index === 0 && prevDrivers[0] && prevDrivers[0].id !== d.id && flag === 'green') {
            // Lead changed!
            const newLeader = d.name;
            const oldLeader = prevDrivers.find(p => p.id === prevDrivers[0].id)?.name || "Unknown";
            addEvent('lead_change', `${newLeader} (Car #${d.carNumber}) passes ${oldLeader} for the lead!`, flag);
          }

          return {
            ...d,
            prevPos: prevRank,
            currentPos: index + 1
          };
        });
      } else {
        // Under yellow: standings are locked, update distances but preserve currentPos sorting from previous state
        const rankedById = [...prevDrivers].sort((a, b) => a.currentPos - b.currentPos);
        return rankedById.map(pd => {
          const updatedD = updatedDrivers.find(ud => ud.id === pd.id)!;
          return {
            ...updatedD,
            currentPos: pd.currentPos,
            prevPos: pd.prevPos
          };
        });
      }
    });
  }, [flag, speedMultiplier, mode, lap, events.length, addEvent, paceCarDistance]);

  // Ref to store latest tick to avoid stale closures in interval
  const tickRef = useRef(tick);
  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  // Set up loop interval
  useEffect(() => {
    if (isPlaying) {
      const id = setInterval(() => {
        tickRef.current();
      }, 100);
      return () => clearInterval(id);
    }
  }, [isPlaying]);

  // Handle Red flag vs Play status
  const togglePlay = () => {
    if (!isPlaying) {
      setIsPlaying(true);
      setFlag(current => (current === 'red' ? prevFlag : current));
    } else {
      setIsPlaying(false);
      setPrevFlag(flag);
      setFlag('red'); // Flag lights red under pause
    }
  };

  // ---- BROADCAST SYNC MANUAL OVERRIDES ----
  
  const syncSetFlag = useCallback((newFlag: RaceFlag, reason?: string) => {
    setFlag(newFlag);
    if (newFlag === 'yellow') {
      cautionLapsLeftRef.current = 4;
      const msg = reason || "YELLOW FLAG! Manual caution flag triggered. Field slowing down.";
      addEvent('yellow', msg, 'yellow');
    } else if (newFlag === 'green') {
      cautionLapsLeftRef.current = 0;
      addEvent('green', "GREEN FLAG! Manual restart triggered. Racing resumes!", 'green');
    } else if (newFlag === 'red') {
      addEvent('red', "RED FLAG! Race is stopped. Cars halted in the pit lane.", 'red');
    } else if (newFlag === 'white') {
      addEvent('white', "WHITE FLAG! Manual white flag triggered. Final lap!", 'white');
    } else if (newFlag === 'checkered') {
      addEvent('checkered', "CHECKERED FLAG! Manual race finish triggered.", 'checkered');
      setIsPlaying(false);
    }
  }, [addEvent]);

  const syncSetLap = useCallback((newLap: number) => {
    setLap(newLap);
    setDrivers(prev => prev.map(d => {
      if (d.status === 'out') return d;
      // Adjust driver laps. Keep their relative distances.
      return {
        ...d,
        lap: newLap,
        totalDistance: newLap + d.distanceIntoLap
      };
    }));
    addEvent('info', `Race Sync: Current race lap adjusted to Lap ${newLap}.`, flag);
  }, [addEvent, flag]);

  const syncOrderPitStop = useCallback((driverId: string) => {
    setDrivers(prev => prev.map(d => {
      if (d.id === driverId && d.status === 'running') {
        addEvent('pit', `Race Sync: Pit Stop ordered for ${d.name} (Car #${d.carNumber}).`, flag);
        return {
          ...d,
          status: 'pitting',
          distanceIntoLap: 0.92, // Place them right at pit entry
          pitTimeRemaining: 8.0
        };
      }
      return d;
    }));
  }, [addEvent, flag]);

  const syncRetireDriver = useCallback((driverId: string, reason: string) => {
    setDrivers(prev => prev.map(d => {
      if (d.id === driverId) {
        addEvent('crash', `Race Sync: ${d.name} (Car #${d.carNumber}) has retired. Reason: ${reason}.`, flag);
        return {
          ...d,
          status: 'out',
          outReason: reason,
          speed: 0,
          throttle: 0,
          brake: 0
        };
      }
      return d;
    }));
  }, [addEvent, flag]);

  const syncReinstateDriver = useCallback((driverId: string) => {
    setDrivers(prev => {
      const driver = prev.find(d => d.id === driverId);
      if (!driver || driver.status !== 'out') return prev;

      addEvent('info', `Race Sync: ${driver.name} (Car #${driver.carNumber}) has been reinstated and returned to the race.`, flag);

      return prev.map(d => {
        if (d.id === driverId) {
          return {
            ...d,
            status: 'running',
            outReason: undefined,
            speed: flag === 'yellow' ? 80 : 180,
            throttle: flag === 'yellow' ? 35 : 80,
            brake: 0
          };
        }
        return d;
      });
    });
  }, [addEvent, flag]);

  const syncMoveDriver = useCallback((driverId: string, direction: 'up' | 'down') => {
    setDrivers(prev => {
      const running = prev.filter(d => d.status !== 'out');
      const retired = prev.filter(d => d.status === 'out');
      
      // Sort running drivers by current position
      running.sort((a, b) => a.currentPos - b.currentPos);
      
      const index = running.findIndex(d => d.id === driverId);
      if (index === -1) return prev;
      
      if (direction === 'up' && index === 0) return prev;
      if (direction === 'down' && index === running.length - 1) return prev;
      
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      
      // Get all current distance values of running drivers, sorted descending
      const distances = running.map(d => d.totalDistance).sort((a, b) => b - a);
      
      // Reorder the running array: remove driver from index, insert at targetIndex
      const [movedDriver] = running.splice(index, 1);
      running.splice(targetIndex, 0, movedDriver);
      
      // Assign the sorted distance values to the new order
      const updatedRunning = running.map((d, idx) => {
        const dist = distances[idx];
        return {
          ...d,
          totalDistance: dist,
          lap: Math.floor(dist),
          distanceIntoLap: dist % 1
        };
      });
      
      const merged = [...updatedRunning, ...retired];
      
      // Update ranks immediately
      return merged.map((d, idx) => {
        if (d.status === 'out') return d;
        const newPos = idx + 1;
        return {
          ...d,
          prevPos: d.currentPos,
          currentPos: newPos
        };
      });
    });
  }, []);

  const syncSetDriverPosition = useCallback((driverId: string, targetPos: number) => {
    setDrivers(prev => {
      const running = prev.filter(d => d.status !== 'out');
      const retired = prev.filter(d => d.status === 'out');
      
      // Sort running drivers by current position
      running.sort((a, b) => a.currentPos - b.currentPos);
      
      const index = running.findIndex(d => d.id === driverId);
      if (index === -1) return prev;
      
      // Clamp targetPos between 1 and running.length
      const targetIndex = Math.max(0, Math.min(targetPos - 1, running.length - 1));
      if (index === targetIndex) return prev;
      
      // Get all current distance values of running drivers, sorted descending
      const distances = running.map(d => d.totalDistance).sort((a, b) => b - a);
      
      // Reorder the running array: remove driver from index, insert at targetIndex
      const [movedDriver] = running.splice(index, 1);
      running.splice(targetIndex, 0, movedDriver);
      
      // Assign the sorted distance values to the new order
      const updatedRunning = running.map((d, idx) => {
        const dist = distances[idx];
        return {
          ...d,
          totalDistance: dist,
          lap: Math.floor(dist),
          distanceIntoLap: dist % 1
        };
      });
      
      const merged = [...updatedRunning, ...retired];
      
      // Update ranks immediately
      return merged.map((d, idx) => {
        if (d.status === 'out') return d;
        // Find the index in the merged list
        const newPos = idx + 1;
        return {
          ...d,
          prevPos: d.currentPos,
          currentPos: newPos
        };
      });
    });
  }, []);

  const syncSetBulkPositions = useCallback((orderedCarNumbers: string[], retiredCarNumbers: string[] = []) => {
    setDrivers(prev => {
      // 1. Map and update running/retired statuses first
      const updatedStatusDrivers = prev.map(d => {
        const isRetiredInFeed = retiredCarNumbers.includes(d.carNumber);
        const isRunningInFeed = orderedCarNumbers.includes(d.carNumber);
        
        if (isRetiredInFeed && d.status === 'running') {
          return {
            ...d,
            status: 'out' as const,
            outReason: 'Retired (via Live Standings)',
            speed: 0,
            throttle: 0,
            brake: 0
          };
        } else if (isRunningInFeed && d.status === 'out') {
          return {
            ...d,
            status: 'running' as const,
            outReason: undefined,
            speed: flag === 'yellow' ? 80 : 180,
            throttle: flag === 'yellow' ? 35 : 80,
            brake: 0
          };
        }
        return d;
      });

      // 2. Separate into running and retired sets
      const running = updatedStatusDrivers.filter(d => d.status !== 'out');
      const retired = updatedStatusDrivers.filter(d => d.status === 'out');
      
      const reorderedRunning: Driver[] = [];
      const seenIds = new Set<string>();

      orderedCarNumbers.forEach(carNum => {
        const trimmed = carNum.trim();
        const matches = running.filter(d => d.carNumber === trimmed);
        const match = matches.find(d => !seenIds.has(d.id));
        if (match) {
          reorderedRunning.push(match);
          seenIds.add(match.id);
        }
      });

      const remainingRunning = running.filter(d => !seenIds.has(d.id));
      remainingRunning.sort((a, b) => a.currentPos - b.currentPos);
      
      const allRunning = [...reorderedRunning, ...remainingRunning];
      const distances = running.map(d => d.totalDistance).sort((a, b) => b - a);

      const updatedRunning = allRunning.map((d, idx) => {
        const dist = distances[idx] !== undefined ? distances[idx] : 0.88 - (idx * 0.005);
        return {
          ...d,
          totalDistance: dist,
          lap: Math.floor(dist),
          distanceIntoLap: dist % 1
        };
      });

      // Sort retired drivers to place them at the bottom in the order they appear in retiredCarNumbers if possible
      const orderedRetired: Driver[] = [];
      const seenRetiredIds = new Set<string>();
      
      retiredCarNumbers.forEach(carNum => {
        const trimmed = carNum.trim();
        const matches = retired.filter(d => d.carNumber === trimmed);
        const match = matches.find(d => !seenRetiredIds.has(d.id));
        if (match) {
          orderedRetired.push(match);
          seenRetiredIds.add(match.id);
        }
      });
      
      const remainingRetired = retired.filter(d => !seenRetiredIds.has(d.id));
      const allRetired = [...orderedRetired, ...remainingRetired];

      const merged = [...updatedRunning, ...allRetired];

      return merged.map((d, idx) => {
        const newPos = idx + 1;
        return {
          ...d,
          prevPos: d.currentPos,
          currentPos: newPos
        };
      });
    });

    addEvent('info', 'Race Sync: Leaderboard standings and retirements updated via live feed.', flag);
  }, [addEvent, flag]);

  return {
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
    setIsPlaying,
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
  };
};
