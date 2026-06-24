import type { GameState, StructureId, TechId } from '../types';
import { STRUCTURES } from '../data/structures';
import { SYSTEM_CONNECTIONS, TRAVEL_TIME } from '../data/systems';
import { addLog, sendBob } from './state';
import { processTurnEvents } from './events';

export function processTurn(state: GameState): void {
  if (state.gameOver || state.activeEvent) return;

  // 1. Income phase
  collectIncome(state);

  // 2. Transit resolution
  resolveTransits(state);

  // 3. Build queue progress
  processBuildQueue(state);

  // 4. Bob directives (auto-actions)
  processBobDirectives(state);

  // 5. Deltan progression
  processDeltans(state);

  // 6. Others advance
  processOthers(state);

  // 7. Earth timer
  state.earthTimer--;
  if (state.earthTimer <= 20 && state.earthTimer > 0) {
    addLog(state, `WARNING: Earth\'s climate is critical. ${state.earthTimer} turns remaining.`, 'danger');
  }

  // 8. Events
  processTurnEvents(state);

  // 9. Win/lose check
  checkEndConditions(state);

  state.turn++;
}

function collectIncome(state: GameState): void {
  const miningBonus = state.tech.better_mining.researched ? 1.5 : 1.0;
  const scutBonus = state.tech.scut_comms.researched;

  for (const sys of Object.values(state.systems)) {
    if (!sys.discovered || sys.bobIds.length === 0) continue;

    const mines = sys.structures.mine_drone ?? 0;
    const metal = Math.floor((sys.incomePerTurn.metal + mines * 4) * miningBonus);
    const energy = sys.incomePerTurn.energy;
    let data = sys.incomePerTurn.data;
    if (scutBonus) data += 2;

    // Only Sol feeds globalResources directly; other systems store locally
    if (sys.id === 'sol') {
      state.globalResources.metal += metal;
      state.globalResources.energy += energy;
      state.globalResources.data += data;
    } else {
      sys.resources.metal += metal;
      sys.resources.energy += energy;
      sys.resources.data += data;
    }
  }

  // Transfer remote resources to global pool periodically (every 5 turns)
  if (state.turn % 5 === 0) {
    for (const sys of Object.values(state.systems)) {
      if (sys.id === 'sol') continue;
      if (!sys.discovered || sys.bobIds.length === 0) continue;
      // SCUT comms transfers everything; otherwise slow ship transfer (25%)
      const rate = state.tech.scut_comms.researched ? 1.0 : 0.25;
      const transferred = Math.floor(sys.resources.metal * rate);
      state.globalResources.metal += transferred;
      state.globalResources.data += Math.floor(sys.resources.data * rate);
      sys.resources.metal -= transferred;
      sys.resources.data -= Math.floor(sys.resources.data * rate);
    }
  }
}

function resolveTransits(state: GameState): void {
  for (const bob of Object.values(state.bobs)) {
    if (!bob.inTransit || !bob.transitTo) continue;

    bob.transitTurnsLeft--;

    if (bob.transitTurnsLeft <= 0) {
      bob.transitTurnsLeft = 0;
      const destination = state.systems[bob.transitTo];
      bob.systemId = bob.transitTo;
      bob.inTransit = false;
      bob.transitTo = null;

      destination.bobIds.push(bob.id);

      // First arrival = discovery
      if (!destination.discovered) {
        destination.discovered = true;
        addLog(state, `${bob.name} arrived at ${destination.name}! System discovered. Resources: ${destination.incomePerTurn.metal} metal/turn.`, 'success');

        // Reveal adjacent systems if SUDDAR array present
        if ((destination.structures.suddar_array ?? 0) > 0) {
          revealAdjacent(state, destination.id);
        }

        // Delta Eridani: reveal Deltans on arrival
        if (destination.id === 'delta_eridani' && !destination.deltans) {
          destination.deltans = null; // will be set by event turn 20
          addLog(state, `${bob.name} detects biosignatures on the third planet. Something lives here.`, 'info');
        }
      } else {
        addLog(state, `${bob.name} arrived at ${destination.name}.`, 'info');
      }
    }
  }
}

