import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ConfigPanel } from '../coglog/ConfigPanel';
import { DEFAULT_CONFIG, serializeConfig, type TaskConfig } from '../coglog/config';

/**
 * Launch screen: the participant's entry point. Just the header and the task
 * options (no live canvas previews). Buttons start the experiment or the
 * tutorial, or copy a pre-configured shareable link.
 */
export function Launch() {
  const [config, setConfig] = useState<TaskConfig>(DEFAULT_CONFIG);
  const [copied, setCopied] = useState(false);

  const qs = serializeConfig(config);
  const expHref = qs ? `/experiment?${qs}` : '/experiment';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + expHref);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard may be unavailable (e.g. non-secure context); ignore silently.
    }
  };

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={S.brandRow}>
          <span style={S.brand}>CogLog</span>
          <span style={S.tag}>2.1 · VISUAL SEARCH TASK · DEMO</span>
        </div>
        <p style={S.blurb}>
          This is a demo of <strong style={S.strong}>CogLog</strong>, a research platform for studying
          attentional tunneling. It shows how the study works. Pan and zoom the color-gradient canvas
          to find the hidden <strong style={S.strong}>Gabor patch</strong> (it is small, so you will
          need to zoom in), click it, then classify its orientation. A wrong answer triggers a penalty.
          New to it? Start with the tutorial.
        </p>
      </header>

      <div style={S.center}>
        <ConfigPanel config={config} onChange={setConfig} />
        <div style={S.launchBox}>
          <Link to={expHref} style={S.primary}>
            LAUNCH EXPERIMENT →
          </Link>
          <Link to="/tutorial" style={S.tutorial}>
            START TUTORIAL
          </Link>
          <button style={S.copyBtn} onClick={copyLink}>
            {copied ? '✓ LINK COPIED' : 'COPY SHAREABLE LINK'}
          </button>
        </div>
      </div>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    padding: '48px 44px 56px',
    background: 'radial-gradient(120% 120% at 50% 0%, #2b2d33 0%, #202227 70%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 40,
  },
  header: { display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 640, textAlign: 'center' },
  brandRow: { display: 'flex', alignItems: 'baseline', gap: 14, justifyContent: 'center' },
  brand: {
    fontFamily: "'Baloo 2', sans-serif",
    fontWeight: 700,
    fontSize: 32,
    color: '#f4a400',
    letterSpacing: '-0.01em',
  },
  tag: { color: 'rgba(255,255,255,0.5)', fontSize: 12, letterSpacing: '0.14em' },
  blurb: {
    margin: 0,
    color: 'rgba(255,255,255,0.62)',
    fontSize: 13,
    lineHeight: 1.75,
    letterSpacing: '0.02em',
  },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: 260 },
  launchBox: { display: 'flex', flexDirection: 'column', gap: 8, width: 260 },
  primary: {
    textAlign: 'center',
    padding: '13px 14px',
    borderRadius: 10,
    background: '#f4a400',
    color: '#3a2b00',
    fontFamily: "'Space Mono', monospace",
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: '0.08em',
    textDecoration: 'none',
  },
  tutorial: {
    textAlign: 'center',
    padding: '11px 14px',
    borderRadius: 10,
    background: 'transparent',
    border: '1px solid rgba(244,164,0,0.55)',
    color: '#f4a400',
    fontFamily: "'Space Mono', monospace",
    fontSize: 11.5,
    letterSpacing: '0.1em',
    textDecoration: 'none',
  },
  copyBtn: {
    padding: '9px 14px',
    borderRadius: 9,
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.18)',
    color: 'rgba(255,255,255,0.6)',
    fontFamily: "'Space Mono', monospace",
    fontSize: 10.5,
    letterSpacing: '0.1em',
    cursor: 'pointer',
  },
  strong: { color: 'rgba(255,255,255,0.85)', fontWeight: 700 },
};
