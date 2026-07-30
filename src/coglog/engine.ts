/* CogLog 2.1 engine: imperative interactive core (TypeScript port).
   Renders a pan/zoom color-gradient canvas with a hidden Gabor-patch target,
   minimap viewport indicator, orientation classification, penalty + trial flow.

   Ported verbatim from the design handoff (coglog-engine.js) so the visual
   output is pixel-identical: the math, constants and layout rules are
   unchanged. A canvas game is inherently imperative, so we keep the engine as
   a plain class and let React own only its mount/update/teardown lifecycle
   (see CogLog.tsx). createCogLog(root, opts) -> Engine instance. */

const AMBER = '#f4a400';
const BG = '#636363';
const RED = '#8e1b1b';
const WORLD_W = 2400;
const WORLD_H = 1500;
const ORIENTS = ['horizontal', 'vertical', 'diagonal'] as const;

export type Orient = (typeof ORIENTS)[number];
export type Variant = 'desktop' | 'mobile';
export type Condition = 'random' | 'tunnel';

export interface EngineOpts {
  variant: Variant;
  trials: number;
  penaltySeconds: number;
  contrast: number;
  targetSize: number;
  condition: Condition;
  showHud: boolean;
  /** Guided-tooltip walkthrough instead of a scored block. */
  tutorial?: boolean;
  /** Fired by the in-task "Back" button. */
  onExit?: () => void;
  /** Fired when a scored block finishes (not fired in tutorial mode). */
  onComplete?: (result: CompleteResult) => void;
}

export interface CompleteResult {
  correct: number;
  answered: number;
  trials: number;
}

type TutTrigger = 'pan' | 'zoom' | 'find' | 'answer' | null;
interface TutStep {
  text: string;
  trigger: TutTrigger;
}
const TUTORIAL_STEPS: TutStep[] = [
  { text: 'Drag anywhere to pan around the canvas.', trigger: 'pan' },
  { text: 'Scroll or pinch to zoom in. The Gabor patch is tiny.', trigger: 'zoom' },
  { text: 'Find the patch (a small striped circle) and click it.', trigger: 'find' },
  { text: 'Now classify its orientation using the panel.', trigger: 'answer' },
  { text: "That's the whole task. Start the demo when you're ready.", trigger: null },
];

type StyleInput = Partial<CSSStyleDeclaration> & Record<string, string>;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  style?: StyleInput,
  parent?: HTMLElement,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (style) Object.assign(e.style, style);
  if (parent) parent.appendChild(e);
  return e;
}
function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}
function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

/* ---- build the multi-hue world gradient (matches CogLog look) ---- */
function buildWorld(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = WORLD_W;
  c.height = WORLD_H;
  const x = c.getContext('2d')!;
  const cx = WORLD_W * 0.42;
  const cy = WORLD_H * 0.5;
  // conic hue wheel
  const g = x.createConicGradient ? x.createConicGradient(-2.2, cx, cy) : null;
  if (g) {
    const stops = [
      '#1f66ff', '#12c0ff', '#12e08a', '#8ef23a', '#f5e11a',
      '#ffa219', '#ff5a4d', '#ff4fd0', '#b83bff', '#5a3bff', '#1f66ff',
    ];
    for (let i = 0; i < stops.length; i++) g.addColorStop(i / (stops.length - 1), stops[i]);
    x.fillStyle = g;
  } else {
    x.fillStyle = '#8899aa';
  }
  x.fillRect(0, 0, WORLD_W, WORLD_H);
  // soft irregular light blobs so it isn't perfectly radial
  const blobs = [
    [0.42, 0.5, 0.62, 0.95],
    [0.66, 0.28, 0.3, 0.35],
    [0.3, 0.72, 0.34, 0.3],
  ];
  for (let b = 0; b < blobs.length; b++) {
    const bx = blobs[b][0] * WORLD_W;
    const by = blobs[b][1] * WORLD_H;
    const br = blobs[b][2] * WORLD_W;
    const rg = x.createRadialGradient(bx, by, 0, bx, by, br);
    rg.addColorStop(0, 'rgba(255,255,255,' + blobs[b][3] + ')');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = rg;
    x.fillRect(0, 0, WORLD_W, WORLD_H);
  }
  return c;
}

