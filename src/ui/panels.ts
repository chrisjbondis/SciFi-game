import type { GameState, TechId, StructureId, BobDirective } from '../types';
import { STRUCTURES } from '../data/structures';
import { SYSTEM_CONNECTIONS, TRAVEL_TIME } from '../data/systems';
import { queueBuild, researchTech } from '../game/engine';
import { replicateBob, sendBob } from '../game/state';

export class PanelRenderer {
  private container: HTMLElement;
  private state: GameState;
  private onStateChange: () => void;

  constructor(container: HTMLElement, state: GameState, onStateChange: () => void) {
    this.container = container;
    this.state = state;
    this.onStateChange = onStateChange;
  }

  updateState(state: GameState): void {
    this.state = state;
  }

  render(): void {
    const s = this.state;
    const sys = s.selectedSystemId ? s.systems[s.selectedSystemId] : null;

    this.container.innerHTML = `
      <div class="panel-section resources-bar">
        <span class="res metal">⬡ ${s.globalResources.metal} metal</span>
        <span class="res energy">⚡ ${s.globalResources.energy} energy</span>
        <span class="res data">◈ ${s.globalResources.data} data</span>
        <span class="res population">👥 ${(s.earthPopulation / 1_000_000).toFixed(1)}M on Earth</span>
        <span class="res timer ${s.earthTimer <= 30 ? 'critical' : ''}">⏱ ${s.earthTimer} turns</span>
        <span class="res colonies">🌍 ${s.coloniesEstablished}/${s.coloniesRequired} colonies</span>
      </div>

      ${this.renderSystemPanel(s, sys)}
      ${this.renderBobPanel(s)}
      ${this.renderBuildQueue(s)}
      ${this.renderTechPanel(s)}
    `;

    this.attachHandlers();
  }

  private renderSystemPanel(s: GameState, sys: typeof s.systems[string] | null): string {
    if (!sys) return '<div class="panel-section"><em>Select a system on the map.</em></div>';
    if (!sys.discovered) return `<div class="panel-section"><h3>${sys.name}</h3><p class="muted">Unknown system. Send a Bob to explore.</p></div>`;

    const bobsHere = sys.bobIds.map(id => s.bobs[id]).filter(Boolean);
    const hasBob = bobsHere.length > 0;

    const structureList = Object.entries(sys.structures)
      .filter(([, count]) => count > 0)
      .map(([id, count]) => `${STRUCTURES[id]?.name ?? id} ×${count}`)
      .join(', ') || 'None';

    const deltansSection = sys.deltans ? `
      <div class="subsection deltans">
        <strong>Deltans</strong> — ${sys.deltans.age} age, pop ${sys.deltans.population.toLocaleString()}
        <div class="progress-bar"><div class="progress-fill" style="width:${sys.deltans.progress}%"></div></div>
        <small>Progress to next age: ${sys.deltans.progress}/100</small>
        ${sys.deltans.underAttack ? '<span class="badge danger">UNDER ATTACK</span>' : ''}
        ${sys.deltans.protected ? '<span class="badge success">Protected</span>' : ''}
      </div>` : '';

    const buildButtons = hasBob ? Object.values(STRUCTURES).map(def => {
      const techOk = !def.requires || s.tech[def.requires as TechId]?.researched;
      const canAfford = s.globalResources.metal >= def.metalCost;
      const disabled = !techOk || !canAfford ? 'disabled' : '';
      const reason = !techOk ? `(requires ${def.requires})` : !canAfford ? `(need ${def.metalCost} metal)` : `(${def.metalCost}⬡, ${def.buildTurns}t)`;
      return `<button class="build-btn ${disabled}" data-action="build" data-system="${sys.id}" data-structure="${def.id}" ${disabled}>${def.name} ${reason}</button>`;
    }).join('') : '<em class="muted">No Bob present — cannot build.</em>';

    const adjacentSystems = (SYSTEM_CONNECTIONS[sys.id] ?? []).map(adjId => {
      const adj = s.systems[adjId];
      const travelTime = TRAVEL_TIME[sys.id]?.[adjId] ?? '?';
      return `<span class="adj-sys">${adj.name}${adj.discovered ? '' : ' (unknown)'} — ${travelTime}t</span>`;
    }).join(' | ');

    return `
      <div class="panel-section system-panel">
        <h3>${sys.name} ${sys.colonised ? '🌍' : sys.habitable ? '🟢' : '⚫'} ${sys.threat > 0 ? `<span class="threat">⚠ Threat: ${sys.threat}%</span>` : ''}</h3>
        <div class="system-stats">
          <span>Income: ${sys.incomePerTurn.metal}⬡/t</span>
          <span>Stored: ${sys.resources.metal}⬡</span>
          ${hasBob ? `<span>Bobs: ${bobsHere.map(b => b.name).join(', ')}</span>` : '<span class="muted">No Bob here</span>'}
        </div>
        <div><strong>Structures:</strong> ${structureList}</div>
        ${deltansSection}
        <div class="adjacent"><small>Adjacent: ${adjacentSystems}</small></div>
        <div class="build-actions">
          <h4>Build</h4>
          ${buildButtons}
          ${hasBob ? `<button class="build-btn" data-action="replicate" data-system="${sys.id}" ${s.globalResources.metal < 200 ? 'disabled' : ''}>
            Replicate Bob (200⬡)
          </button>` : ''}
        </div>
      </div>`;
  }

