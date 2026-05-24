import React, { useState, useEffect, useRef } from 'react';
import type { RaceFlag, SimulationMode, Driver } from '../types';

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

  // --- AI AUDIO VOICE SYNC STATE & LOGIC ---
  const [audioSource, setAudioSource] = useState<'mic' | 'tab'>('mic');
  const [enableFilter, setEnableFilter] = useState<boolean>(true);
  const [isVoiceSyncActive, setIsVoiceSyncActive] = useState<boolean>(false);
  const [voiceLog, setVoiceLog] = useState<{ time: string; msg: string }[]>([]);
  const [transcriptText, setTranscriptText] = useState<string>('');
  const [showSetupGuide, setShowSetupGuide] = useState<boolean>(false);
  
  const recognitionRef = useRef<any>(null);
  const lastExecutedCommandsRef = useRef<Record<string, number>>({});
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const restartTimeoutRef = useRef<any>(null);
  const audioTrackRef = useRef<MediaStreamTrack | null>(null);
  const visualizerRef = useRef<HTMLDivElement>(null);

  const isVoiceSyncActiveRef = useRef(isVoiceSyncActive);
  useEffect(() => {
    isVoiceSyncActiveRef.current = isVoiceSyncActive;
  }, [isVoiceSyncActive]);

  const driversRef = useRef(drivers);
  useEffect(() => {
    driversRef.current = drivers;
  }, [drivers]);

  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const addVoiceEvent = (msg: string) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setVoiceLog(prev => [{ time: timeStr, msg }, ...prev].slice(0, 10));
  };

  // Spoken number to digits parser
  const extractLapNumber = (text: string): number | null => {
    const cleanText = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const words = cleanText.split(/\s+/).filter(Boolean);
    
    const lapIndex = words.findIndex(w => w === 'lap' || w === 'laps');
    if (lapIndex === -1) return null;
    
    const targetWords = words.slice(lapIndex + 1, lapIndex + 5);
    
    for (const tw of targetWords) {
      if (/^\d+$/.test(tw)) {
        return parseInt(tw, 10);
      }
    }
    
    const units: Record<string, number> = {
      zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
      ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
      seventeen: 17, eighteen: 18, nineteen: 19
    };

    const tens: Record<string, number> = {
      twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90
    };

    let currentVal = 0;
    let totalVal = 0;
    let found = false;

    for (const word of targetWords) {
      if (word === 'and') continue;
      
      if (units[word] !== undefined) {
        currentVal += units[word];
        found = true;
      } else if (tens[word] !== undefined) {
        currentVal += tens[word];
        found = true;
      } else if (word === 'hundred') {
        currentVal = (currentVal === 0 ? 1 : currentVal) * 100;
        totalVal += currentVal;
        currentVal = 0;
        found = true;
      } else {
        if (found) break;
      }
    }
    
    totalVal += currentVal;
    return found ? totalVal : null;
  };

  const processVoiceCommand = (text: string) => {
    const cleanText = text.toLowerCase();
    
    const executeDebouncedCommand = (commandKey: string, action: () => void, debounceMs = 8000) => {
      const now = Date.now();
      const lastTime = lastExecutedCommandsRef.current[commandKey] || 0;
      if (now - lastTime > debounceMs) {
        lastExecutedCommandsRef.current[commandKey] = now;
        action();
      }
    };

    // Playback start/pause general commands
    const startTriggers = [
      'start the race', 'start race', 'start the simulation', 'start simulation', 
      'start the sim', 'start sim', 'play simulation', 'play sim', 'resume simulation', 
      'resume sim', 'play the sim', 'start your engines', 'start the engine', 
      'engines are started', 'engines are fired', 'green flag is out', 'pace car is off'
    ];
    
    // Broad overlap check for "start your engines" commands (handles voice typos)
    const hasStartWord = ['start', 'fire', 'play', 'resume', 'hire', 'wire', 'buyer'].some(w => cleanText.includes(w));
    const hasEngineWord = ['engine', 'engines', 'anchor', 'anchors', 'angel', 'angels', 'inch', 'inches', 'and just', 'run', 'runs', 'agent', 'agents'].some(w => cleanText.includes(w));
    const shouldPlay = (hasStartWord && hasEngineWord) || startTriggers.some(trigger => cleanText.includes(trigger));

    const pauseTriggers = [
      'pause the race', 'pause race', 'pause the simulation', 'pause simulation',
      'pause the sim', 'pause sim', 'stop simulation', 'stop sim', 'stop the race',
      'halt the race', 'halt simulation'
    ];
    
    // Broad overlap check for "pause sim" commands
    const hasPauseWord = ['pause', 'stop', 'halt'].some(w => cleanText.includes(w));
    const hasSimWord = ['race', 'simulation', 'sim'].some(w => cleanText.includes(w));
    const shouldPause = (hasPauseWord && hasSimWord) || pauseTriggers.some(trigger => cleanText.includes(trigger));

    if (shouldPlay && !isPlayingRef.current) {
      executeDebouncedCommand('sim-play', () => {
        togglePlay();
        addVoiceEvent('Sim started via voice command');
        if (flag === 'red') {
          syncSetFlag('yellow', 'Pace laps started via voice command');
        }
      });
      return;
    } else if (shouldPause && isPlayingRef.current) {
      executeDebouncedCommand('sim-pause', () => {
        togglePlay();
        addVoiceEvent('Sim paused via voice command');
      });
      return;
    }

    // Phonetic Flag Triggers
    const greenTriggers = [
      'green flag', 'grain flag', 'grim flag', 'dream flag', 'glen flag', 'queen flag', 'cream flag', 'greene flag',
      'flag is green', 'flag is grain', 'flag is grim', 'flag is dream',
      'racing again', 'resumes', 'restart', 're-start', 'restructured',
      'green light', 'grain light', 'dream light',
      'green is out', 'grain is out', 'dream is out'
    ];

    const yellowTriggers = [
      'yellow flag', 'yeller flag', 'hello flag', 'fellow flag', 'shallow flag', 'jello flag',
      'flag is yellow', 'flag is yeller', 'flag is hello',
      'caution is out', 'cautious is out', 'costume is out', 'cosmic is out', 'coughing is out', 'cushion is out', 'collision is out', 'condition is out',
      'under caution', 'under cautious', 'under costume', 'under cosmic', 'under coughing', 'under cushion', 'under collision',
      'safety car', 'safety cap', 'shady car', 'salty car',
      'pace car', 'base car', 'face car', 'place car', 'space car', 'pay scale', 'pay scar', 'pay car',
      'full course yellow', 'full course caution',
      'debris on track', 'debrief on track', 'degrees on track', 'the breeze on track',
      'incident', 'accident', 'spin', 'crashed', 'spun'
    ];

    const redTriggers = [
      'red flag', 'read flag', 'head flag', 'led flag', 'bed flag', 'dead flag', 'rad flag', 'rid flag',
      'flag is red', 'flag is read', 'flag is head', 'flag is led',
      'race is stopped', 'race is halted', 'stopped the race'
    ];

    const whiteTriggers = [
      'white flag', 'wipe flag', 'wide flag', 'light flag', 'right flag', 'quite flag',
      'flag is white', 'flag is wipe', 'flag is wide',
      'final lap', 'one lap to go', 'last lap'
    ];

    const checkeredTriggers = [
      'checkered flag', 'chequered flag', 'checker flag', 'checkers flag', 'chicken flag', 'checking flag',
      'flag is checkered', 'flag is chequered',
      'wins the race', 'takes the win', 'winner crossing', 'takes the checkered'
    ];

    const hasGreen = cleanText.includes('green') || greenTriggers.some(t => cleanText.includes(t));
    const hasYellow = cleanText.includes('yellow') || cleanText.includes('caution') || yellowTriggers.some(t => cleanText.includes(t));
    const hasRed = cleanText.includes('red flag') || (cleanText.includes('red') && cleanText.includes('flag')) || redTriggers.some(t => cleanText.includes(t));
    const hasWhite = cleanText.includes('white') || whiteTriggers.some(t => cleanText.includes(t));
    const hasCheckered = cleanText.includes('checkered') || cleanText.includes('chequered') || checkeredTriggers.some(t => cleanText.includes(t));

    // 1. Check Flags
    if (hasGreen) {
      executeDebouncedCommand('flag-green', () => {
        syncSetFlag('green');
        addVoiceEvent('Flag synced to GREEN');
        if (!isPlayingRef.current) {
          togglePlay();
        }
      });
      return;
    }
    if (hasYellow) {
      let reason = 'Caution flag triggered via voice sync';
      if (cleanText.includes('crash') || cleanText.includes('accident') || cleanText.includes('spin') || cleanText.includes('incident')) {
        reason = 'Caution: Incident reported on track';
      } else if (cleanText.includes('debris') || cleanText.includes('breeze') || cleanText.includes('debrief')) {
        reason = 'Caution: Debris reported on track';
      }
      const r = reason;
      executeDebouncedCommand('flag-yellow', () => {
        syncSetFlag('yellow', r);
        addVoiceEvent(`Flag synced to YELLOW (${r})`);
        if (!isPlayingRef.current) {
          togglePlay();
        }
      });
      return;
    }
    if (hasRed) {
      executeDebouncedCommand('flag-red', () => {
        syncSetFlag('red');
        addVoiceEvent('Flag synced to RED');
        if (isPlayingRef.current) {
          togglePlay();
        }
      });
      return;
    }
    if (hasWhite) {
      executeDebouncedCommand('flag-white', () => {
        syncSetFlag('white');
        addVoiceEvent('Flag synced to WHITE');
      });
      return;
    }
    if (hasCheckered) {
      executeDebouncedCommand('flag-checkered', () => {
        syncSetFlag('checkered');
        addVoiceEvent('Flag synced to CHECKERED');
      });
      return;
    }

    // 2. Check Laps
    const parsedLap = extractLapNumber(cleanText);
    if (parsedLap !== null && parsedLap >= 0 && parsedLap <= 200) {
      executeDebouncedCommand(`lap-${parsedLap}`, () => {
        syncSetLap(parsedLap);
        addVoiceEvent(`Lap synced to Lap ${parsedLap}`);
      });
      return;
    }

    // 3. Check Drivers
    for (const d of driversRef.current) {
      const lastName = d.name.split(' ').pop()?.toLowerCase() || '';
      const fullName = d.name.toLowerCase();
      const carNum = d.carNumber;
      
      const customVariants = DRIVER_VOICE_VARIANTS[d.id] || [];
      const nameMentioned = cleanText.includes(lastName) || 
                            cleanText.includes(fullName) || 
                            customVariants.some(v => cleanText.includes(v));
      const carMentionRegex = new RegExp(`\\b(car|number)\\s+${carNum}\\b`);
      const carMentioned = carMentionRegex.test(cleanText);
      
      if (nameMentioned || carMentioned) {
        const pitWords = ['pit', 'pits', 'pitting', 'pit road', 'pit lane', 'box box', 'service', 'pet road', 'fit road', 'bit road', 'peat road'];
        const retireWords = [
          'out of the race', 'retired', 'crashed out', 'hit the wall', 'engine blew', 'broken down', 
          'blown engine', 'accident', 'garage', 'towed back', 'expire', 'expired'
        ];
        
        const isPitting = pitWords.some(w => cleanText.includes(w));
        const isRetiring = retireWords.some(w => cleanText.includes(w));
        
        if (isRetiring) {
          let reason = 'Retired (via Voice Sync)';
          if (cleanText.includes('engine') || cleanText.includes('blown') || cleanText.includes('blown engine')) {
            reason = 'Engine failure';
          } else if (cleanText.includes('wall') || cleanText.includes('crash') || cleanText.includes('crashed')) {
            reason = 'Accident';
          }
          const r = reason;
          executeDebouncedCommand(`retire-${d.id}`, () => {
            syncRetireDriver(d.id, r);
            addVoiceEvent(`Driver retired: ${d.name} (${r})`);
          });
          return;
        } else if (isPitting) {
          executeDebouncedCommand(`pit-${d.id}`, () => {
            syncOrderPitStop(d.id);
            addVoiceEvent(`Driver pitted: ${d.name}`);
          });
          return;
        }
      }
    }
  };

  const processVoiceCommandRef = useRef(processVoiceCommand);
  useEffect(() => {
    processVoiceCommandRef.current = processVoiceCommand;
  }, [processVoiceCommand]);

  const addVoiceEventRef = useRef(addVoiceEvent);
  useEffect(() => {
    addVoiceEventRef.current = addVoiceEvent;
  }, [addVoiceEvent]);

  // Visualizer loop using requestAnimationFrame
  useEffect(() => {
    if (!isVoiceSyncActive || audioSource !== 'tab' || !analyserRef.current) {
      // Clear visualizer heights if not active or using mic
      if (visualizerRef.current) {
        const strokes = visualizerRef.current.querySelectorAll('.stroke');
        strokes.forEach((stroke: any) => {
          stroke.style.height = ''; // Let CSS animation take over
          stroke.style.animation = '';
        });
      }
      return;
    }

    const analyser = analyserRef.current;
    analyser.fftSize = 32;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateVisualizer = () => {
      if (!analyserRef.current) return;
      analyser.getByteFrequencyData(dataArray);

      if (visualizerRef.current) {
        const strokes = visualizerRef.current.querySelectorAll('.stroke');
        strokes.forEach((stroke: any, idx: number) => {
          // Map frequency data to height (between 3px and 18px)
          const val = dataArray[idx % bufferLength] || 0;
          const height = 3 + (val / 255) * 15;
          stroke.style.height = `${height}px`;
          stroke.style.animation = 'none'; // Disable keyframe animation while driving with data
        });
      }

      animationFrameRef.current = requestAnimationFrame(updateVisualizer);
    };

    animationFrameRef.current = requestAnimationFrame(updateVisualizer);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isVoiceSyncActive, audioSource]);

  useEffect(() => {
    let active = true;

    if (!isVoiceSyncActive) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
        recognitionRef.current = null;
      }
      return;
    }

    const initSpeech = async () => {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        addVoiceEventRef.current('Speech recognition not supported in this browser.');
        setIsVoiceSyncActive(false);
        return;
      }

      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onstart = () => {
        addVoiceEventRef.current(
          audioSource === 'tab' 
            ? 'Voice Sync: Listening directly to Tab Audio...' 
            : 'Voice Sync: Listening to Microphone...'
        );
      };

      rec.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error !== 'no-speech') {
          addVoiceEventRef.current(`Error: ${event.error}`);
        }
        if (event.error === 'not-allowed') {
          setIsVoiceSyncActive(false);
        }
      };

      rec.onend = () => {
        if (isVoiceSyncActiveRef.current) {
          restartTimeoutRef.current = setTimeout(() => {
            if (!active) return;
            try {
              if (audioSource === 'tab' && audioTrackRef.current && audioTrackRef.current.readyState === 'live') {
                rec.start(audioTrackRef.current);
              } else {
                rec.start();
              }
            } catch (e) {
              console.warn('Speech recognition restart failed:', e);
            }
          }, 300);
        } else {
          addVoiceEventRef.current('Voice sync stopped.');
        }
      };

      rec.onresult = (event: any) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (interim) {
          setTranscriptText(interim);
          processVoiceCommandRef.current(interim);
        }

        if (final) {
          setTranscriptText(final);
          processVoiceCommandRef.current(final);
        }
      };

      recognitionRef.current = rec;

      if (audioSource === 'tab') {
        try {
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false
            }
          });

          if (!active) {
            displayStream.getTracks().forEach(t => t.stop());
            return;
          }

          streamRef.current = displayStream;

          const audioTracks = displayStream.getAudioTracks();
          if (audioTracks.length === 0) {
            addVoiceEventRef.current('Error: No audio track shared! Ensure you check the "Share tab audio" option.');
            setIsVoiceSyncActive(false);
            displayStream.getTracks().forEach(t => t.stop());
            return;
          }

          const rawTrack = audioTracks[0];
          rawTrack.onended = () => {
            addVoiceEventRef.current('Direct tab audio stream ended.');
            setIsVoiceSyncActive(false);
          };

          if (enableFilter) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const audioCtx = new AudioContextClass();
            audioCtxRef.current = audioCtx;

            const sourceNode = audioCtx.createMediaStreamSource(displayStream);
            
            const filterNode = audioCtx.createBiquadFilter();
            filterNode.type = 'bandpass';
            filterNode.frequency.value = 1500;
            filterNode.Q.value = 1.0; 

            const analyserNode = audioCtx.createAnalyser();
            analyserNode.fftSize = 32;
            analyserRef.current = analyserNode;

            const destNode = audioCtx.createMediaStreamDestination();

            sourceNode.connect(filterNode);
            filterNode.connect(analyserNode);
            filterNode.connect(destNode);

            const filteredTrack = destNode.stream.getAudioTracks()[0];
            audioTrackRef.current = filteredTrack;
            addVoiceEventRef.current('Engine Noise Filter applied (400Hz - 3400Hz).');
          } else {
            audioTrackRef.current = rawTrack;

            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const audioCtx = new AudioContextClass();
            audioCtxRef.current = audioCtx;

            const sourceNode = audioCtx.createMediaStreamSource(displayStream);
            const analyserNode = audioCtx.createAnalyser();
            analyserNode.fftSize = 32;
            analyserRef.current = analyserNode;

            sourceNode.connect(analyserNode);
            addVoiceEventRef.current('Raw audio capture active (no filter).');
          }
        } catch (err: any) {
          console.error('Failed to capture tab audio:', err);
          if (err.name === 'NotAllowedError') {
            addVoiceEventRef.current('Audio share cancelled by user.');
          } else {
            addVoiceEventRef.current(`Tab capture error: ${err.message}`);
          }
          setIsVoiceSyncActive(false);
          return;
        }
      }

      try {
        if (audioSource === 'tab' && audioTrackRef.current) {
          rec.start(audioTrackRef.current);
        } else {
          rec.start();
        }
      } catch (err: any) {
        console.warn('SpeechRecognition start with MediaStreamTrack failed, falling back to system mic:', err);
        addVoiceEventRef.current('Direct audio routing unsupported. Using default microphone.');
        try {
          rec.start();
        } catch (err2) {
          console.error('Fallback speech recognition failed:', err2);
        }
      }
    };

    initSpeech();

    return () => {
      active = false;
      
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
        recognitionRef.current = null;
      }

      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      
      analyserRef.current = null;
      audioTrackRef.current = null;
    };
  }, [isVoiceSyncActive, audioSource, enableFilter]);

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
    <div className="control-panel glass-panel">
      <div className="control-header">
        <h3 className="control-title">Race Control Deck</h3>
        <button className="reset-btn" onClick={resetRace}>Reset Race</button>
      </div>

      {/* Simulator Mode Selection (Full Width Row) */}
      <div className="control-section">
        <label className="stat-label">Simulator Mode</label>
        <div className="mode-select-group">
          <button className={`mode-btn ${mode === 'scripted' ? 'active' : ''}`} onClick={() => setMode('scripted')}>Scripted</button>
          <button className={`mode-btn ${mode === 'sandbox' ? 'active' : ''}`} onClick={() => setMode('sandbox')}>Sandbox</button>
          <button className={`mode-btn ${mode === 'live' ? 'active' : ''}`} onClick={() => setMode('live')}>Broadcast Sync</button>
        </div>
      </div>

      {/* Playback Controls (Full Width Row - Side-by-side inside) */}
      <div className="control-section">
        <label className="stat-label">Playback Controls</label>
        <div className="playback-group">
          <button 
            className={`play-btn ${isPlaying ? 'playing' : ''} ${flag}`} 
            onClick={togglePlay}
          >
            {isPlaying ? '⏸ PAUSE SIM' : '▶ START SIM'}
          </button>
          
          <div className="speed-selector-group">
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

          {/* AI Voice Sync Section */}
          <div style={{ marginTop: '14px', borderTop: '1px dashed rgba(255, 77, 0, 0.15)', paddingTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent)' }}>
                <span style={{ fontSize: '12px' }}>🎙️</span> AI Broadcast Voice Sync
              </label>
              {isVoiceSyncActive && (
                <div className="audio-wave" ref={visualizerRef}>
                  <span className="stroke"></span>
                  <span className="stroke"></span>
                  <span className="stroke"></span>
                  <span className="stroke"></span>
                  <span className="stroke"></span>
                </div>
              )}
            </div>

            {/* Audio Source Selection */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
              <button
                type="button"
                className={`mult-btn ${audioSource === 'mic' ? 'active' : ''}`}
                onClick={() => setAudioSource('mic')}
                disabled={isVoiceSyncActive}
                style={{
                  fontSize: '9.5px',
                  padding: '5px 4px',
                  background: audioSource === 'mic' ? 'rgba(255, 77, 0, 0.12)' : 'rgba(0,0,0,0.2)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: audioSource === 'mic' ? 'var(--accent)' : 'var(--text-secondary)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  opacity: isVoiceSyncActive ? 0.5 : 1
                }}
              >
                🎤 System Mic
              </button>
              <button
                type="button"
                className={`mult-btn ${audioSource === 'tab' ? 'active' : ''}`}
                onClick={() => setAudioSource('tab')}
                disabled={isVoiceSyncActive}
                style={{
                  fontSize: '9.5px',
                  padding: '5px 4px',
                  background: audioSource === 'tab' ? 'rgba(0, 229, 255, 0.12)' : 'rgba(0,0,0,0.2)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: audioSource === 'tab' ? 'var(--cyan-accent)' : 'var(--text-secondary)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  opacity: isVoiceSyncActive ? 0.5 : 1
                }}
              >
                💻 Direct Tab
              </button>
            </div>

            {/* Filter Toggle (only visible for Tab capture) */}
            {audioSource === 'tab' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '4px 6px', background: 'rgba(0, 229, 255, 0.04)', border: '1px solid rgba(0, 229, 255, 0.1)', borderRadius: '4px' }}>
                <span style={{ fontSize: '10px', color: '#aaa', fontWeight: '600' }}>Engine Noise Filter (Bandpass)</span>
                <button
                  type="button"
                  onClick={() => setEnableFilter(!enableFilter)}
                  disabled={isVoiceSyncActive}
                  style={{
                    background: enableFilter ? 'var(--cyan-accent)' : 'rgba(255,255,255,0.08)',
                    color: enableFilter ? '#000' : '#888',
                    border: 'none',
                    borderRadius: '3px',
                    padding: '2px 8px',
                    fontSize: '9px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    opacity: isVoiceSyncActive ? 0.5 : 1
                  }}
                >
                  {enableFilter ? 'ACTIVE' : 'BYPASS'}
                </button>
              </div>
            )}

            <button 
              type="button"
              className={`voice-sync-btn ${isVoiceSyncActive ? 'listening' : ''}`}
              onClick={() => setIsVoiceSyncActive(!isVoiceSyncActive)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: isVoiceSyncActive ? '1px solid #ff4e00' : '1px solid rgba(255,255,255,0.08)',
                background: isVoiceSyncActive ? 'rgba(255, 78, 0, 0.1)' : 'rgba(0,0,0,0.2)',
                color: isVoiceSyncActive ? '#ff6d00' : '#fff',
                fontSize: '10px',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
                boxShadow: isVoiceSyncActive ? '0 0 10px rgba(255, 78, 0, 0.15)' : 'none'
              }}
            >
              {isVoiceSyncActive ? (
                <>
                  <span className="pulse-red-dot" />
                  Stop Voice Sync
                </>
              ) : (
                <>
                  <span>🎙️</span>
                  Enable AI Audio Sync
                </>
              )}
            </button>

            {/* TV Audio Setup Guide Toggle Button */}
            <div style={{ marginTop: '6px', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => setShowSetupGuide(!showSetupGuide)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--cyan-accent)',
                  fontSize: '9px',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  letterSpacing: '0.05em',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 229, 255, 0.08)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                {showSetupGuide ? '▲ Hide Audio Setup Guide' : '💡 TV/Stream Audio Setup Guide'}
              </button>
            </div>

            {/* Collapsible Setup Guide content */}
            {showSetupGuide && (
              <div className="setup-guide-box" style={{
                marginTop: '6px',
                padding: '8px 10px',
                background: 'rgba(0,0,0,0.45)',
                border: '1px solid rgba(0, 229, 255, 0.15)',
                borderRadius: '6px',
                fontSize: '10.5px',
                color: '#ccc',
                lineHeight: '1.4'
              }}>
                {audioSource === 'tab' ? (
                  <>
                    <span style={{ color: 'var(--cyan-accent)', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>How to use Direct Tab Capture:</span>
                    <ol style={{ paddingLeft: '14px', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <li>Click <strong>Enable AI Audio Sync</strong> below.</li>
                      <li>In the browser popup, go to the <strong>Chrome Tab</strong> section.</li>
                      <li>Select the tab playing your live race stream (e.g. YouTube, Fubo).</li>
                      <li><strong style={{ color: '#fff' }}>CRITICAL:</strong> Check the <strong>"Share tab audio"</strong> box at the bottom of the popup before clicking <strong>Share</strong>.</li>
                      <li>The app will capture clean digital audio directly, and route it through the bandpass filter!</li>
                    </ol>
                  </>
                ) : (
                  <>
                    <span style={{ color: 'var(--accent)', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>How to use Microphone / Loopback:</span>
                    <ol style={{ paddingLeft: '14px', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <li>Turn up your speakers so Chrome's microphone can hear the commentators (noisy/unreliable).</li>
                      <li>Or, to bypass room noise, use a loopback tool like <strong>BlackHole 2ch</strong> (Mac) or <strong>VB-Cable</strong> (Windows).</li>
                      <li>Set your OS sound output to the loopback device, and set Chrome's default microphone input to that same loopback device.</li>
                      <li>Click <strong>Enable AI Audio Sync</strong> to listen.</li>
                    </ol>
                  </>
                )}
              </div>
            )}

            {isVoiceSyncActive && (
              <div className="transcript-box" style={{
                marginTop: '8px',
                padding: '6px 8px',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '4px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: '#888',
                minHeight: '38px',
                maxHeight: '50px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap'
              }}>
                <span style={{ color: '#aaa', fontSize: '9px', display: 'block', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hearing:</span>
                {transcriptText || 'Listening for TV commentators...'}
              </div>
            )}

            {voiceLog.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <label className="stat-label" style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Detected Events</label>
                <div style={{
                  marginTop: '4px',
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid rgba(255,255,255,0.03)',
                  borderRadius: '4px',
                  padding: '6px',
                  maxHeight: '90px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  {voiceLog.map((log, index) => (
                    <div key={index} style={{ display: 'flex', gap: '6px', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>[{log.time}]</span>
                      <span style={{ color: '#ffcc80' }}>{log.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Broadcast Sync Panel - ONLY visible in Live Mode */}
      {mode === 'live' && (
        <div className="live-sync-deck fade-in">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span className="live-badge">Broadcast Sync Active</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sync tracker with TV feed</span>
          </div>

          {/* 1. Flag Overrides */}
          <div style={{ marginBottom: '12px' }}>
            <label className="stat-label">Manual Flag Control</label>
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
              <button className="flag-override-btn green" onClick={() => syncSetFlag('green')}>Green</button>
              <button className="flag-override-btn red" onClick={() => syncSetFlag('red')}>Red</button>
              <button className="flag-override-btn white" onClick={() => syncSetFlag('white')}>White</button>
              <button className="flag-override-btn checkered" onClick={() => syncSetFlag('checkered')}>Checkered</button>
            </div>
            
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
              <input 
                type="text" 
                placeholder="Reason for yellow flag (e.g. Spin Turn 4)..." 
                value={cautionReasonInput} 
                onChange={(e) => setCautionReasonInput(e.target.value)}
                style={{ flex: 1, padding: '6px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '11px' }}
              />
              <button className="flag-override-btn yellow" onClick={handleYellowTrigger} style={{ flex: 'none', width: '110px' }}>Trigger Caution</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '12px' }}>
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
                  style={{ width: '50px', padding: '6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', color: '#fff', textAlign: 'center', fontSize: '12px' }}
                />
                <button type="submit" className="sync-btn">Set Lap</button>
              </div>
            </form>

            {/* 3. Driver Live Control */}
            <div>
              <label className="stat-label">Incident Controller</label>
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <select 
                  value={selectedDriverId} 
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)', background: '#121218', color: '#fff', fontSize: '11px', width: '100%' }}
                >
                  <option value="">Select Driver...</option>
                  {activeDrivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      #{d.carNumber} - {d.name.split(' ')[1]}
                    </option>
                  ))}
                </select>
              </div>

              {selectedDriverId && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                  <button className="sync-driver-action pit" onClick={handlePit}>Force Pit Stop</button>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <select 
                      value={retireReason}
                      onChange={(e) => setRetireReason(e.target.value)}
                      style={{ padding: '4px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)', background: '#121218', color: '#fff', fontSize: '10px', flex: 1, minWidth: 0 }}
                    >
                      <option value="Crash Turn 1">Crash Turn 1</option>
                      <option value="Crash Turn 2">Crash Turn 2</option>
                      <option value="Crash Turn 3">Crash Turn 3</option>
                      <option value="Crash Turn 4">Crash Turn 4</option>
                      <option value="Crash Front Stretch">Crash Front Wall</option>
                      <option value="Crash Backstretch">Crash Backstretch</option>
                      <option value="Engine Blowout">Engine Failure</option>
                      <option value="Gearbox Failure">Gearbox Failure</option>
                    </select>
                    <button className="sync-driver-action retire" onClick={handleRetire}>Retire</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Styles */}
      <style>{`
        .pulse-red-dot {
          width: 8px;
          height: 8px;
          background: #ff1744;
          border-radius: 50%;
          display: inline-block;
          box-shadow: 0 0 6px #ff1744;
          animation: dot-pulse 1.5s infinite ease-in-out;
        }

        @keyframes dot-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.5; }
        }

        .audio-wave {
          display: flex;
          align-items: flex-end;
          gap: 2.5px;
          height: 12px;
        }

        .audio-wave .stroke {
          display: block;
          position: relative;
          background: #ff6d00;
          height: 100%;
          width: 2px;
          border-radius: 50px;
          animation: wave-rise 1.2s infinite ease-in-out;
        }

        .audio-wave .stroke:nth-child(1) { animation-delay: 0.0s; }
        .audio-wave .stroke:nth-child(2) { animation-delay: 0.3s; }
        .audio-wave .stroke:nth-child(3) { animation-delay: 0.6s; }
        .audio-wave .stroke:nth-child(4) { animation-delay: 0.9s; }
        .audio-wave .stroke:nth-child(5) { animation-delay: 0.2s; }

        @keyframes wave-rise {
          0%, 100% { height: 3px; }
          50% { height: 12px; }
        }

        .control-panel {
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .control-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          padding-bottom: 8px;
        }

        .control-title {
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-primary);
        }

        .control-section {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .mode-select-group {
          display: flex;
          background: rgba(0,0,0,0.25);
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 6px;
          padding: 2.5px;
          width: 100%;
        }

        .mode-btn {
          flex: 1;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          padding: 6px 4px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          cursor: pointer;
          border-radius: 4px;
          transition: all var(--transition-fast);
          letter-spacing: 0.05em;
        }

        .mode-btn:hover {
          color: #fff;
          background: rgba(255,255,255,0.02);
        }

        .mode-btn.active {
          background: var(--accent);
          color: #fff;
          box-shadow: 0 2px 8px var(--accent-glow);
        }

        .playback-group {
          display: flex;
          gap: 8px;
          align-items: center;
          width: 100%;
        }

        .play-btn {
          flex: 1.2;
          padding: 8px 12px;
          border-radius: 6px;
          border: 1.5px solid var(--flag-green);
          background: rgba(0, 230, 118, 0.03);
          color: #fff;
          font-weight: 700;
          font-size: 10px;
          text-transform: uppercase;
          cursor: pointer;
          transition: all var(--transition-fast);
          letter-spacing: 0.05em;
          text-align: center;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        }

        .play-btn.red {
          border-color: var(--flag-red);
          background: rgba(255, 23, 68, 0.03);
        }

        .play-btn.yellow {
          border-color: var(--flag-yellow);
          background: rgba(255, 214, 0, 0.03);
          color: var(--flag-yellow);
        }

        .play-btn:hover {
          background: rgba(255,255,255,0.05);
          filter: brightness(1.15);
        }

        .play-btn.playing {
          animation: play-pulse 2s infinite ease-in-out;
        }

        @keyframes play-pulse {
          0%, 100% { box-shadow: 0 0 2px rgba(255,255,255,0.05); }
          50% { box-shadow: 0 0 10px var(--accent-glow); }
        }

        .speed-selector-group {
          display: flex;
          flex: 1.8;
          background: rgba(0,0,0,0.25);
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 6px;
          padding: 2.5px;
        }

        .mult-btn {
          flex: 1;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-size: 9.5px;
          font-weight: 700;
          cursor: pointer;
          border-radius: 4px;
          padding: 7px 2px;
          transition: all var(--transition-fast);
        }

        .mult-btn:hover:not(:disabled) {
          color: #fff;
          background: rgba(255,255,255,0.02);
        }

        .mult-btn:disabled {
          opacity: 0.2;
          cursor: not-allowed;
        }

        .mult-btn.active:not(:disabled) {
          background: rgba(255,255,255,0.08);
          color: var(--cyan-accent);
          font-weight: 800;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }

        .reset-btn {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          color: var(--text-secondary);
          padding: 3px 8px;
          font-size: 10px;
          font-weight: 600;
          border-radius: 4px;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .reset-btn:hover {
          background: rgba(255, 23, 68, 0.08);
          border-color: rgba(255, 23, 68, 0.3);
          color: var(--flag-red);
        }

        .live-sync-deck {
          background: rgba(255, 77, 0, 0.015);
          border: 1px solid rgba(255, 77, 0, 0.12);
          border-radius: 6px;
          padding: 10px;
          margin-top: 2px;
        }

        .flag-override-btn {
          flex: 1;
          padding: 5px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all var(--transition-fast);
        }

        .flag-override-btn.green {
          background: rgba(0, 230, 118, 0.1);
          border-color: rgba(0, 230, 118, 0.2);
          color: var(--flag-green);
        }
        .flag-override-btn.green:hover { background: rgba(0, 230, 118, 0.25); }

        .flag-override-btn.yellow {
          background: rgba(255, 214, 0, 0.1);
          border-color: rgba(255, 214, 0, 0.2);
          color: var(--flag-yellow);
        }
        .flag-override-btn.yellow:hover { background: rgba(255, 214, 0, 0.25); }

        .flag-override-btn.red {
          background: rgba(255, 23, 68, 0.15);
          border-color: rgba(255, 23, 68, 0.2);
          color: var(--flag-red);
        }
        .flag-override-btn.red:hover { background: rgba(255, 23, 68, 0.25); }

        .flag-override-btn.white {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
          color: var(--flag-white);
        }
        .flag-override-btn.white:hover { background: rgba(255, 255, 255, 0.15); }

        .flag-override-btn.checkered {
          background: rgba(255, 255, 255, 0.03);
          border-color: rgba(255, 255, 255, 0.15);
          color: #fff;
        }
        .flag-override-btn.checkered:hover { background: rgba(255, 255, 255, 0.1); }
        
        .sync-btn {
          background: var(--accent);
          border: none;
          color: #fff;
          padding: 5px 10px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          cursor: pointer;
        }
        .sync-btn:hover { opacity: 0.9; }

        .sync-driver-action {
          border: 1px solid transparent;
          color: #fff;
          padding: 5px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          cursor: pointer;
          width: 100%;
          transition: all var(--transition-fast);
          text-align: center;
        }
        .sync-driver-action.pit {
          background: rgba(0, 229, 255, 0.1);
          border-color: rgba(0, 229, 255, 0.25);
          color: var(--cyan-accent);
        }
        .sync-driver-action.pit:hover { background: rgba(0, 229, 255, 0.2); }
        
        .sync-driver-action.retire {
          background: rgba(255, 23, 68, 0.1);
          border-color: rgba(255, 23, 68, 0.2);
          color: var(--flag-red);
          flex: 1;
        }
        .sync-driver-action.retire:hover { background: rgba(255, 23, 68, 0.2); }
      `}</style>
    </div>
  );
};