/* ---- render one Gabor patch to an offscreen canvas ---- */
function makeGabor(size: number, orient: Orient, contrast: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const x = c.getContext('2d')!;
  const img = x.createImageData(size, size);
  const d = img.data;
  let vx = 1;
  let vy = 0;
  if (orient === 'horizontal') {
    vx = 0;
    vy = 1;
  } else if (orient === 'diagonal') {
    vx = 0.7071;
    vy = 0.7071;
  }
  const freq = 4.5;
  const sigma = size / 5.5;
  const half = size / 2;
  for (let yy = 0; yy < size; yy++) {
    for (let xx = 0; xx < size; xx++) {
      const fx = xx - half;
      const fy = yy - half;
      const proj = fx * vx + fy * vy;
      const grating = Math.cos((2 * Math.PI * freq * proj) / size);
      const gauss = Math.exp(-(fx * fx + fy * fy) / (2 * sigma * sigma));
      const a = grating * gauss; // -1..1
      const lum = a > 0 ? 255 : 0;
      const alpha = Math.min(255, Math.abs(a) * contrast * 255);
      const idx = (yy * size + xx) * 4;
      d[idx] = lum;
      d[idx + 1] = lum;
      d[idx + 2] = lum;
      d[idx + 3] = alpha;
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}

interface TrialState {
  trial: number;
  correct: number;
  answered: number;
  orient: Orient;
  found: boolean;
  tx: number;
  ty: number;
  gabor: HTMLCanvasElement | null;
  trialStart: number;
}

interface DragState {
  sx: number;
  sy: number;
  ox: number;
  oy: number;
  moved: boolean;
}

interface OptBtn {
  btn: HTMLButtonElement;
  radio: HTMLSpanElement;
}

export class Engine {
  private root: HTMLElement;
  opts: EngineOpts;
  private world: HTMLCanvasElement;
  private state: TrialState;

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private hud!: HTMLDivElement;
  private logo!: HTMLDivElement;
  private logoWord!: HTMLDivElement;
  private spinDots: HTMLDivElement[] = [];
  private panel!: HTMLDivElement;
  private panelTitle!: HTMLDivElement;
  private optBtns: Record<string, OptBtn> = {};
  private hint!: HTMLDivElement;
  private mini!: HTMLCanvasElement;
  private miniCtx!: CanvasRenderingContext2D;
  private flash!: HTMLDivElement;
  private penalty!: HTMLDivElement;
  private penaltyBig!: HTMLDivElement;
  private penaltyMsg!: HTMLDivElement;
  private complete!: HTMLDivElement;
  private controls!: HTMLDivElement;
  private hudBtn!: HTMLButtonElement;
  private backBtn!: HTMLButtonElement;
  private tip!: HTMLDivElement;
  private tipText!: HTMLDivElement;
  private tipBtn!: HTMLButtonElement;
  private _tutStep = 0;

  private scale!: number;
  private minScale!: number;
  private maxScale!: number;
  private ox!: number;
  private oy!: number;
  private _cw = 0;
  private _ch = 0;
  private _dpr = 1;
  private _mdpr = 1;
  private _mm!: { w: number; h: number };
  private _mobRow?: HTMLDivElement;

  private _touches: Record<string, { x: number; y: number }> = {};
  private _drag: DragState | null = null;
  private _pinch: number | null = null;
  private _pinchScale = 1;
  private _penaltyActive = false;
  private _penTimer?: ReturnType<typeof setInterval>;

  private _ro: ResizeObserver;
  private _boundResize: () => void;
  private _onUpBound: (e: PointerEvent) => void;

  constructor(root: HTMLElement, opts?: Partial<EngineOpts>) {
    this.root = root;
    this.opts = Object.assign(
      {
        variant: 'desktop' as Variant,
        trials: 15,
        penaltySeconds: 15,
        contrast: 0.4,
        targetSize: 46,
        condition: 'random' as Condition,
        showHud: true,
        tutorial: false,
      },
      opts || {},
    );
    this.world = buildWorld();
    this.state = {} as TrialState;
    this._boundResize = this._relayout.bind(this);
    this._onUpBound = this._onUp.bind(this);
    this._build();
    this._ro = new ResizeObserver(this._boundResize);
    this._ro.observe(root);
    this._relayout();
    this._resetSession();
  }

  private _build(): void {
    const r = this.root;
    r.innerHTML = '';
    Object.assign(r.style, {
      position: 'relative',
      overflow: 'hidden',
      background: BG,
      fontFamily: "'Space Mono', ui-monospace, monospace",
      userSelect: 'none',
      webkitUserSelect: 'none',
      touchAction: 'none',
      cursor: 'grab',
    } as StyleInput);

    this.canvas = el('canvas', { position: 'absolute', display: 'block', borderRadius: '2px' }, r);
    this.ctx = this.canvas.getContext('2d')!;

    // HUD (top-left)
    this.hud = el(
      'div',
      {
        position: 'absolute', left: '16px', top: '12px', zIndex: '6',
        color: 'rgba(255,255,255,0.82)', fontSize: '11px', letterSpacing: '0.08em',
        lineHeight: '1.5', textShadow: '0 1px 2px rgba(0,0,0,0.35)', pointerEvents: 'none',
      },
      r,
    );

    // logo
    this.logo = el(
      'div',
      { position: 'absolute', zIndex: '6', pointerEvents: 'none', display: 'flex', alignItems: 'flex-start', gap: '3px' },
      r,
    );
    const word = el(
      'div',
      {
        fontFamily: "'Baloo 2', system-ui, sans-serif", fontWeight: '700',
        color: AMBER, lineHeight: '1', letterSpacing: '-0.01em',
      },
      this.logo,
    );
    word.textContent = 'CogLog';
    this.logoWord = word;
    const dots = el('div', { position: 'relative', width: '22px', height: '22px' }, this.logo);
    this.spinDots = [];
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const dot = el(
        'div',
        {
          position: 'absolute', width: '4px', height: '4px', borderRadius: '50%',
          background: AMBER, left: 11 + Math.cos(ang) * 8 - 2 + 'px',
          top: 9 + Math.sin(ang) * 8 - 2 + 'px',
          animation: 'coglogSpin 1.1s ease-in-out infinite', animationDelay: i * 0.12 + 's',
        },
        dots,
      );
      this.spinDots.push(dot);
    }

    // orientation panel
    this.panel = el('div', { position: 'absolute', zIndex: '7' }, r);
    this.panelTitle = el(
      'div',
      {
        color: 'rgba(255,255,255,0.9)', fontSize: '10px', letterSpacing: '0.16em',
        marginBottom: '10px', textTransform: 'uppercase',
      },
      this.panel,
    );
    this.panelTitle.textContent = 'Orientation';
    this.optBtns = {};
    const self = this;
    (['Horizontal', 'Vertical', 'Diagonal'] as const).forEach((label) => {
      const btn = el(
        'button',
        {
          display: 'flex', alignItems: 'center', gap: '9px', background: 'transparent',
          border: 'none', padding: '7px 4px', cursor: 'pointer', width: '100%',
          textAlign: 'left', opacity: '0.4', transition: 'opacity .15s',
        },
        self.panel,
      );
      const radio = el(
        'span',
        {
          width: '13px', height: '13px', borderRadius: '50%', flex: '0 0 auto',
          border: '2px solid rgba(255,255,255,0.85)', background: 'transparent',
          transition: 'background .1s',
        },
        btn,
      );
      const txt = el(
        'span',
        {
          color: 'rgba(255,255,255,0.92)', fontSize: '11px', letterSpacing: '0.1em',
          fontFamily: "'Space Mono', monospace",
        },
        btn,
      );
      txt.textContent = label;
      btn.addEventListener('click', function () {
        self._answer(label.toLowerCase() as Orient, radio);
      });
      self.optBtns[label.toLowerCase()] = { btn, radio };
    });
    this.hint = el('div', {}); // detached: no on-screen copy

    // minimap
    this.mini = el(
      'canvas',
      {
        position: 'absolute', zIndex: '6', border: '3px solid ' + RED,
        borderRadius: '2px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', cursor: 'pointer',
      },
      r,
    );
    this.miniCtx = this.mini.getContext('2d')!;
    this.mini.addEventListener('pointerdown', function (e) {
      self._miniJump(e);
    });

    // flash ring
    this.flash = el(
      'div',
      {
        position: 'absolute', zIndex: '8', pointerEvents: 'none', borderRadius: '3px',
        boxShadow: 'inset 0 0 0 3px rgba(80,220,120,0)', transition: 'box-shadow .2s',
      },
      r,
    );

    // penalty overlay
    this.penalty = el(
      'div',
      {
        position: 'absolute', inset: '0', zIndex: '20', display: 'none',
        alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '10px',
        background: 'rgba(20,20,20,0.82)', color: '#fff', textAlign: 'center',
        fontFamily: "'Space Mono', monospace",
      },
      r,
    );
    this.penaltyBig = el('div', { fontSize: '44px', fontWeight: '700', color: '#ff6b6b' }, this.penalty);
    this.penaltyMsg = el('div', { fontSize: '12px', letterSpacing: '0.12em', opacity: '0.85' }, this.penalty);
    this.penaltyMsg.textContent = 'INCORRECT · PENALTY';

    // complete overlay
    this.complete = el(
      'div',
      {
        position: 'absolute', inset: '0', zIndex: '21', display: 'none',
        alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '14px',
        background: 'rgba(25,25,25,0.9)', color: '#fff', textAlign: 'center', padding: '24px',
      },
      r,
    );

    // right-bar controls: back + HUD toggle
    this.controls = el('div', { position: 'absolute', zIndex: '9', display: 'flex' }, r);
    const ctrlStyle: StyleInput = {
      background: 'rgba(20,20,20,0.55)', border: '1px solid rgba(255,255,255,0.18)',
      color: 'rgba(255,255,255,0.82)', fontFamily: "'Space Mono', monospace", fontSize: '10px',
      letterSpacing: '0.08em', padding: '7px 8px', borderRadius: '8px', cursor: 'pointer',
      whiteSpace: 'nowrap',
    };
    this.hudBtn = el('button', ctrlStyle, this.controls);
    this.hudBtn.textContent = 'HIDE HUD';
    this.hudBtn.addEventListener('click', function () {
      self.opts.showHud = !self.opts.showHud;
      self.hudBtn.textContent = self.opts.showHud ? 'HIDE HUD' : 'SHOW HUD';
      self._render();
    });
    this.backBtn = el('button', ctrlStyle, this.controls);
    this.backBtn.textContent = '← BACK';
    this.backBtn.addEventListener('click', function () {
      if (self.opts.onExit) self.opts.onExit();
    });

    // tutorial tooltip (top-center), shown only in tutorial mode
    this.tip = el(
      'div',
      {
        position: 'absolute', zIndex: '15', display: 'none', left: '50%', top: '18px',
        transform: 'translateX(-50%)', maxWidth: '78%', background: 'rgba(18,18,18,0.92)',
        border: '1px solid rgba(244,164,0,0.55)', borderRadius: '10px', padding: '10px 14px',
        color: '#fff', fontSize: '12px', letterSpacing: '0.03em', lineHeight: '1.5',
        textAlign: 'center', boxShadow: '0 6px 22px rgba(0,0,0,0.45)',
      },
      r,
    );
    this.tipText = el('div', {}, this.tip);
    this.tipBtn = el(
      'button',
      {
        marginTop: '9px', display: 'none', padding: '7px 16px', border: 'none', borderRadius: '8px',
        background: AMBER, color: '#3a2b00', fontWeight: '700', cursor: 'pointer',
        fontFamily: "'Space Mono', monospace", fontSize: '11px', letterSpacing: '0.06em',
      },
      this.tip,
    );
    this.tipBtn.textContent = 'FINISH ↗';
    this.tipBtn.addEventListener('click', function () {
      if (self.opts.onExit) self.opts.onExit();
    });

    // pointer handlers
    this.canvas.addEventListener('pointerdown', this._onDown.bind(this));
    this.canvas.addEventListener('pointermove', this._onMove.bind(this));
    window.addEventListener('pointerup', this._onUpBound);
    this.canvas.addEventListener('wheel', this._onWheel.bind(this), { passive: false });
    // touch pinch
    this._touches = {};
  }

  /* ---- tutorial ---- */
  private _tut(kind: Exclude<TutTrigger, null>): void {
    if (!this.opts.tutorial) return;
    const step = TUTORIAL_STEPS[this._tutStep];
    if (step && step.trigger === kind) {
      this._tutStep++;
      this._tutShow();
    }
  }
  private _tutShow(): void {
    if (!this.opts.tutorial) {
      this.tip.style.display = 'none';
      return;
    }
    const step = TUTORIAL_STEPS[this._tutStep];
    if (!step) {
      this.tip.style.display = 'none';
      return;
    }
    this.tipText.textContent = step.text;
    this.tipBtn.style.display = step.trigger === null ? 'inline-block' : 'none';
    this.tip.style.display = 'block';
  }

  private _resetSession(): void {
    this.state.trial = 0;
    this.state.correct = 0;
    this.state.answered = 0;
    this.complete.style.display = 'none';
    this._tutStep = 0;
    this._tutShow();
    this._fit();
    this._newTrial();
  }

  private _newTrial(): void {
    this.state.trial++;
    if (this.state.trial > this.opts.trials) {
      return this._finish();
    }
    this.state.orient = ORIENTS[(Math.random() * 3) | 0];
    this.state.found = false;
    // placement: tunnel condition confines prime trials to a quadrant
    let px: number;
    let py: number;
    const m = 120;
    if (this.opts.condition === 'tunnel' && this.state.trial < this.opts.trials) {
      px = rand(WORLD_W * 0.55, WORLD_W * 0.9);
      py = rand(WORLD_H * 0.1, WORLD_H * 0.42);
    } else {
      px = rand(m, WORLD_W - m);
      py = rand(m, WORLD_H - m);
    }
    this.state.tx = px;
    this.state.ty = py;
    this.state.gabor = makeGabor(160, this.state.orient, this.opts.contrast);
    this.state.trialStart = performance.now();
    this._updatePanel();
    this._render();
  }

  private _finish(): void {
    // In the participant flow, React routes to the debrief page. The built-in
    // overlay is only the fallback when no onComplete handler is wired.
    if (this.opts.onComplete) {
      this.opts.onComplete({
        correct: this.state.correct,
        answered: this.state.answered,
        trials: this.opts.trials,
      });
      return;
    }
    const acc = this.state.answered ? Math.round((this.state.correct / this.state.answered) * 100) : 0;
    this.complete.innerHTML = '';
    const t = el(
      'div',
      { fontFamily: "'Baloo 2', sans-serif", fontWeight: '700', color: AMBER, fontSize: '26px' },
      this.complete,
    );
    t.textContent = 'Block complete';
    const s = el(
      'div',
      { fontFamily: "'Space Mono', monospace", fontSize: '13px', letterSpacing: '0.08em', lineHeight: '1.7', opacity: '0.9' },
      this.complete,
    );
    s.innerHTML = this.state.correct + ' / ' + this.opts.trials + ' correct<br>Accuracy ' + acc + '%';
    const self = this;
    const b = el(
      'button',
      {
        marginTop: '6px', padding: '10px 20px', borderRadius: '10px', border: 'none',
        background: AMBER, color: '#3a2b00', fontWeight: '700', cursor: 'pointer',
        fontFamily: "'Space Mono', monospace", fontSize: '12px', letterSpacing: '0.06em',
      },
      this.complete,
    );
    b.textContent = 'PLAY AGAIN';
    b.addEventListener('click', function () {
      self._resetSession();
    });
    this.complete.style.display = 'flex';
  }

  /* ---- view transform ---- */
  private _fit(): void {
    const cw = this._cw;
    const ch = this._ch;
    if (!cw || !ch) return;
    const fit = Math.min(cw / WORLD_W, ch / WORLD_H);
    this.minScale = fit;
    this.maxScale = fit * 7;
    this.scale = fit * 1.9;
    // center
    const srcW = cw / this.scale;
    const srcH = ch / this.scale;
    this.ox = (WORLD_W - srcW) / 2;
    this.oy = (WORLD_H - srcH) / 2;
    this._clampView();
  }
  private _clampView(): void {
    const cw = this._cw;
    const ch = this._ch;
    const srcW = cw / this.scale;
    const srcH = ch / this.scale;
    this.ox = srcW >= WORLD_W ? (WORLD_W - srcW) / 2 : clamp(this.ox, 0, WORLD_W - srcW);
    this.oy = srcH >= WORLD_H ? (WORLD_H - srcH) / 2 : clamp(this.oy, 0, WORLD_H - srcH);
  }
  private _zoomAt(fx: number, fy: number, factor: number): void {
    const cw = this._cw;
    const ch = this._ch;
    const wx = this.ox + (fx * cw) / this.scale;
    const wy = this.oy + (fy * ch) / this.scale;
    this.scale = clamp(this.scale * factor, this.minScale, this.maxScale);
    this.ox = wx - (fx * cw) / this.scale;
    this.oy = wy - (fy * ch) / this.scale;
    this._clampView();
    this._render();
    this._tut('zoom');
  }

  /* ---- input ---- */
  private _onDown(e: PointerEvent): void {
    this.canvas.setPointerCapture && this.canvas.setPointerCapture(e.pointerId);
    this._touches[e.pointerId] = { x: e.clientX, y: e.clientY };
    const ids = Object.keys(this._touches);
    if (ids.length === 1) {
      this._drag = { sx: e.clientX, sy: e.clientY, ox: this.ox, oy: this.oy, moved: false };
      this.root.style.cursor = 'grabbing';
    } else if (ids.length === 2) {
      this._drag = null;
      this._pinch = this._pinchDist();
      this._pinchScale = this.scale;
    }
  }
  private _pinchDist(): number {
    const ids = Object.keys(this._touches);
    const a = this._touches[ids[0]];
    const b = this._touches[ids[1]];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  private _onMove(e: PointerEvent): void {
    if (!this._touches[e.pointerId]) return;
    this._touches[e.pointerId] = { x: e.clientX, y: e.clientY };
    const ids = Object.keys(this._touches);
    if (ids.length >= 2 && this._pinch) {
      const d = this._pinchDist();
      const target = clamp(this._pinchScale * (d / this._pinch), this.minScale, this.maxScale);
      const cur = this.scale;
      this.scale = cur; // keep, use zoomAt around center
      this._zoomAt(0.5, 0.5, target / cur);
      return;
    }
    if (this._drag) {
      const dx = e.clientX - this._drag.sx;
      const dy = e.clientY - this._drag.sy;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) this._drag.moved = true;
      if (this._drag.moved) this._tut('pan');
      this.ox = this._drag.ox - dx / this.scale;
      this.oy = this._drag.oy - dy / this.scale;
      this._clampView();
      this._render();
    }
  }
  private _onUp(e: PointerEvent): void {
    const wasDrag = this._drag;
    delete this._touches[e.pointerId];
    if (Object.keys(this._touches).length < 2) this._pinch = null;
    this.root.style.cursor = 'grab';
    if (wasDrag && !wasDrag.moved && !this.state.found) {
      const rect = this.canvas.getBoundingClientRect();
      this._tryHit(e.clientX - rect.left, e.clientY - rect.top);
    }
    this._drag = null;
  }
  private _onWheel(e: WheelEvent): void {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / this._cw;
    const fy = (e.clientY - rect.top) / this._ch;
    const factor = Math.pow(1.0016, -e.deltaY);
    this._zoomAt(clamp(fx, 0, 1), clamp(fy, 0, 1), factor);
  }
  private _miniJump(e: PointerEvent): void {
    const rect = this.mini.getBoundingClientRect();
    const mm = Math.min(this.mini.width / WORLD_W, this.mini.height / WORLD_H) / this._mdpr;
    const wx = (e.clientX - rect.left) / mm;
    const wy = (e.clientY - rect.top) / mm;
    const srcW = this._cw / this.scale;
    const srcH = this._ch / this.scale;
    this.ox = wx - srcW / 2;
    this.oy = wy - srcH / 2;
    this._clampView();
    this._render();
  }

  private _tryHit(cx: number, cy: number): void {
    const wx = this.ox + cx / this.scale;
    const wy = this.oy + cy / this.scale;
    const r = Math.max(this.opts.targetSize * 0.9, 16 / this.scale);
    if (Math.hypot(wx - this.state.tx, wy - this.state.ty) <= r) {
      this.state.found = true;
      this._tut('find');
      this._updatePanel();
      this._render();
    }
  }

  private _answer(choice: Orient, radio: HTMLSpanElement): void {
    if (!this.state.found || this._penaltyActive) return;
    this.state.answered++;
    this._tut('answer');
    // clear radios then fill chosen
    const self = this;
    Object.keys(this.optBtns).forEach(function (k) {
      self.optBtns[k].radio.style.background = 'transparent';
    });
    radio.style.background = '#fff';
    if (choice === this.state.orient) {
      this.state.correct++;
      this._flash('#4fd97a');
      setTimeout(function () {
        self._newTrial();
      }, 260);
    } else {
      this._flash('#ff5a5a');
      this._runPenalty();
    }
  }

  private _runPenalty(): void {
    const self = this;
    this._penaltyActive = true;
    let left = this.opts.penaltySeconds;
    this.penalty.style.display = 'flex';
    this.penaltyBig.textContent = String(left);
    this._penTimer = setInterval(function () {
      left--;
      self.penaltyBig.textContent = String(left);
      if (left <= 0) {
        clearInterval(self._penTimer);
        self.penalty.style.display = 'none';
        self._penaltyActive = false;
        self._newTrial();
      }
    }, 1000);
  }

  private _flash(col: string): void {
    const f = this.flash;
    f.style.boxShadow = 'inset 0 0 0 4px ' + col;
    setTimeout(function () {
      f.style.boxShadow = 'inset 0 0 0 3px rgba(0,0,0,0)';
    }, 240);
  }

  private _updatePanel(): void {
    const found = this.state.found;
    const self = this;
    Object.keys(this.optBtns).forEach(function (k) {
      const o = self.optBtns[k];
      o.btn.style.opacity = found ? '1' : '0.4';
      o.btn.style.cursor = found ? 'pointer' : 'not-allowed';
      o.radio.style.background = 'transparent';
    });
    this.hint.textContent = found
      ? 'Classify the patch you found.'
      : 'Pan & zoom to find the hidden Gabor patch, then click it.';
    this.hint.style.color = found ? 'rgba(120,230,150,0.9)' : 'rgba(255,255,255,0.55)';
    this.panelTitle.style.color = found ? AMBER : 'rgba(255,255,255,0.9)';
  }

  /* ---- layout ---- */
  private _relayout(): void {
    const W = this.root.clientWidth;
    const H = this.root.clientHeight;
    if (!W || !H) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const mobile = this.opts.variant === 'mobile' || W < 560;
    const pad = mobile ? 10 : 16;
    let cRect: { x: number; y: number; w: number; h: number };
    if (mobile) {
      const topH = 46;
      const botH = 104;
      cRect = { x: pad, y: topH, w: W - pad * 2, h: H - topH - botH };
      this.logoWord.style.fontSize = '22px';
      Object.assign(this.logo.style, { left: pad + 'px', top: '10px', right: 'auto' });
      // bottom bar panel
      Object.assign(this.panel.style, {
        left: pad + 'px', right: pad + 'px', bottom: '10px', top: 'auto',
        display: 'flex', flexDirection: 'column', gap: '4px',
        background: 'rgba(40,40,40,0.35)', borderRadius: '12px', padding: '8px 12px',
      } as StyleInput);
      this.panelTitle.style.display = 'none';
      // arrange option buttons in a row via wrapper: set panel row for buttons
      this._layoutMobilePanel();
      const mmW = 118;
      const mmH = 74;
      Object.assign(this.mini.style, { right: pad + 'px', bottom: botH + 6 + 'px', top: 'auto', left: 'auto' });
      this._mm = { w: mmW, h: mmH };
      Object.assign(this.hud.style, { left: pad + 4 + 'px', top: '14px', fontSize: '10px' });
      // controls: compact row top-right (opposite the logo)
      Object.assign(this.controls.style, {
        right: pad + 'px', top: '12px', left: 'auto', bottom: 'auto',
        flexDirection: 'row', gap: '6px', width: 'auto',
      } as StyleInput);
      this.hudBtn.style.flex = '0 0 auto';
      this.backBtn.style.flex = '0 0 auto';
    } else {
      const sideW = 156;
      cRect = { x: pad, y: pad, w: W - sideW - pad * 3, h: H - pad * 2 };
      const sideX = W - sideW - pad;
      this.logoWord.style.fontSize = '26px';
      Object.assign(this.logo.style, { left: sideX + 'px', top: pad + 2 + 'px', right: 'auto' });
      Object.assign(this.panel.style, {
        left: sideX + 'px', top: pad + 66 + 'px', bottom: 'auto', right: 'auto',
        width: sideW + 'px', display: 'block', background: 'transparent', padding: '0',
      } as StyleInput);
      this.panelTitle.style.display = 'block';
      this._layoutDesktopPanel();
      const mmW2 = 138;
      const mmH2 = 86;
      Object.assign(this.mini.style, { left: sideX + 'px', bottom: pad + 'px', top: 'auto', right: 'auto' });
      this._mm = { w: mmW2, h: mmH2 };
      Object.assign(this.hud.style, { left: pad + 10 + 'px', top: pad + 6 + 'px', fontSize: '11px' });
      // controls: row sitting just above the minimap in the right bar
      Object.assign(this.controls.style, {
        left: sideX + 'px', bottom: pad + mmH2 + 10 + 'px', top: 'auto', right: 'auto',
        width: sideW + 'px', flexDirection: 'row', gap: '6px',
      } as StyleInput);
      this.hudBtn.style.flex = '1';
      this.backBtn.style.flex = '1';
    }

    // size canvas
    Object.assign(this.canvas.style, {
      left: cRect.x + 'px', top: cRect.y + 'px', width: cRect.w + 'px', height: cRect.h + 'px',
    });
    this.canvas.width = Math.round(cRect.w * dpr);
    this.canvas.height = Math.round(cRect.h * dpr);
    this._cw = cRect.w;
    this._ch = cRect.h;
    this._dpr = dpr;
    Object.assign(this.flash.style, {
      left: cRect.x + 'px', top: cRect.y + 'px', width: cRect.w + 'px', height: cRect.h + 'px',
    });

    // minimap sizing
    const mdpr = dpr;
    this.mini.width = this._mm.w * mdpr;
    this.mini.height = this._mm.h * mdpr;
    this.mini.style.width = this._mm.w + 'px';
    this.mini.style.height = this._mm.h + 'px';
    this._mdpr = mdpr;

    if (this.scale == null || !isFinite(this.scale)) this._fit();
    else this._clampView();
    this._render();
  }

  private _layoutDesktopPanel(): void {
    const self = this;
    Object.keys(this.optBtns).forEach(function (k) {
      Object.assign(self.optBtns[k].btn.style, {
        flexDirection: 'row', width: '100%', justifyContent: 'flex-start', padding: '7px 4px',
      });
    });
    this.hint.style.marginTop = '10px';
  }
  private _layoutMobilePanel(): void {
    const self = this;
    // wrap buttons in a row: move hint above, buttons below in flex row
    if (!this._mobRow) {
      this._mobRow = el('div', { display: 'flex', gap: '6px', width: '100%' });
      // reinsert buttons into row
      const order = ['horizontal', 'vertical', 'diagonal'];
      const self2 = this;
      order.forEach(function (k) {
        self2._mobRow!.appendChild(self2.optBtns[k].btn);
      });
      this.panel.appendChild(this._mobRow);
    }
    const order = ['horizontal', 'vertical', 'diagonal'];
    order.forEach(function (k) {
      Object.assign(self.optBtns[k].btn.style, {
        flexDirection: 'column', gap: '5px', flex: '1', justifyContent: 'center',
        alignItems: 'center', padding: '9px 4px', background: 'rgba(255,255,255,0.08)',
        borderRadius: '9px',
      });
    });
    this.hint.style.marginTop = '0';
    this.hint.style.marginBottom = '7px';
    this.hint.style.textAlign = 'center';
  }

  /* ---- render ---- */
  private _render(): void {
    if (!this._cw) return;
    const dpr = this._dpr;
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const srcW = this._cw / this.scale;
    const srcH = this._ch / this.scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.world, this.ox, this.oy, srcW, srcH, 0, 0, cw, ch);
    // gabor
    if (this.state.gabor) {
      const sx = (this.state.tx - this.opts.targetSize - this.ox) * this.scale * dpr;
      const sy = (this.state.ty - this.opts.targetSize - this.oy) * this.scale * dpr;
      const ss = this.opts.targetSize * 2 * this.scale * dpr;
      ctx.drawImage(this.state.gabor, sx, sy, ss, ss);
      if (this.state.found) {
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.lineWidth = 2 * dpr;
        const cxp = (this.state.tx - this.ox) * this.scale * dpr;
        const cyp = (this.state.ty - this.oy) * this.scale * dpr;
        const rr = (this.opts.targetSize + 10) * this.scale * dpr;
        ctx.beginPath();
        ctx.arc(cxp, cyp, rr, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    this._renderMini();
    this._renderHud();
  }

  private _renderMini(): void {
    const mx = this.miniCtx;
    const mdpr = this._mdpr;
    const mm = Math.min(this.mini.width / WORLD_W, this.mini.height / WORLD_H);
    mx.setTransform(1, 0, 0, 1, 0, 0);
    mx.clearRect(0, 0, this.mini.width, this.mini.height);
    mx.drawImage(this.world, 0, 0, this.mini.width, this.mini.height);
    const srcW = this._cw / this.scale;
    const srcH = this._ch / this.scale;
    mx.strokeStyle = RED;
    mx.lineWidth = 2 * mdpr;
    mx.strokeRect(this.ox * mm, this.oy * mm, srcW * mm, srcH * mm);
  }

  private _renderHud(): void {
    if (this.opts.showHud === false) {
      this.hud.style.display = 'none';
      return;
    }
    this.hud.style.display = 'block';
    const srcW = this._cw / this.scale;
    const srcH = this._ch / this.scale;
    const vis = Math.round(((srcW * srcH) / (WORLD_W * WORLD_H)) * 100);
    const t = ((performance.now() - (this.state.trialStart || performance.now())) / 1000).toFixed(1);
    const pad2 = function (n: number) {
      return (n < 10 ? '0' : '') + n;
    };
    this.hud.innerHTML =
      'TRIAL ' + pad2(Math.min(this.state.trial, this.opts.trials)) + ' / ' + this.opts.trials +
      '<br>⏱ ' + t + 's' +
      '<br>VIEW ' + vis + '%';
  }

  setOpts(opts: Partial<EngineOpts>): void {
    Object.assign(this.opts, opts);
    this._resetSession();
    this._relayout();
  }
  destroy(): void {
    if (this._ro) this._ro.disconnect();
    if (this._penTimer) clearInterval(this._penTimer);
    window.removeEventListener('pointerup', this._onUpBound);
    this.root.innerHTML = '';
  }
}

export function createCogLog(root: HTMLElement, opts?: Partial<EngineOpts>): Engine {
  return new Engine(root, opts);
}
