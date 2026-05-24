export type RaceFlag = 'green' | 'yellow' | 'red' | 'white' | 'checkered';

export type SimulationMode = 'sandbox' | 'scripted' | 'live';

export interface TelemetryPoint {
  time: number; // in-simulation seconds or sequence index
  speed: number;
  throttle: number;
  brake: number;
  rpm: number;
}

export interface Driver {
  id: string;
  name: string;
  carNumber: string;
  team: string;
  carColor: string; // Hex representation of team livery
  startingPos: number;
  currentPos: number;
  prevPos: number;
  status: 'running' | 'pitting' | 'out';
  outReason?: string;
  pitStops: number;
  lastPitLap: number;
  lap: number; // 0 - 200
  distanceIntoLap: number; // 0.0 - 1.0 (coordinate along SVG path)
  totalDistance: number; // lap + distanceIntoLap, used for sorting standings
  speed: number; // MPH
  rpm: number;
  gear: number;
  throttle: number; // 0 - 100%
  brake: number; // 0 - 100%
  fuel: number; // 0 - 100%
  tireWear: {
    lf: number; // Left Front 0-100% (100% is brand new, 0% is bald)
    rf: number; // Right Front
    lr: number; // Left Rear
    rr: number; // Right Rear
  };
  telemetryHistory: TelemetryPoint[];
  lateralOffset?: number; // Lateral offset for 3-wide start and racing lines (optional)
  
  // Skill ratings for the simulation engine
  skillRatings: {
    baseSpeed: number; // multiplier around 220mph
    consistency: number; // 0-100, higher means less speed fluctuation
    pitStrategy: number; // lap timing variation
    accidentAvoidance: number; // 0-100, higher means lower chance of crashing
  };
}

export interface RaceEvent {
  id: string;
  lap: number;
  time: string; // Formatted race clock e.g. "01:24:53"
  type: 'green' | 'yellow' | 'red' | 'white' | 'checkered' | 'pit' | 'lead_change' | 'crash' | 'info' | 'restart';
  message: string;
  flagColor: RaceFlag;
}
