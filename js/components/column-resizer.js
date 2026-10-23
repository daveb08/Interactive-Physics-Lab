/**
 * Resizable motion-graph column for the three-column lab workspace.
 *
 * On wide screens the graphs sit in the right-hand column. A handle on that column's left edge
 * can be dragged (mouse, pen or touch), moved with the arrow keys, or the "−"/"+" buttons in the
 * panel heading can be used. The simulation column takes up the remaining width.
 * Below the wide-screen breakpoint the graphs already span the full width, so the controls hide.
 *
 * The chosen width is kept in this browser only (localStorage, guarded: storage may be blocked).
 */
const KEY = 'ipl-graph-column';
const DEFAULT = 360;
const MIN = 260;
const STEP = 20;
const BUTTON_STEP = 80;
const WIDE = '(min-width: 1201px)';

/** Largest graph-column width that still leaves the controls and a usable simulation column. */
export function maxGraphWidth(workspaceWidth, { controls = 245, simulationMin = 320, gaps = 36 } = {}) {
  return Math.max(MIN, Math.floor(workspaceWidth - controls - simulationMin - gaps));
}

export function clampGraphWidth(width, workspaceWidth) {
  return Math.round(Math.min(Math.max(width, MIN), maxGraphWidth(workspaceWidth)));
}

export function initGraphResizer(workspace, panel) {
  if (!workspace || !panel) return null;
  workspace.classList.add('resizable-graphs');
  const read = () => { try { return Number(localStorage.getItem(KEY)) || null; } catch { return null; } };
  const save = value => { try { localStorage.setItem(KEY, String(value)); } catch { /* not stored */ } };

  const handle = document.createElement('div');
  handle.className = 'column-resizer';
  handle.tabIndex = 0;
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-orientation', 'vertical');
  handle.setAttribute('aria-label', 'Resize motion graphs. Use left and right arrow keys.');
  handle.innerHTML = '<span aria-hidden="true"></span>';
  panel.prepend(handle);

  const heading = panel.querySelector('.panel-heading');
  const buttons = document.createElement('div');
  buttons.className = 'graph-size';
  buttons.setAttribute('role', 'group');
  buttons.setAttribute('aria-label', 'Graph size');
  buttons.innerHTML = '<span aria-hidden="true">Size</span><button type="button" class="graph-narrower" aria-label="Narrower graphs">−</button><button type="button" class="graph-wider" aria-label="Wider graphs">+</button>';
  heading?.append(buttons);

  const wide = window.matchMedia(WIDE);
  let width = read() ?? DEFAULT;

  function apply(next, { store = false } = {}) {
    if (!wide.matches) { workspace.style.removeProperty('--graph-col'); return; }
    width = clampGraphWidth(next, workspace.clientWidth);
    workspace.style.setProperty('--graph-col', `${width}px`);
    const max = maxGraphWidth(workspace.clientWidth);
    handle.setAttribute('aria-valuemin', String(MIN));
    handle.setAttribute('aria-valuemax', String(max));
    handle.setAttribute('aria-valuenow', String(width));
    handle.setAttribute('aria-valuetext', `Graph column ${width} pixels wide`);
    buttons.querySelector('.graph-narrower').disabled = width <= MIN;
    buttons.querySelector('.graph-wider').disabled = width >= max;
    if (store) save(width);
  }

  // Width = distance from the pointer to the panel's right edge.
  let dragging = null;
  handle.addEventListener('pointerdown', event => {
    if (!wide.matches) return;
    event.preventDefault();
    dragging = { id: event.pointerId, right: panel.getBoundingClientRect().right };
    handle.setPointerCapture(event.pointerId);
    workspace.classList.add('resizing');
  });
  handle.addEventListener('pointermove', event => {
    if (!dragging || event.pointerId !== dragging.id) return;
    apply(dragging.right - event.clientX);
  });
  const stop = event => {
    if (!dragging || event.pointerId !== dragging.id) return;
    dragging = null;
    workspace.classList.remove('resizing');
    apply(width, { store: true });
  };
  handle.addEventListener('pointerup', stop);
  handle.addEventListener('pointercancel', stop);

  handle.addEventListener('keydown', event => {
    const big = event.shiftKey ? BUTTON_STEP : STEP;
    const moves = { ArrowLeft: width + big, ArrowRight: width - big, Home: MIN, End: Infinity };
    if (!(event.key in moves)) return;
    event.preventDefault();
    apply(moves[event.key], { store: true });
  });
  handle.addEventListener('dblclick', () => apply(DEFAULT, { store: true }));
  buttons.querySelector('.graph-narrower').addEventListener('click', () => apply(width - BUTTON_STEP, { store: true }));
  buttons.querySelector('.graph-wider').addEventListener('click', () => apply(width + BUTTON_STEP, { store: true }));

  window.addEventListener('resize', () => apply(width));
  wide.addEventListener?.('change', () => apply(width));
  apply(width);
  return { apply, get width() { return width; } };
}
