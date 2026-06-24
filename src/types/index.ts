export type BobDirective = 'explore' | 'mine' | 'protect' | 'build' | 'colonise' | 'idle';
export type TechId =
  | 'better_mining' | 'autofactory_mk2' | 'basic_drones'
  | 'scut_comms' | 'suddar'
  | 'surge_drive' | 'colony_ship'
  | 'busters' | 'medeiros_detect'
  | 'others_countermeasures';

export type StructureId = 'autofactory' | 'mine_drone' | 'suddar_array' | 'buster_cache' | 'colony_ship';
export type EventId = string;
export type SystemId = string;

export interface Vec2 { x: number; y: number; }

export interface Resource {
  metal: number;
  energy: number;
  data: number;
}

export interface Bob {
  id: number;
  name: string;
  systemId: SystemId;
  directive: BobDirective;
  trait: string;
  inTransit: boolean;
  transitTo: SystemId | null;
  transitTurnsLeft: number;
}

export interface Structure {
  id: StructureId;
  name: string;
  count: number;
}

export interface StarSystem {
  id: SystemId;
  name: string;
  pos: Vec2;
  discovered: boolean;
  colonised: boolean;
  habitable: boolean;
  resources: Resource;
  incomePerTurn: Resource;
  structures: Partial<Record<StructureId, number>>;
  bobIds: number[];
  events: GameEvent[];
  deltans: DeltanCivilisation | null;
  threat: number; // 0-100, Others presence
}

export type DeltanAge = 'stone' | 'bronze' | 'iron';
export interface DeltanCivilisation {
  population: number;
  age: DeltanAge;
  progress: number; // 0-100 toward next age
  underAttack: boolean;
  protected: boolean;
}

export interface GameEvent {
  id: EventId;
  title: string;
  description: string;
  turn: number;
  choices: EventChoice[];
  resolved: boolean;
}

export interface EventChoice {
  label: string;
  cost?: Partial<Resource>;
  effect: (state: GameState) => void;
}

export interface TechNode {
  id: TechId;
  name: string;
  description: string;
  cost: number; // data cost
  tier: number;
  requires: TechId[];
  researched: boolean;
}

export interface BuildQueueItem {
  structureId: StructureId;
  systemId: SystemId;
  turnsLeft: number;
  metalCost: number;
}

export interface GameState {
  turn: number;
  earthTimer: number; // turns until Earth collapse
  paused: boolean;
  gameOver: boolean;
  winCondition: 'none' | 'win' | 'lose';
  winMessage: string;

  systems: Record<SystemId, StarSystem>;
  bobs: Record<number, Bob>;
  nextBobId: number;
  bobNames: string[];

  globalResources: Resource; // pooled from Sol only (player's base)
  earthPopulation: number;
  coloniesEstablished: number;
  coloniesRequired: number;

  tech: Record<TechId, TechNode>;
  buildQueue: BuildQueueItem[];

  log: LogEntry[];
  activeEvent: GameEvent | null;
  selectedSystemId: SystemId | null;
}

export interface LogEntry {
  turn: number;
  message: string;
  type: 'info' | 'warning' | 'danger' | 'success';
}
