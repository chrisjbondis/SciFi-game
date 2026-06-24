import './style.css';
import { createInitialState } from './game/state';
import { processTurn } from './game/engine';
import { StarMapRenderer } from './ui/starmap';
import { PanelRenderer } from './ui/panels';
import type { GameState } from './types';

let state: GameState = createInitialState();

const mapCanvas = document.getElementById('starmap') as HTMLCanvasElement;
const sidePanel = document.getElementById('side-panel')!;
const logEl = document.getElementById('event-log')!;
const endTurnBtn = document.getElementById('end-turn-btn')!;
const turnLabel = document.getElementById('turn-label')!;
const eventModal = document.getElementById('event-modal')!;
const eventTitle = document.getElementById('event-title')!;
const eventDesc = document.getElementById('event-description')!;
const eventChoices = document.getElementById('event-choices')!;
const gameOverScreen = document.getElementById('game-over')!;
const gameOverMsg = document.getElementById('game-over-message')!;

// Scale canvas to fit mobile screens while preserving logical coordinates
function resizeCanvas(): void {
  const LOGICAL_W = 800;
  const LOGICAL_H = 560;
  const maxW = Math.min(window.innerWidth, LOGICAL_W);
  const scale = maxW / LOGICAL_W;
  mapCanvas.style.width = `${LOGICAL_W * scale}px`;
  mapCanvas.style.height = `${LOGICAL_H * scale}px`;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const mapRenderer = new StarMapRenderer(mapCanvas, (systemId) => {
  state.selectedSystemId = systemId;
  panels.render();
  renderMap();
});

const panels = new PanelRenderer(sidePanel, state, () => {
  panels.updateState(state);
  panels.render();
  renderLog();
  renderMap();
});

function renderMap(): void {
  mapRenderer.render(state);
  turnLabel.textContent = `Turn ${state.turn}`;
}

function renderLog(): void {
  logEl.innerHTML = state.log.slice(0, 15).map(entry =>
    `<div class="log-entry ${entry.type}"><span class="log-turn">T${entry.turn}</span> ${entry.message}</div>`
  ).join('');
}

function renderEventModal(): void {
  if (!state.activeEvent) {
    eventModal.classList.add('hidden');
    return;
  }
  const ev = state.activeEvent;
  eventModal.classList.remove('hidden');
  eventTitle.textContent = ev.title;
  eventDesc.textContent = ev.description;
  eventChoices.innerHTML = ev.choices.map((choice, i) => {
    const costStr = choice.cost
      ? Object.entries(choice.cost).map(([k, v]) => `${v} ${k}`).join(', ')
      : '';
    return `<button class="choice-btn" data-choice="${i}">${choice.label}${costStr ? ` [${costStr}]` : ''}</button>`;
  }).join('');

  eventChoices.querySelectorAll('.choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt((btn as HTMLElement).dataset.choice!);
      const choice = ev.choices[idx];
      if (choice.cost) {
        if (choice.cost.metal && state.globalResources.metal < choice.cost.metal) return;
        if (choice.cost.data && state.globalResources.data < choice.cost.data) return;
        if (choice.cost.metal) state.globalResources.metal -= choice.cost.metal;
        if (choice.cost.data) state.globalResources.data -= choice.cost.data;
      }
      choice.effect(state);
      ev.resolved = true;
      state.activeEvent = null;
      refreshAll();
    });
  });
}

function renderGameOver(): void {
  if (!state.gameOver) return;
  gameOverScreen.classList.remove('hidden');
  gameOverMsg.textContent = state.winMessage;
  gameOverScreen.querySelector('#restart-btn')?.addEventListener('click', () => {
    state = createInitialState();
    gameOverScreen.classList.add('hidden');
    refreshAll();
  });
}

function refreshAll(): void {
  panels.updateState(state);
  panels.render();
  renderLog();
  renderMap();
  renderEventModal();
  if (state.gameOver) renderGameOver();
}

endTurnBtn.addEventListener('click', () => {
  if (state.gameOver || state.activeEvent) return;
  processTurn(state);
  refreshAll();
});

// Keyboard shortcut: Space or Enter = end turn
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'Enter') {
    if (!state.gameOver && !state.activeEvent) {
      e.preventDefault();
      processTurn(state);
      refreshAll();
    } else if (state.activeEvent) {
      // Press 1/2/3 to select choice
      const num = parseInt(e.key);
      if (!isNaN(num) && num >= 1 && num <= state.activeEvent.choices.length) {
        const btn = eventChoices.querySelectorAll('.choice-btn')[num - 1] as HTMLButtonElement;
        btn?.click();
      }
    }
  }
});

// Map animation loop
function animate(): void {
  renderMap();
  requestAnimationFrame(animate);
}

// Initial render
refreshAll();
animate();
