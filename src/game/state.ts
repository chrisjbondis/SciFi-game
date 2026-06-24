import type { GameState, Bob } from '../types';
import { INITIAL_SYSTEMS } from '../data/systems';
import { INITIAL_TECH } from '../data/tech';

const BOB_NAMES = ['Bob', 'Riker', 'Bill', 'Milo', 'Calvin', 'Linus', 'Homer', 'Mario', 'Khan', 'Howard'];
const BOB_TRAITS = ['methodical', 'curious', 'cautious', 'bold', 'sarcastic', 'pragmatic', 'empathetic', 'analytical'];

function randomTrait(): string {
  return BOB_TRAITS[Math.floor(Math.random() * BOB_TRAITS.length)];
}

export function createInitialState(): GameState {
  const bobPrime: Bob = {
    id: 1,
    name: 'Bob',
    systemId: 'sol',
    directive: 'build',
    trait: 'methodical',
    inTransit: false,
    transitTo: null,
    transitTurnsLeft: 0,
  };

  return {
    turn: 1,
    earthTimer: 150,
    paused: false,
    gameOver: false,
    winCondition: 'none',
    winMessage: '',

    systems: structuredClone(INITIAL_SYSTEMS),
    bobs: { 1: bobPrime },
    nextBobId: 2,
    bobNames: BOB_NAMES,

    globalResources: { metal: 100, energy: 100, data: 20 },
    earthPopulation: 15_000_000,
    coloniesEstablished: 0,
    coloniesRequired: 2,

    tech: structuredClone(INITIAL_TECH),
    buildQueue: [],

    log: [{ turn: 1, message: 'Bob-1 online. Systems nominal. GUPPI interface active. Time to get to work.', type: 'success' }],
    activeEvent: null,
    selectedSystemId: 'sol',
  };
}

export function replicateBob(state: GameState, sourceSystemId: string): boolean {
  const REPLICATION_COST = 200;
  if (state.globalResources.metal < REPLICATION_COST) return false;
  if (state.nextBobId > state.bobNames.length) return false;

  state.globalResources.metal -= REPLICATION_COST;

  const newBob: Bob = {
    id: state.nextBobId,
    name: state.bobNames[state.nextBobId - 1],
    systemId: sourceSystemId,
    directive: 'idle',
    trait: randomTrait(),
    inTransit: false,
    transitTo: null,
    transitTurnsLeft: 0,
  };

  state.bobs[state.nextBobId] = newBob;
  state.systems[sourceSystemId].bobIds.push(state.nextBobId);
  state.nextBobId++;

  addLog(state, `New Bob copy created: ${newBob.name} (${newBob.trait}). Awaiting directive.`, 'success');
  return true;
}

export function sendBob(state: GameState, bobId: number, targetSystemId: string, travelTime: number): boolean {
  const bob = state.bobs[bobId];
  if (!bob || bob.inTransit) return false;

  // Remove from current system
  const currentSystem = state.systems[bob.systemId];
  currentSystem.bobIds = currentSystem.bobIds.filter(id => id !== bobId);

  bob.inTransit = true;
  bob.transitTo = targetSystemId;
  bob.transitTurnsLeft = travelTime;

  addLog(state, `${bob.name} launched toward ${state.systems[targetSystemId].name}. ETA: ${travelTime} turns.`, 'info');
  return true;
}

export function addLog(state: GameState, message: string, type: 'info' | 'warning' | 'danger' | 'success' = 'info'): void {
  state.log.unshift({ turn: state.turn, message, type });
  if (state.log.length > 50) state.log.pop();
}