function processBuildQueue(state: GameState): void {
  for (const item of state.buildQueue) {
    const sys = state.systems[item.systemId];
    if (!sys) continue;
    const autofactoryBonus = state.tech.autofactory_mk2.researched ? 1 : 0;
    item.turnsLeft = Math.max(0, item.turnsLeft - 1 - autofactoryBonus);
  }

  const completed = state.buildQueue.filter(i => i.turnsLeft <= 0);
  state.buildQueue = state.buildQueue.filter(i => i.turnsLeft > 0);

  for (const item of completed) {
    const sys = state.systems[item.systemId];
    if (!sys) continue;

    if (item.structureId === 'colony_ship') {
      // Colony ship launches
      if (sys.habitable) {
        state.coloniesEstablished++;
        state.earthPopulation -= 2_500_000;
        addLog(state, `Colony ship launched from ${sys.name}! 2.5M humans now settling a new world. Colonies: ${state.coloniesEstablished}/${state.coloniesRequired}.`, 'success');
      } else {
        addLog(state, `Colony ship built at ${sys.name} but no habitable planet found! Ship stands by.`, 'warning');
      }
    } else {
      sys.structures[item.structureId] = (sys.structures[item.structureId] ?? 0) + 1;
      addLog(state, `${STRUCTURES[item.structureId].name} completed at ${sys.name}.`, 'info');
    }
  }
}

function processBobDirectives(state: GameState): void {
  for (const bob of Object.values(state.bobs)) {
    if (bob.inTransit) continue;
    const sys = state.systems[bob.systemId];

    switch (bob.directive) {
      case 'mine':
        // Auto-queue a mine drone if none pending
        if (!state.buildQueue.some(i => i.systemId === sys.id && i.structureId === 'mine_drone')) {
          if (state.globalResources.metal >= STRUCTURES.mine_drone.metalCost) {
            queueBuild(state, bob.systemId, 'mine_drone');
          }
        }
        break;
      case 'explore': {
        // Auto-send to an adjacent undiscovered system
        const connections = SYSTEM_CONNECTIONS[bob.systemId] ?? [];
        const undiscovered = connections.find(id => !state.systems[id].discovered);
        if (undiscovered) {
          const travelTime = TRAVEL_TIME[bob.systemId][undiscovered] ?? 5;
          const surgeReduction = state.tech.surge_drive.researched ? 2 : 0;
          sendBob(state, bob.id, undiscovered, Math.max(1, travelTime - surgeReduction));
          bob.directive = 'idle'; // reset after launch
        }
        break;
      }
      case 'build':
        // Auto-queue autofactory if none and we have metal
        if ((sys.structures.autofactory ?? 0) === 0 &&
          !state.buildQueue.some(i => i.systemId === sys.id && i.structureId === 'autofactory') &&
          state.globalResources.metal >= STRUCTURES.autofactory.metalCost) {
          queueBuild(state, bob.systemId, 'autofactory');
        }
        break;
    }
  }
}

function processDeltans(state: GameState): void {
  const delta = state.systems['delta_eridani'];
  if (!delta.deltans) return;

  const d = delta.deltans;

  // Population growth
  d.population = Math.floor(d.population * 1.01);

  // Tech progress
  const baseProgress = d.protected ? 2 : 1;
  const busterBonus = (delta.structures.buster_cache ?? 0) > 0 ? 1 : 0;
  d.progress += baseProgress + busterBonus;

  // Age advancement
  if (d.age === 'stone' && d.progress >= 100) {
    d.age = 'bronze';
    d.progress = 0;
    addLog(state, 'The Deltans have entered the Bronze Age! They\'re making tools. Moses would be proud.', 'success');
  } else if (d.age === 'bronze' && d.progress >= 100) {
    d.age = 'iron';
    d.progress = 0;
    addLog(state, 'The Deltans have reached the Iron Age! They can now defend themselves.', 'success');
  }

  // Random gorilloid attack (low chance each turn)
  if (d.age !== 'iron' && Math.random() < 0.04) {
    d.underAttack = true;
    const hasBusters = (delta.structures.buster_cache ?? 0) > 0;
    if (hasBusters) {
      d.underAttack = false;
      addLog(state, 'Gorilloids attacked the Deltans — busters deployed. Attack repelled.', 'info');
    } else {
      d.population = Math.floor(d.population * 0.92);
      d.progress = Math.max(0, d.progress - 8);
      addLog(state, 'Gorilloids attacked the Deltans! No busters available. Population -8%, progress -8.', 'danger');
    }
  }
}

