import { useEffect, useState } from 'react';
import { api } from './api';
import { Editor } from './components/Editor';
import { Icon } from './components/Icon';
import { Library } from './components/Library';
import { openCV } from './nav';

const LAST_CV = 'cvstudio.lastCv';

type Route = { kind: 'cv'; cvId: string } | { kind: 'library' } | { kind: 'home' };

function readRoute(): Route {
  const m = /^#\/cv\/([A-Za-z0-9-]+)/.exec(window.location.hash);
  if (m) return { kind: 'cv', cvId: m[1] };
  if (window.location.hash.startsWith('#/library')) return { kind: 'library' };
  return { kind: 'home' };
}

/** No start page: open the CV edited last (or create a first one). */
function Home() {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const cvs = await api.listCVs();
      let last: string | null = null;
      try {
        last = localStorage.getItem(LAST_CV);
      } catch {
        /* storage unavailable */
      }
      const target = cvs.find((c) => c.id === last) ?? cvs[0];
      const id = target ? target.id : (await api.createCV({ name: 'My CV', templateId: 'canadian-split-photo', language: 'en' })).id;
      window.location.replace(`#/cv/${id}`);
    })().catch((e) => setError((e as Error).message));
  }, []);
  return (
    <div className="center-screen splash">
      <img src="/favicon.png" alt="" className="splash-logo" />
      {error ? <div className="callout error">Could not reach CV Studio’s server: {error}</div> : <span className="muted"><Icon name="spinner" /> Opening your CV…</span>}
    </div>
  );
}

export function App() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (route.kind !== 'cv') return;
    try {
      localStorage.setItem(LAST_CV, route.cvId);
    } catch {
      /* storage unavailable */
    }
  }, [route]);

  if (route.kind === 'cv') return <Editor key={route.cvId} cvId={route.cvId} />;
  if (route.kind === 'library') return <Library onOpen={openCV} />;
  return <Home />;
}
