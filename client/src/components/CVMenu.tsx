import { useEffect, useRef, useState } from 'react';
import { getTemplate } from '../../../shared/catalog';
import type { CVSummary } from '../../../shared/types';
import { api } from '../api';
import { openCV } from '../nav';
import { useEditor } from '../store';
import { Icon } from './Icon';
import { NewCVDialog } from './Library';

/** The CV name in the top bar: switch, create or duplicate CVs without a start page. */
export function CVMenu() {
  const cv = useEditor((s) => s.cv)!;
  const flush = useEditor((s) => s.flush);
  const [open, setOpen] = useState(false);
  const [cvs, setCvs] = useState<CVSummary[]>([]);
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    void api.listCVs().then(setCvs);
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div className="menu-wrap cv-menu" ref={ref}>
      <button type="button" className="cv-menu-btn" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open}>
        <span className="brand-mark" aria-hidden="true" />
        <span className="topbar-title">
          <strong>{cv.name}</strong>
          <span>
            {getTemplate(cv.templateId).name} · {cv.layout.paper === 'a4' ? 'A4' : 'Letter'}
          </span>
        </span>
        <Icon name="chevron-down" size={14} className={`cv-menu-chevron${open ? ' open' : ''}`} />
      </button>
      {open && (
        <div className="menu cv-menu-pop" role="menu">
          <div className="menu-title">Your CVs</div>
          {cvs.map((c) => (
            <button
              key={c.id}
              type="button"
              role="menuitem"
              className={c.id === cv.id ? 'current' : ''}
              onClick={async () => {
                setOpen(false);
                if (c.id !== cv.id) {
                  await flush();
                  openCV(c.id);
                }
              }}
            >
              <span>
                {c.name} {c.id === cv.id && <Icon name="check" size={13} />}
              </span>
              <small>{(c.formats?.length ? c.formats : [c.templateId]).map((f) => getTemplate(f).name).join(' · ')}</small>
            </button>
          ))}
          <div className="menu-sep" />
          <button type="button" role="menuitem" onClick={() => (setOpen(false), setCreating(true))}>
            <span><Icon name="plus" size={13} /> New CV…</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              await flush();
              openCV((await api.duplicateCV(cv.id)).id);
            }}
          >
            <span><Icon name="copy" size={13} /> Duplicate this CV</span>
            <small>Try a different design without touching this one</small>
          </button>
          <button type="button" role="menuitem" onClick={() => (window.location.hash = '#/library')}>
            <span><Icon name="layers" size={13} /> Manage all CVs</span>
          </button>
        </div>
      )}
      {creating && <NewCVDialog onClose={() => setCreating(false)} onCreated={(id) => (setCreating(false), openCV(id))} />}
    </div>
  );
}