function processOthers(state: GameState): void {
  if (state.turn < 90) return;

  const slowdown = state.tech.others_countermeasures.researched ? 0.5 : 1.0;

  // Increase threat in outer systems progressively
  const threatOrder = ['beta_hydri', 'epsilon_indi', 'alpha_centauri', 'tau_ceti', '82_eridani', 'omicron2_eridani', 'delta_eridani', 'epsilon_eridani'];
  for (const sysId of threatOrder) {
    const sys = state.systems[sysId];
    if (!sys.discovered) continue;
    if (sys.threat >= 100) {
      // System is overrun — remove Bobs, can't build here
      const lostBobs = sys.bobIds.filter(id => state.bobs[id] && !state.bobs[id].inTransit);
      if (lostBobs.length > 0) {
        lostBobs.forEach(id => {
          addLog(state, `${state.bobs[id].name} lost to the Others at ${sys.name}.`, 'danger');
          delete state.bobs[id];
        });
        sys.bobIds = sys.bobIds.filter(id => state.bobs[id]);
      }
    } else if (sys.threat > 0) {
      sys.threat = Math.min(100, sys.threat + Math.floor(3 * slowdown));
    }
  }

  // The Others advance toward Sol every 15 turns after turn 100
  if (state.turn > 100 && state.turn % 15 === 0) {
    const nextTarget = threatOrder.find(id => (state.systems[id]?.threat ?? 0) < 10);
    if (nextTarget) {
      state.systems[nextTarget].threat = 10;
      addLog(state, `The Others have been detected entering ${state.systems[nextTarget].name}!`, 'danger');
    }
    // If Sol is threatened, it's getting very bad
    if (state.systems['sol'].threat > 50) {
      addLog(state, 'The Others are closing on Sol. Time is running out!', 'danger');
    }
  }
}

function checkEndConditions(state: GameState): void {
  // Lose: Earth timer expired
  if (state.earthTimer <= 0) {
    state.gameOver = true;
    state.winCondition = 'lose';
    state.winMessage = "Earth's climate has collapsed. The last 15 million humans are gone. Bob floats alone in the void.\n\n\"Well. That didn't work out.\" — Bob";
    return;
  }

  // Lose: Sol overrun
  if (state.systems['sol'].threat >= 100) {
    state.gameOver = true;
    state.winCondition = 'lose';
    state.winMessage = "The Others have reached Sol. Bob-Prime is destroyed. There are no more Bobs.\n\n\"Huh. I did not see that coming.\" — Bob (last words)";
    return;
  }

  // Win: 2 colonies + Deltans at Iron Age
  const delta = state.systems['delta_eridani'];
  const deltansWin = delta.deltans && delta.deltans.age === 'iron';
  if (state.coloniesEstablished >= state.coloniesRequired && deltansWin) {
    state.gameOver = true;
    state.winCondition = 'win';
    state.winMessage = `${state.coloniesEstablished} human colonies established. The Deltans have reached the Iron Age — they'll be fine without us now.\n\nBob leans back in his virtual hammock.\n\n"Not bad for a dead software engineer."\n\nVictory — Turn ${state.turn}`;
    return;
  }

  // Win: 2 colonies (no Deltans discovered)
  if (state.coloniesEstablished >= state.coloniesRequired && !delta.deltans) {
    state.gameOver = true;
    state.winCondition = 'win';
    state.winMessage = `${state.coloniesEstablished} human colonies established. Humanity survives among the stars.\n\n"Not bad for a dead software engineer." — Bob\n\nVictory — Turn ${state.turn}`;
    return;
  }
}

export function queueBuild(state: GameState, systemId: string, structureId: StructureId): boolean {
  const def = STRUCTURES[structureId];
  if (!def) return false;

  if (def.requires && !state.tech[def.requires as TechId]?.researched) return false;

  const cost = def.metalCost;
  if (state.globalResources.metal < cost) return false;

  state.globalResources.metal -= cost;

  const autofactories = state.systems[systemId].structures.autofactory ?? 0;
  const reduction = Math.min(autofactories, def.buildTurns - 1);
  const buildTurns = state.tech.autofactory_mk2.researched
    ? Math.max(1, def.buildTurns - reduction - 1)
    : Math.max(1, def.buildTurns - reduction);

  state.buildQueue.push({ structureId, systemId, turnsLeft: buildTurns, metalCost: cost });
  addLog(state, `${def.name} queued at ${state.systems[systemId].name}. ETA: ${buildTurns} turns.`, 'info');
  return true;
}

export function researchTech(state: GameState, techId: TechId): boolean {
  const tech = state.tech[techId];
  if (!tech || tech.researched) return false;
  if (state.globalResources.data < tech.cost) return false;
  if (tech.requires.some(req => !state.tech[req].researched)) return false;

  state.globalResources.data -= tech.cost;
  tech.researched = true;
  addLog(state, `Research complete: ${tech.name}. ${tech.description}`, 'success');
  return true;
}

export function revealAdjacent(state: GameState, systemId: string): void {
  const connections = SYSTEM_CONNECTIONS[systemId] ?? [];
  for (const adjId of connections) {
    if (!state.systems[adjId].discovered) {
      addLog(state, `SUDDAR reveals: ${state.systems[adjId].name} detected.`, 'info');
    }
  }
}
