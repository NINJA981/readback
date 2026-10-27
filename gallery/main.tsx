/**
 * Screenshot gallery entry. `?scene=<name>&theme=<light|dark>` renders one scene
 * with the real components; scripts/screenshots.mjs drives it. Fixture data only
 * (the synthetic "Sample thread"), no extension APIs.
 */
import { createRoot } from 'react-dom/client';
import '../src/styles/overlay.css';
import './gallery.css';
import { OptionsScene, OPTIONS_SCENES } from './options-scenes';
import { OverlayScenes, OVERLAY_SCENES } from './overlay-scenes';
import { PopupScene, POPUP_SCENES } from './popup-scenes';

const params = new URLSearchParams(location.search);
const scene = params.get('scene') ?? 'index';
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
document.documentElement.dataset.theme = theme;

function Index() {
  const all = [...POPUP_SCENES, ...OPTIONS_SCENES, ...OVERLAY_SCENES].map((s) => s);
  return (
    <ul style={{ padding: 16 }}>
      {all.map((s) => (
        <li key={s}>
          <a href={`?scene=${s}&theme=${theme}`}>{s}</a>
        </li>
      ))}
    </ul>
  );
}

function App() {
  if (scene.startsWith('popup:')) return <PopupScene name={scene.slice(6)} />;
  if (scene.startsWith('options:')) return <OptionsScene name={scene.slice(8)} />;
  if (scene.startsWith('overlay:')) return <OverlayScenes name={scene.slice(8)} theme={theme} />;
  return <Index />;
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
