import { STEP } from './physics.js';

/** Fixed physics steps; wall-clock gaps are capped so returning to a tab is safe. */
export class SimulationClock {
  constructor(step, render) { this.step = step; this.render = render; this.running = false; this.pending = 0; }
  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const frame = now => {
      if (!this.running) return;
      this.pending += Math.min((now - this.last) / 1000, 0.1);
      this.last = now;
      while (this.pending >= STEP && this.running) { this.pending -= STEP; this.step(); }
      this.render();
      if (this.running) this.id = requestAnimationFrame(frame);
    };
    this.id = requestAnimationFrame(frame);
  }
  pause() { this.running = false; cancelAnimationFrame(this.id); }
  reset() { this.pause(); this.pending = 0; }
}
