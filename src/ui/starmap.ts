import type { GameState, StarSystem } from '../types';
import { SYSTEM_CONNECTIONS } from '../data/systems';

const SYSTEM_RADIUS = 18;
const COLORS = {
  undiscovered: '#1a2a3a',
  discovered: '#2a4a6a',
  colonised: '#1a5a3a',
  habitable: '#2a5a4a',
  threatened: '#5a2a1a',
  bobPresent: '#4a8a6a',
  transit: '#6a6a2a',
  selected: '#ffffff',
  connection: '#1e3a4a',
  connectionDiscovered: '#3a6a8a',
  text: '#8ab4c8',
  bobDot: '#00ff88',
  threatColor: '#ff4422',
  others: '#ff2200',
};

export class StarMapRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onSystemClick: (systemId: string) => void;
  private animFrame = 0;

  constructor(canvas: HTMLCanvasElement, onSystemClick: (systemId: string) => void) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.onSystemClick = onSystemClick;
    canvas.addEventListener('click', this.handleClick.bind(this));
  }

  private handleClick(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Find clicked system
    // We need access to systems here — passed via render call stored externally
    if (this._lastState) {
      for (const sys of Object.values(this._lastState.systems)) {
        const dx = sys.pos.x - x;
        const dy = sys.pos.y - y;
        if (Math.sqrt(dx * dx + dy * dy) < SYSTEM_RADIUS + 6) {
          this.onSystemClick(sys.id);
          return;
        }
      }
    }
  }

  private _lastState: GameState | null = null;

  render(state: GameState): void {
    this._lastState = state;
    this.animFrame++;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#050d14';
    ctx.fillRect(0, 0, w, h);

    // Starfield (static, seeded)
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 120; i++) {
      const sx = ((i * 137.5) % w);
      const sy = ((i * 97.3 + 13) % h);
      const size = i % 7 === 0 ? 1.5 : 0.7;
      ctx.globalAlpha = 0.3 + (i % 3) * 0.15;
      ctx.fillRect(sx, sy, size, size);
    }
    ctx.globalAlpha = 1;

    // Draw connections first
    const drawn = new Set<string>();
    for (const [sysId, connections] of Object.entries(SYSTEM_CONNECTIONS)) {
      const sys = state.systems[sysId];
      for (const connId of connections) {
        const key = [sysId, connId].sort().join('-');
        if (drawn.has(key)) continue;
        drawn.add(key);

        const conn = state.systems[connId];
        const bothDiscovered = sys.discovered && conn.discovered;
        ctx.beginPath();
        ctx.moveTo(sys.pos.x, sys.pos.y);
        ctx.lineTo(conn.pos.x, conn.pos.y);
        ctx.strokeStyle = bothDiscovered ? COLORS.connectionDiscovered : COLORS.connection;
        ctx.lineWidth = bothDiscovered ? 1 : 0.5;
        ctx.globalAlpha = bothDiscovered ? 0.5 : 0.2;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // Draw Bobs in transit
    for (const bob of Object.values(state.bobs)) {
      if (!bob.inTransit || !bob.transitTo) continue;
      const from = state.systems[bob.systemId];
      const to = state.systems[bob.transitTo];
      const totalTime = 1; // normalized
      const progress = 1 - (bob.transitTurnsLeft / (bob.transitTurnsLeft + 1)); // rough position
      const tx = from.pos.x + (to.pos.x - from.pos.x) * Math.min(0.9, progress + 0.05);
      const ty = from.pos.y + (to.pos.y - from.pos.y) * Math.min(0.9, progress + 0.05);

      // Pulsing transit indicator
      const pulse = 0.6 + 0.4 * Math.sin(this.animFrame * 0.1);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = COLORS.transit;
      ctx.beginPath();
      ctx.arc(tx, ty, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Draw systems
    for (const sys of Object.values(state.systems)) {
      this.drawSystem(ctx, sys, state);
    }
  }

  private drawSystem(ctx: CanvasRenderingContext2D, sys: StarSystem, state: GameState): void {
    const { x, y } = sys.pos;
    const isSelected = state.selectedSystemId === sys.id;
    const hasBob = sys.bobIds.length > 0;
    const threatLevel = sys.threat / 100;

    if (!sys.discovered) {
      // Draw faint unknown marker
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#334455';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }

    // Threat glow
    if (threatLevel > 0) {
      const gradient = ctx.createRadialGradient(x, y, SYSTEM_RADIUS, x, y, SYSTEM_RADIUS + 20);
      gradient.addColorStop(0, `rgba(255, 50, 0, ${threatLevel * 0.6})`);
      gradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, SYSTEM_RADIUS + 20, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bob presence glow
    if (hasBob) {
      const pulse = 0.3 + 0.15 * Math.sin(this.animFrame * 0.05);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = COLORS.bobDot;
      ctx.beginPath();
      ctx.arc(x, y, SYSTEM_RADIUS + 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Selection ring
    if (isSelected) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.8 + 0.2 * Math.sin(this.animFrame * 0.08);
      ctx.beginPath();
      ctx.arc(x, y, SYSTEM_RADIUS + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // System body
    let baseColor = COLORS.discovered;
    if (sys.colonised) baseColor = COLORS.colonised;
    else if (sys.habitable) baseColor = COLORS.habitable;
    if (threatLevel > 0.5) baseColor = COLORS.threatened;

    const gradient = ctx.createRadialGradient(x - 4, y - 4, 2, x, y, SYSTEM_RADIUS);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.2, baseColor);
    gradient.addColorStop(1, '#050d14');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, SYSTEM_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Bob count dots
    if (hasBob) {
      const bobCount = sys.bobIds.length;
      for (let i = 0; i < Math.min(bobCount, 5); i++) {
        const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const dotX = x + Math.cos(angle) * (SYSTEM_RADIUS + 10);
        const dotY = y + Math.sin(angle) * (SYSTEM_RADIUS + 10);
        ctx.fillStyle = COLORS.bobDot;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Deltans indicator
    if (sys.deltans) {
      ctx.fillStyle = '#ffaa00';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('👾', x + SYSTEM_RADIUS - 6, y - SYSTEM_RADIUS + 4);
    }

    // System name
    ctx.fillStyle = COLORS.text;
    ctx.font = `${isSelected ? 'bold ' : ''}11px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(sys.name, x, y + SYSTEM_RADIUS + 14);

    // Threat bar
    if (threatLevel > 0) {
      ctx.fillStyle = '#ff2200';
      ctx.fillRect(x - 15, y + SYSTEM_RADIUS + 18, 30 * threatLevel, 3);
    }
  }
}
