export interface StructureDef {
  id: string;
  name: string;
  description: string;
  metalCost: number;
  buildTurns: number;
  requires?: string; // tech id
}

export const STRUCTURES: Record<string, StructureDef> = {
  mine_drone: {
    id: 'mine_drone',
    name: 'Mine Drone',
    description: '+4 metal/turn in this system.',
    metalCost: 30,
    buildTurns: 2,
  },
  autofactory: {
    id: 'autofactory',
    name: 'Autofactory',
    description: 'Reduces build turns for all future structures in this system by 1 (min 1).',
    metalCost: 80,
    buildTurns: 3,
  },
  suddar_array: {
    id: 'suddar_array',
    name: 'SUDDAR Array',
    description: 'Reveals all adjacent undiscovered systems. Detects incoming threats 2 turns early.',
    metalCost: 60,
    buildTurns: 3,
    requires: 'suddar',
  },
  buster_cache: {
    id: 'buster_cache',
    name: 'Buster Cache',
    description: 'Protects Deltans from gorilloid attacks. Slows Others threat growth.',
    metalCost: 50,
    buildTurns: 2,
    requires: 'basic_drones',
  },
  colony_ship: {
    id: 'colony_ship',
    name: 'Colony Ship',
    description: 'Moves 2,500 humans from Earth to a habitable planet in this system. One-time use.',
    metalCost: 300,
    buildTurns: 8,
    requires: 'colony_ship',
  },
};
