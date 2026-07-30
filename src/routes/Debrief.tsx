import { useState, type CSSProperties } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { ConditionLabel } from '../coglog/config';

interface DebriefState {
  correct?: number;
  answered?: number;
  trials?: number;
  condition?: ConditionLabel;
}

const CONDITION_MEANING: Record<ConditionLabel, string> = {
  Tunnel:
    'For most trials the target stayed within one small region of the canvas, drawing your attention to narrow onto that area — then on the final trial it jumped elsewhere, testing whether you had tunneled. (See “Learn more” below.)',
  Random:
    'Targets appeared anywhere across the canvas on every trial, keeping your search broad — the comparison condition.',
};

/**
 * End-of-task debrief. Explains the study and reveals the (previously hidden)
 * condition the participant was in. Reads results from router state; if opened
 * directly it degrades to the explanation without per-run stats.
 */
export function Debrief() {
  const state = (useLocation().state ?? {}) as DebriefState;
  const hasResults = typeof state.correct === 'number' && typeof state.answered === 'number';
  const acc = state.answered ? Math.round((state.correct! / state.answered) * 100) : 0;
  const condition = state.condition;
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.brandRow}>
          <span style={S.brand}>CogLog</span>
          <span style={S.tag}>DEBRIEF</span>
        </div>

        <h1 style={S.h1}>About this study</h1>

        <p style={S.p}>
          You just completed <strong style={S.strong}>CogLog</strong>, a visual-search task. You
          panned and zoomed a large color field to locate a hidden <em>Gabor patch</em> (a small
          striped circle), clicked it, and judged its orientation — against a timer, with a penalty
          for wrong answers.
        </p>
        <p style={S.p}>
          CogLog is built to study <strong style={S.strong}>attentional tunneling</strong>: when we
          concentrate hard on a demanding task, attention can narrow so much that we stop noticing or
          exploring other parts of a scene. Tasks like this let researchers bring on that state on
          purpose and develop non-invasive ways to detect it — so that a system could gently
          intervene before tunneling starts to hurt performance or safety.
        </p>

        {condition && (
          <div style={S.reveal}>
            <div style={S.revealLabel}>YOUR CONDITION</div>
            <div style={S.revealName}>{condition}</div>
            <p style={S.revealText}>{CONDITION_MEANING[condition]}</p>
          </div>
        )}

        {hasResults && (
          <div style={S.stats}>
            <span style={S.statValue}>
              {state.correct} / {state.trials ?? state.answered}
            </span>
            <span style={S.statLabel}>correct · accuracy {acc}%</span>
          </div>
        )}

        {!hasResults && (
          <p style={S.note}>Complete a run from the start screen to see your condition and score.</p>
        )}

        <button style={S.readMore} onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show less ▴' : 'Learn more ▾'}
        </button>

        {expanded && (
          <div style={S.more}>
            <section style={S.section}>
              <h2 style={S.h2}>Why this task exists</h2>
              <p style={S.p}>
                <strong style={S.strong}>Attentional tunneling</strong> is when someone concentrates
                so hard on one task or region that they stop scanning for other important information.
                It's a real risk in safety-critical, multitasking settings — driving, aviation,
                process control — where missing a signal can be costly. CogLog (first introduced by
                Kortschot &amp; Jamieson, 2020, and iterated since) is a lab tool that deliberately
                induces a mild version of this state so it can be studied and, ultimately, detected.
              </p>
            </section>

            <section style={S.section}>
              <h2 style={S.h2}>The two conditions</h2>
              <p style={S.p}>
                Trials run in blocks. Within a block, the early trials are the <em>prime</em> phase
                and the final trial is the <em>test</em> phase.
              </p>
              <p style={S.p}>
                <strong style={S.strong}>Tunnel (experimental).</strong> During the prime trials the
                hidden target stays confined to one small region of the canvas. Finding it there over
                and over draws your attention to narrow and settle on that area — inducing the tunnel.
                On the final <em>test</em> trial the target is moved to a different region: if your
                attention has tunneled, you're slower to break away and find it. The number of trials
                varies between blocks so participants can't count them and anticipate the switch.
              </p>
              <p style={S.p}>
                <strong style={S.strong}>Random (control).</strong> The target appears anywhere on the
                canvas on every trial — prime and test alike — so attention stays broad. This gives a
                baseline to compare the tunnel condition against.
              </p>
            </section>

            <section style={S.section}>
              <h2 style={S.h2}>How it trains a machine-learning model</h2>
              <p style={S.p}>
                While you play, CogLog <strong style={S.strong}>passively records how you interact</strong> —
                mouse movement, scrolling, zooming, where your viewport sits, how much of the canvas is
                visible, and how long trials and blocks take. This "passive data monitoring" needs no
                cameras or body sensors.
              </p>
              <p style={S.p}>
                Each block is labeled by its condition (tunnel vs. not), and rolling time-windows of
                these signals become training examples for a machine-learning classifier — a{' '}
                <strong style={S.strong}>Random Forest</strong> (scikit-learn) that learns to tell a
                tunneled state from a non-tunneled one. Adding richer contextual "trigger" features
                pushes accuracy past the ~74% baseline of earlier passive approaches. A reliable
                detector like this could let an <strong style={S.strong}>adaptive system</strong> notice
                tunneling as it happens and nudge the operator to look wider before it causes an error.
              </p>
              <p style={S.fine}>
                Based on a study of 45 participants at the University of Toronto (ethics-approved).
              </p>
            </section>
          </div>
        )}

        <div style={S.actions}>
          <Link to="/" style={S.secondary}>
            ← BACK TO START
          </Link>
          <Link to="/experiment" style={S.primary}>
            PLAY AGAIN →
          </Link>
        </div>
      </div>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    padding: '48px 24px',
    background: 'radial-gradient(120% 120% at 50% 0%, #2b2d33 0%, #202227 70%)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  card: {
    width: '100%',
    maxWidth: 640,
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
    padding: '32px 34px 34px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
  },
  brandRow: { display: 'flex', alignItems: 'baseline', gap: 12 },
  brand: {
    fontFamily: "'Baloo 2', sans-serif",
    fontWeight: 700,
    fontSize: 24,
    color: '#f4a400',
    letterSpacing: '-0.01em',
  },
  tag: { color: 'rgba(255,255,255,0.45)', fontSize: 11, letterSpacing: '0.22em' },
  h1: { margin: '4px 0 0', fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '0.01em' },
  p: {
    margin: 0,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13.5,
    lineHeight: 1.75,
    letterSpacing: '0.01em',
  },
  strong: { color: 'rgba(255,255,255,0.95)', fontWeight: 700 },
  reveal: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '16px 18px',
    background: 'rgba(244,164,0,0.08)',
    border: '1px solid rgba(244,164,0,0.35)',
    borderRadius: 12,
  },
  revealLabel: { fontSize: 10, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.5)' },
  revealName: {
    fontFamily: "'Baloo 2', sans-serif",
    fontWeight: 700,
    fontSize: 22,
    color: '#f4a400',
  },
  revealText: { margin: 0, color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 1.7 },
  stats: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 12,
    paddingTop: 4,
  },
  statValue: { fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 26, color: '#fff' },
  statLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 12, letterSpacing: '0.06em' },
  note: { margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: 12.5, fontStyle: 'italic' },
  readMore: {
    alignSelf: 'flex-start',
    padding: '8px 14px',
    borderRadius: 9,
    background: 'transparent',
    border: '1px solid rgba(244,164,0,0.5)',
    color: '#f4a400',
    fontFamily: "'Space Mono', monospace",
    fontSize: 11,
    letterSpacing: '0.08em',
    cursor: 'pointer',
  },
  more: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    paddingTop: 4,
    borderTop: '1px solid rgba(255,255,255,0.08)',
    marginTop: 2,
  },
  section: { display: 'flex', flexDirection: 'column', gap: 10 },
  h2: {
    margin: '8px 0 0',
    fontSize: 13,
    fontWeight: 700,
    color: '#f4a400',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  fine: { margin: 0, color: 'rgba(255,255,255,0.45)', fontSize: 11.5, fontStyle: 'italic' },
  actions: { display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' },
  secondary: {
    padding: '11px 16px',
    borderRadius: 10,
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    color: 'rgba(255,255,255,0.7)',
    fontFamily: "'Space Mono', monospace",
    fontSize: 11,
    letterSpacing: '0.08em',
    textDecoration: 'none',
  },
  primary: {
    padding: '11px 18px',
    borderRadius: 10,
    background: '#f4a400',
    color: '#3a2b00',
    fontFamily: "'Space Mono', monospace",
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: '0.08em',
    textDecoration: 'none',
  },
};
