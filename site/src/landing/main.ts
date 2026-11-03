/**
 * Landing page entry. First paint needs none of this: the poster and the copy
 * are server HTML. This file adds the theme toggle and copy buttons at once,
 * and loads the engine and the live demos after `load`, on idle.
 */
import { setIcon } from '../shared/dom';
import { iconSvg } from '../shared/icons';
import { THEME_LABEL, applyTheme, nextTheme, readTheme, writeTheme } from '../shared/theme';
import type { Theme } from '../shared/theme';
import { detectTier, reducedMotionQuery } from '../shared/tier';
import type { Tier } from '../shared/tier';

const root = document.documentElement;
const params = new URLSearchParams(location.search);
const captureT =
  params.get('demo') === 'signature' && params.has('t') ? Number(params.get('t')) : null;
const capture = params.has('capture');

// ---- tier ------------------------------------------------------------------
let tier: Tier = detectTier();
if (params.has('tier')) tier = Math.min(2, Math.max(0, Number(params.get('tier')))) as Tier;
root.dataset.tier = String(tier);

// ---- theme toggle -----------------------------------------------------------
{
  const btn = document.getElementById('theme-toggle');
  let theme: Theme = readTheme();
  const paint = (): void => {
    if (!btn) return;
    const next = nextTheme(theme);
    const icon = theme === 'light' ? 'sun' : theme === 'dark' ? 'moon' : 'monitor';
    setIcon(btn, iconSvg(icon, 16));
    btn.setAttribute('aria-label', `Theme: ${THEME_LABEL[theme]}. Switch to ${THEME_LABEL[next]}`);
    btn.title = `Theme: ${THEME_LABEL[theme]}`;
  };
  applyTheme(theme);
  paint();
  btn?.addEventListener('click', () => {
    theme = nextTheme(theme);
    writeTheme(theme);
    applyTheme(theme);
    paint();
  });
}

// ---- repository link ---------------------------------------------------------
// The published repository is written into index.html. A fork can point the page
// at its own copy at build time with VITE_REPO_URL.
{
  const DEFAULT_REPO = 'https://github.com/NINJA981/readback';
  const repo = (import.meta.env.VITE_REPO_URL ?? '').trim();
  if (repo && repo !== DEFAULT_REPO) {
    for (const id of ['source-link', 'footer-source']) {
      const a = document.getElementById(id);
      if (a instanceof HTMLAnchorElement) a.href = repo;
    }
    const build = document.getElementById('cmd-build');
    if (build?.textContent) build.textContent = build.textContent.replace(DEFAULT_REPO, repo);
  }
}

// ---- copy buttons ------------------------------------------------------------
for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-copy]')) {
  const icon = btn.querySelector('[data-icon]');
  const label = btn.querySelector('[data-label]');
  if (icon) setIcon(icon, iconSvg('copy', 16));
  let timer = 0;
  btn.addEventListener('click', () => {
    const code = document.getElementById(btn.dataset.copy ?? '');
    const text = code?.textContent ?? '';
    const done = (ok: boolean): void => {
      if (icon) setIcon(icon, iconSvg(ok ? 'check' : 'copy', 16));
      if (label) label.textContent = ok ? 'Copied' : 'Select and copy';
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (icon) setIcon(icon, iconSvg('copy', 16));
        if (label) label.textContent = 'Copy';
      }, 1800);
    };
    navigator.clipboard.writeText(text).then(
      () => {
        done(true);
      },
      () => {
        done(false);
      },
    );
  });
}

// ---- privacy meter ------------------------------------------------------------
function paintMeter(): void {
  const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const origin = location.origin;
  const foreign = entries.filter((e) => {
    try {
      return new URL(e.name).origin !== origin;
    } catch {
      return true;
    }
  }).length;
  const set = (id: string, value: string): void => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  set('meter-total', String(entries.length + 1));
  set('meter-third', String(foreign));
  set('meter-cookies', String(document.cookie ? document.cookie.split(';').length : 0));
}

// ---- engine-backed parts -------------------------------------------------------
/** Gives the browser a chance to paint and handle input between two chunks of start-up work. */
const yieldToMain = (): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });

const engineReady = (): Promise<typeof import('../shared/engine')> => import('../shared/engine');

