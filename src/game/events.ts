import type { GameEvent, GameState } from '../types';
import { addLog } from './state';

// Returns a list of events that should fire on the given turn
export function getScheduledEvents(turn: number, state: GameState): GameEvent[] {
  const events: GameEvent[] = [];

  // Turn 1: FAITH ministry threatens to shut down the project
  if (turn === 3) {
    events.push({
      id: 'faith_warning',
      title: 'Ministry of Truth Warning',
      description: 'A FAITH minister has declared Bob-1 "an abomination before God." The Ministry of Truth is currently overruling him — but for how long?\n\n"Minister Jacoby appears to have a lot of free time," Dr. Landers notes dryly.',
      turn,
      choices: [
        {
          label: 'Ignore it (free)',
          effect: (s) => addLog(s, 'The minister continues ranting. GUPPY suggests muting his frequency.', 'warning'),
        },
        {
          label: 'Cooperate — share data with MoT (+15 data)',
          cost: { data: 0 },
          effect: (s) => {
            s.globalResources.data += 15;
            addLog(s, 'Your cooperation buys goodwill with the Ministry of Truth. For now.', 'info');
          },
        },
      ],
      resolved: false,
    });
  }

  // Turn 10: UN squabbling about colony ship seats
  if (turn === 10) {
    events.push({
      id: 'un_seats',
      title: 'UN: Colony Ship Seat Allocation',
      description: 'The 15 million Earth survivors are arguing about who gets the first colony ship seats. The USE wants priority. Brazil is threatening to bomb New Zealand. VEHEMENT is handing out pamphlets.\n\n"Everyone wants the lifeboat, nobody wants to row," — Riker, Sol system.',
      turn,
      choices: [
        {
          label: 'Stay out of politics (free)',
          effect: (s) => {
            s.earthTimer -= 3;
            addLog(s, 'The bickering costs 3 precious turns. Earth\'s clock ticks faster.', 'warning');
          },
        },
        {
          label: 'Mediate — USE gets first ship (costs 20 data)',
          cost: { data: 20 },
          effect: (s) => {
            s.globalResources.data -= 20;
            addLog(s, 'A deal is struck. The USE will board first. The others are furious but cooperative... for now.', 'info');
          },
        },
        {
          label: 'Lottery system — random allocation (free)',
          effect: (s) => addLog(s, 'A lottery is announced. Everyone complains equally. Progress.', 'info'),
        },
      ],
      resolved: false,
    });
  }

  // Turn 20: Deltans discovered (if Delta Eridani has a Bob)
  if (turn === 20) {
    const deltaSystem = state.systems['delta_eridani'];
    if (deltaSystem.discovered && deltaSystem.bobIds.length > 0 && !deltaSystem.deltans) {
      events.push({
        id: 'deltans_discovered',
        title: 'First Contact: The Deltans',
        description: 'The Bob stationed at Delta Eridani has detected a primitive humanoid civilisation on the third planet. Bipedal, tool-using, social. They call themselves… well, they don\'t have language yet, but the lead researcher has named one "Moses."\n\n"I really like these people," — Bob, Delta Eridani.',
        turn,
        choices: [
          {
            label: 'Observe only — non-interference',
            effect: (s) => {
              s.systems['delta_eridani'].deltans = { population: 2000, age: 'stone', progress: 10, underAttack: false, protected: false };
              addLog(s, 'The Deltans are catalogued and observed. Bob watches from a respectful distance.', 'info');
            },
          },
          {
            label: 'Help them — teach fire, food preservation',
            effect: (s) => {
              s.systems['delta_eridani'].deltans = { population: 2000, age: 'stone', progress: 30, underAttack: false, protected: true };
              addLog(s, 'Bob introduces fire and food preservation. Deltan tech progress +20. They look at the drone like it\'s a god.', 'success');
            },
          },
        ],
        resolved: false,
      });
    }
  }

  // Turn 25: Gorilloid attack on Deltans
  if (turn === 25) {
    const delta = state.systems['delta_eridani'];
    if (delta.deltans) {
      events.push({
        id: 'gorilloid_attack_1',
        title: 'Gorilloid Attack!',
        description: 'A pack of large ape-like predators — the gorilloids — has attacked a Deltan settlement. Without intervention, dozens will die and their progress will be set back.\n\n"They\'re basically giant angry gorillas. With worse table manners." — Bob.',
        turn,
        choices: [
          {
            label: 'Deploy busters to repel the attack (requires Buster Cache)',
            effect: (s) => {
              const hasBusters = (s.systems['delta_eridani'].structures['buster_cache'] ?? 0) > 0;
              if (hasBusters) {
                addLog(s, 'Busters deployed. The gorilloids scatter. The Deltans are amazed and grateful.', 'success');
                if (s.systems['delta_eridani'].deltans) {
                  s.systems['delta_eridani'].deltans.underAttack = false;
                  s.systems['delta_eridani'].deltans.progress += 5;
                }
              } else {
                addLog(s, 'No Buster Cache in this system! The gorilloids attack unchallenged. Deltan losses are significant.', 'danger');
                if (s.systems['delta_eridani'].deltans) {
                  s.systems['delta_eridani'].deltans.population = Math.floor(s.systems['delta_eridani'].deltans.population * 0.85);
                  s.systems['delta_eridani'].deltans.underAttack = true;
                }
              }
            },
          },
          {
            label: 'Do nothing — let nature take its course',
            effect: (s) => {
              addLog(s, 'The gorilloids raid the settlement. Deltan casualties: 15%. Their progress is set back.', 'danger');
              if (s.systems['delta_eridani'].deltans) {
                s.systems['delta_eridani'].deltans.population = Math.floor(s.systems['delta_eridani'].deltans.population * 0.85);
                s.systems['delta_eridani'].deltans.progress = Math.max(0, s.systems['delta_eridani'].deltans.progress - 10);
              }
            },
          },
        ],
        resolved: false,
      });
    }
  }

  // Turn 40: VEHEMENT sabotage
  if (turn === 40) {
    events.push({
      id: 'vehement_sabotage',
      title: 'VEHEMENT Attack',
      description: 'The Voluntary Extinction of Human Existence Means Earth\'s Natural Transformation group has sabotaged an autofactory at Sol.\n\n"Voluntary? There\'s nothing voluntary about a pipe bomb." — Riker.',
      turn,
      choices: [
        {
          label: 'Increase security (cost: 40 metal)',
          cost: { metal: 40 },
          effect: (s) => {
            s.globalResources.metal -= 40;
            addLog(s, 'Security drones deployed. VEHEMENT activity suppressed for now.', 'info');
          },
        },
        {
          label: 'Take the hit — repair damage (lose 1 autofactory turn)',
          effect: (s) => {
            s.earthTimer -= 5;
            addLog(s, 'The sabotage sets back manufacturing. Earth timer accelerated by 5 turns.', 'danger');
          },
        },
      ],
      resolved: false,
    });
  }

  // Turn 70: The Others — first detection
  if (turn === 70) {
    events.push({
      id: 'others_first_contact',
      title: 'Unknown Signal Detected',
      description: 'A SUDDAR array has picked up an anomalous signal from beyond the mapped systems. The energy signature matches no known probe or natural phenomenon. It appears to be moving.\n\n"Whatever it is, it\'s big. And it\'s heading this way." — Calvin, Alpha Centauri.',
      turn,
      choices: [
        {
          label: 'Broadcast a greeting signal',
          effect: (s) => {
            addLog(s, 'Signal transmitted. No response. The anomaly continues its approach. Did we just announce our position?', 'warning');
            s.systems['beta_hydri'].threat = 30;
          },
        },
        {
          label: 'Go dark — run silent, passive sensors only',
          effect: (s) => {
            addLog(s, 'All active sensors powered down. The signal is harder to track but we are harder to detect.', 'info');
            s.systems['beta_hydri'].threat = 15;
          },
        },
        {
          label: 'Begin fortifying outer systems',
          effect: (s) => {
            addLog(s, 'Resources redirected to defensive structures. The Bobs on the rim go on high alert.', 'info');
            s.systems['beta_hydri'].threat = 20;
            // Small resource cost
            s.globalResources.metal = Math.max(0, s.globalResources.metal - 50);
          },
        },
      ],
      resolved: false,
    });
  }

  // Turn 100: Others arrive at outer rim
  if (turn === 100) {
    events.push({
      id: 'others_arrive',
      title: 'THE OTHERS',
      description: 'They\'re here. An armada of unknown vessels has entered the Beta Hydri system. Their technology is far beyond ours. They are not responding to any communication.\n\nThey are not stopping.\n\n"Well. That\'s... not great." — Every Bob, simultaneously.',
      turn,
      choices: [
        {
          label: 'Evacuate Beta Hydri Bob immediately',
          effect: (s) => {
            s.systems['beta_hydri'].threat = 100;
            addLog(s, 'The Bob at Beta Hydri begins emergency transit. The Others flood the system.', 'danger');
          },
        },
        {
          label: 'Hold and observe — gather intelligence',
          effect: (s) => {
            s.systems['beta_hydri'].threat = 100;
            addLog(s, 'The Beta Hydri Bob observes until contact is lost. Data gathered before destruction: significant. The Bob is gone.', 'danger');
            s.globalResources.data += 50;
            // Remove any Bob from beta_hydri
            const betaBobs = s.systems['beta_hydri'].bobIds;
            betaBobs.forEach(id => { delete s.bobs[id]; });
            s.systems['beta_hydri'].bobIds = [];
          },
        },
      ],
      resolved: false,
    });
  }

  return events;
}

export function processTurnEvents(state: GameState): void {
  const newEvents = getScheduledEvents(state.turn, state);
  if (newEvents.length > 0 && !state.activeEvent) {
    state.activeEvent = newEvents[0];
  }
}
