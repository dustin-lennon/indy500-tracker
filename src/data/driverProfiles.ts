export interface DriverProfileData {
  age: number;
  nationality: string;
  indy500Wins: number;
  championships: number;
  qualifyingSpeed: number;
  bio: string;
}

export const DRIVER_PROFILES: Record<string, DriverProfileData> = {
  '1': {
    age: 29,
    nationality: 'Spain',
    indy500Wins: 0,
    championships: 2,
    qualifyingSpeed: 234.220,
    bio: 'Alex Palou secured the pole position for the 2026 Indy 500. A double IndyCar Series champion for Chip Ganassi Racing, the Spanish star is known for his cool head, clinical consistency, and flawless race execution.'
  },
  '2': {
    age: 34,
    nationality: 'USA',
    indy500Wins: 1,
    championships: 0,
    qualifyingSpeed: 233.910,
    bio: 'Winner of the historic 100th Running of the Indianapolis 500 in 2016. Rossi represents Ed Carpenter Racing in 2026, bringing an elite blend of veteran patience and raw qualifying speed.'
  },
  '3': {
    age: 24,
    nationality: 'USA',
    indy500Wins: 0,
    championships: 0,
    qualifyingSpeed: 233.810,
    bio: "Lining up in Row 1 for Team Penske, Malukas is one of IndyCar's brightest young stars. His oval capability makes him a prime contender to capture his first Borg-Warner trophy in the 2026 race."
  },
  '4': {
    age: 34,
    nationality: 'Sweden',
    indy500Wins: 0,
    championships: 0,
    qualifyingSpeed: 233.640,
    bio: 'A versatile Swedish racing driver with successes in Formula E, DTM, and IndyCar. Driving for Meyer Shank Racing, Felix is known for pushing the car to the absolute limit in qualifying trim.'
  },
  '5': {
    age: 27,
    nationality: 'USA',
    indy500Wins: 0,
    championships: 0,
    qualifyingSpeed: 233.510,
    bio: 'Always a standout performer at Indianapolis. Ferrucci has an incredible record of top-10 finishes at the Speedway, driving AJ Foyt Racing with extreme aggression and high-line bravery.'
  },
  '6': {
    age: 27,
    nationality: 'Mexico',
    indy500Wins: 0,
    championships: 0,
    qualifyingSpeed: 233.450,
    bio: "The crowd favorite from Arrow McLaren. Pato is famous for his spectacular, high-risk driving style and heart-stopping battles at IMS, having finished runner-up twice in 2022 and 2024."
  },
  '10': {
    age: 45,
    nationality: 'New Zealand',
    indy500Wins: 1,
    championships: 6,
    qualifyingSpeed: 233.110,
    bio: 'The Iceman. Dixon is a 6-time IndyCar champion and the 2008 Indy 500 Winner. He holds the record for most laps led at IMS and is the master of fuel saving and tire management strategy.'
  },
  '12': {
    age: 49,
    nationality: 'Japan',
    indy500Wins: 2,
    championships: 0,
    qualifyingSpeed: 232.950,
    bio: 'Two-time Indianapolis 500 Winner (2017, 2020) and legendary Japanese racer. Sato returns to Rahal Letterman Lanigan Racing as a veteran threat under the mantra "No Attack, No Chance."'
  },
  '14': {
    age: 51,
    nationality: 'Brazil',
    indy500Wins: 4,
    championships: 0,
    qualifyingSpeed: 232.880,
    bio: 'A member of the legendary four-time Indy 500 winners club (2001, 2002, 2009, 2021). Helio drives for Meyer Shank Racing, always bringing his famous fence-climbing celebrations.'
  },
  '17': {
    age: 35,
    nationality: 'Sweden',
    indy500Wins: 1,
    championships: 0,
    qualifyingSpeed: 232.550,
    bio: 'The 2022 Indy 500 Winner. Ericsson drives for Andretti Global in 2026, bringing Swedish cool, high racing IQ, and strong late-race oval setups to the Borg-Warner hunt.'
  },
  '19': {
    age: 45,
    nationality: 'Australia',
    indy500Wins: 1,
    championships: 2,
    qualifyingSpeed: 232.410,
    bio: 'A modern legend. The 2018 Indy 500 Winner and double series champion, Power is the all-time record holder for IndyCar pole positions and drives Andretti Global with relentless focus.'
  },
  '23': {
    age: 35,
    nationality: 'USA',
    indy500Wins: 2,
    championships: 2,
    qualifyingSpeed: 232.120,
    bio: 'The back-to-back Indy 500 Winner (2023, 2024). Team Penske\'s American superstar is a master of oval strategy, aggressive restarts, and defensive positioning.'
  },
  '24': {
    age: 40,
    nationality: 'France',
    indy500Wins: 0,
    championships: 0,
    qualifyingSpeed: 231.980,
    bio: 'The former Haas F1 driver, known as the "Phoenix" after surviving a dramatic F1 crash. Romain has embraced the wild nature of IndyCar racing, representing Dale Coyne Racing.'
  },
  '25': {
    age: 27,
    nationality: 'Germany',
    indy500Wins: 0,
    championships: 0,
    qualifyingSpeed: 231.950,
    bio: 'Son of 7-time F1 World Champion Michael Schumacher. Mick has transitioned to the NTT IndyCar Series with RLL to challenge the speedway ovals and carve out his own legacy.'
  },
  '26': {
    age: 23,
    nationality: 'Norway',
    indy500Wins: 0,
    championships: 0,
    qualifyingSpeed: 231.850,
    bio: 'Reigning 2025 Indy NXT Champion making his rookie debut. The Norwegian sensation drives the No. 19 Honda for Dale Coyne Racing, showing quick adaptation and extreme natural talent on ovals.'
  },
  '29': {
    age: 25,
    nationality: 'USA',
    indy500Wins: 0,
    championships: 0,
    qualifyingSpeed: 231.351,
    bio: 'Indy NXT standout making his rookie Indy 500 debut with family-run Abel Motorsports. Jacob is a rising star in American open-wheel racing, showing great promise on ovals.'
  }
};