  private renderBobPanel(s: GameState): string {
    const bobEntries = Object.values(s.bobs).map(bob => {
      const directives: BobDirective[] = ['idle', 'explore', 'mine', 'build', 'protect', 'colonise'];
      const directiveSelect = directives.map(d =>
        `<option value="${d}" ${bob.directive === d ? 'selected' : ''}>${d}</option>`
      ).join('');

      const location = bob.inTransit
        ? `→ ${s.systems[bob.transitTo!]?.name} (${bob.transitTurnsLeft}t)`
        : s.systems[bob.systemId]?.name;

      const sendOptions = bob.inTransit ? '' : (() => {
        const connections = SYSTEM_CONNECTIONS[bob.systemId] ?? [];
        const opts = connections.map(adjId => {
          const travelTime = TRAVEL_TIME[bob.systemId]?.[adjId] ?? 5;
          return `<option value="${adjId}|${travelTime}">${s.systems[adjId].name} (${travelTime}t)</option>`;
        }).join('');
        return opts ? `<select class="send-select" data-bob="${bob.id}"><option value="">— Send to —</option>${opts}</select>` : '';
      })();

      return `<div class="bob-entry">
        <strong>${bob.name}</strong> <span class="muted">[${bob.trait}]</span>
        <span class="location">${location}</span>
        ${!bob.inTransit ? `<select class="directive-select" data-bob="${bob.id}">${directiveSelect}</select>` : ''}
        ${sendOptions}
      </div>`;
    }).join('');

    return `<div class="panel-section bob-panel">
      <h4>Bobs (${Object.keys(s.bobs).length})</h4>
      ${bobEntries || '<em class="muted">No Bobs yet.</em>'}
    </div>`;
  }

  private renderBuildQueue(s: GameState): string {
    if (s.buildQueue.length === 0) return '';
    const items = s.buildQueue.map(item =>
      `<li>${STRUCTURES[item.structureId]?.name ?? item.structureId} @ ${s.systems[item.systemId]?.name} — ${item.turnsLeft}t</li>`
    ).join('');
    return `<div class="panel-section"><h4>Build Queue</h4><ul class="queue-list">${items}</ul></div>`;
  }

  private renderTechPanel(s: GameState): string {
    const tiers = [1, 2, 3, 4, 5];
    const techByTier = tiers.map(tier => {
      const nodes = Object.values(s.tech).filter(t => t.tier === tier);
      const buttons = nodes.map(t => {
        const prereqsMet = t.requires.every(req => s.tech[req].researched);
        const canAfford = s.globalResources.data >= t.cost;
        const done = t.researched;
        const disabled = done || !prereqsMet || !canAfford ? 'disabled' : '';
        const label = done ? '✓ ' : '';
        const reason = done ? 'researched' : !prereqsMet ? 'locked' : !canAfford ? `${t.cost}◈` : `${t.cost}◈`;
        return `<button class="tech-btn ${done ? 'done' : ''} ${disabled}" data-action="research" data-tech="${t.id}" ${disabled}>
          ${label}${t.name}<br><small>${reason}</small>
        </button>`;
      }).join('');
      return `<div class="tech-tier"><span class="tier-label">T${tier}</span>${buttons}</div>`;
    }).join('');

    return `<div class="panel-section tech-panel">
      <h4>Research (◈ ${s.globalResources.data} data)</h4>
      ${techByTier}
    </div>`;
  }

  private attachHandlers(): void {
    // Build buttons
    this.container.querySelectorAll('[data-action="build"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const systemId = (btn as HTMLElement).dataset.system!;
        const structureId = (btn as HTMLElement).dataset.structure! as StructureId;
        if (queueBuild(this.state, systemId, structureId)) {
          this.onStateChange();
        }
      });
    });

    // Replicate
    this.container.querySelectorAll('[data-action="replicate"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const systemId = (btn as HTMLElement).dataset.system!;
        if (replicateBob(this.state, systemId)) {
          this.onStateChange();
        }
      });
    });

    // Research
    this.container.querySelectorAll('[data-action="research"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const techId = (btn as HTMLElement).dataset.tech! as TechId;
        if (researchTech(this.state, techId)) {
          this.onStateChange();
        }
      });
    });

    // Directive selects
    this.container.querySelectorAll('.directive-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const bobId = parseInt((sel as HTMLElement).dataset.bob!);
        const directive = (e.target as HTMLSelectElement).value as BobDirective;
        if (this.state.bobs[bobId]) {
          this.state.bobs[bobId].directive = directive;
          this.onStateChange();
        }
      });
    });

    // Send selects
    this.container.querySelectorAll('.send-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const bobId = parseInt((sel as HTMLElement).dataset.bob!);
        const val = (e.target as HTMLSelectElement).value;
        if (!val) return;
        const [targetId, travelStr] = val.split('|');
        const travelTime = parseInt(travelStr);
        const surgeReduction = this.state.tech.surge_drive.researched ? 2 : 0;
        sendBob(this.state, bobId, targetId, Math.max(1, travelTime - surgeReduction));
        this.onStateChange();
        (e.target as HTMLSelectElement).value = '';
      });
    });
  }
}