async function startHero(eng: typeof import('../shared/engine')): Promise<void> {
  const stage = document.getElementById('stage');
  const controls = document.getElementById('stage-controls');
  if (!stage || !controls) return;
  const { mountHero, DEMO_MS, KEYFRAMES, PLAY_FROM, setButton } = await import('./demo');
  await document.fonts.ready;

  const reducedMq = reducedMotionQuery();
  const narrowMq = matchMedia('(max-width: 767px)');
  stage.dataset.tier = String(tier);
  if (capture) stage.dataset.capture = '';

  let hero: ReturnType<typeof mountHero> | undefined;
  let stepTimer = 0;
  let stepping = false;
  let stepIndex = 0;
  let started = false;
  const toggle = document.getElementById('demo-toggle') as HTMLButtonElement;
  const replay = document.getElementById('demo-replay') as HTMLButtonElement;

  const reduced = (): boolean => reducedMq.matches || tier === 0;
  const label = (): void => {
    if (!hero) return;
    const running = hero.playing || stepping;
    if (running) setButton(toggle, 'pause', 'Pause');
    else if (started && hero.time < DEMO_MS && !reduced()) setButton(toggle, 'play', 'Resume');
    else setButton(toggle, 'play', 'Play the demo');
    setButton(replay, 'rotate-ccw');
  };

  const mount = (): void => {
    hero?.destroy();
    window.clearTimeout(stepTimer);
    stepping = false;
    hero = mountHero({
      stage,
      eng,
      layout: narrowMq.matches ? 'narrow' : 'wide',
      reduced: reduced(),
    });
    hero.onChange(label);
    stage.dataset.state = 'live';
    label();
  };
  mount();
  controls.hidden = captureT !== null || capture;

  const stepNext = (): void => {
    if (!hero) return;
    if (stepIndex >= KEYFRAMES.length) {
      stepping = false;
      label();
      return;
    }
    hero.frame(KEYFRAMES[stepIndex] ?? 0);
    stepIndex += 1;
    stepping = true;
    label();
    stepTimer = window.setTimeout(stepNext, 2600);
  };

  const startPlayback = (): void => {
    if (!hero) return;
    started = true;
    stage.dataset.state = 'playing';
    if (reduced()) {
      stepIndex = 0;
      window.clearTimeout(stepTimer);
      stepNext();
    } else {
      hero.play(PLAY_FROM);
    }
  };

  toggle.addEventListener('click', () => {
    if (!hero) return;
    if (reduced()) {
      if (stepping) {
        window.clearTimeout(stepTimer);
        stepping = false;
        label();
      } else if (started && stepIndex < KEYFRAMES.length) {
        stepNext();
      } else {
        startPlayback();
      }
      return;
    }
    if (hero.playing) hero.pause();
    else if (started && hero.time < DEMO_MS) hero.resume();
    else startPlayback();
  });
  replay.addEventListener('click', () => {
    startPlayback();
  });

  narrowMq.addEventListener('change', () => {
    const t = hero?.time ?? KEYFRAMES[1];
    mount();
    hero?.frame(t);
  });
  reducedMq.addEventListener('change', () => {
    mount();
  });
  window.addEventListener('resize', () => {
    hero?.resize();
  });
  new ResizeObserver(() => {
    hero?.resize();
  }).observe(stage);

  (window as unknown as { __rb: unknown }).__rb = {
    engineVersion: eng.ENGINE_VERSION,
    frame: (ms: number) => {
      hero?.frame(ms);
    },
    duration: DEMO_MS,
  };

  if (captureT !== null) {
    hero?.frame(captureT);
    (window as unknown as { __rbReady: boolean }).__rbReady = true;
    return;
  }
  if (capture) {
    (window as unknown as { __rbReady: boolean }).__rbReady = true;
    return;
  }

  // Autoplay once, when at least half of the stage is in view (never with reduced motion or tier 0).
  if (!reduced()) {
    const io = new IntersectionObserver(
      (list) => {
        if (started) return;
        if (list.some((e) => e.isIntersecting && e.intersectionRatio >= 0.5)) {
          io.disconnect();
          startPlayback();
        }
      },
      { threshold: [0.5] },
    );
    io.observe(stage);
  }
}

async function startMinis(eng: typeof import('../shared/engine')): Promise<void> {
  const { PROOFS, mountMini } = await import('./mini');
  const { mountCompose } = await import('./compose');
  const reduced = reducedMotionQuery().matches || tier === 0;

  const compose = document.getElementById('compose-demo');
  if (compose) mountCompose(compose, eng);

  for (const article of document.querySelectorAll<HTMLElement>('[data-proof]')) {
    const slot = article.querySelector<HTMLElement>('[data-mini]');
    const cfg = PROOFS[article.dataset.proof ?? ''];
    if (!slot || !cfg) continue;
    // One mini per task: each builds its own context and first check.
    await yieldToMain();
    const mini = mountMini(slot, eng, cfg, reduced);
    if (reduced) continue;
    const io = new IntersectionObserver(
      (list) => {
        if (list.some((e) => e.isIntersecting && e.intersectionRatio >= 0.6)) {
          io.disconnect();
          window.setTimeout(() => {
            mini.demonstrate();
          }, 1100);
        }
      },
      { threshold: [0.6] },
    );
    io.observe(slot);
  }
}

function afterLoad(run: () => void): void {
  const go = (): void => {
    if (typeof window.requestIdleCallback === 'function')
      window.requestIdleCallback(run, { timeout: 2000 });
    else window.setTimeout(run, 200);
  };
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go, { once: true });
}

if (capture || captureT !== null) {
  void engineReady().then(async (eng) => {
    await startHero(eng);
  });
  window.addEventListener('load', paintMeter, { once: true });
} else {
  afterLoad(() => {
    void engineReady().then(async (eng) => {
      await yieldToMain();
      await startHero(eng);
      await yieldToMain();
      await startMinis(eng);
    });
  });
  if (document.readyState === 'complete') paintMeter();
  else window.addEventListener('load', paintMeter, { once: true });
}