// Programmatic fallback generator for rest of the grid
export const getDriverProfile = (id: string, name: string, team: string, startingPos: number): DriverProfileData => {
  if (DRIVER_PROFILES[id]) return DRIVER_PROFILES[id];
  
  // Custom heuristics based on name
  let nationality = 'USA';
  if (name.includes('Collet')) nationality = 'Brazil';
  else if (name.includes('Hauger')) nationality = 'Norway';
  else if (name.includes('VeeKay')) nationality = 'Netherlands';
  else if (name.includes('Foster')) nationality = 'United Kingdom';
  else if (name.includes('Armstrong')) nationality = 'New Zealand';
  else if (name.includes('Lundgaard') || name.includes('Rasmussen')) nationality = 'Denmark';
  else if (name.includes('Fittipaldi')) nationality = 'Brazil';
  else if (name.includes('Schumacher')) nationality = 'Germany';
  else if (name.includes('Rosenqvist') || name.includes('Ericsson')) nationality = 'Sweden';
  else if (name.includes('Palou')) nationality = 'Spain';
  else if (name.includes('Castroneves')) nationality = 'Brazil';

  // Realistic generated stats
  const age = 22 + (parseInt(id) * 7) % 19;
  const indy500Wins = 0;
  const championships = 0;
  const qualifyingSpeed = parseFloat((234.1 - startingPos * 0.08).toFixed(3));
  const bio = `${name} competes for ${team} in the 110th Indianapolis 500. Starting from P${startingPos} on the grid, this driver represents a vital contender in the 2026 oval championship hunt.`;

  return {
    age,
    nationality,
    indy500Wins,
    championships,
    qualifyingSpeed,
    bio
  };
};
