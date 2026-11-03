import { useEffect, useRef, useState } from 'react';
import { getTemplate, TEMPLATES } from '../../../shared/catalog';
import type { Lang } from '../../../shared/types';
import { useEditor, variantKey, type VariantState } from '../store';
import { Icon } from './Icon';

function Dot({ state }: { state?: VariantState }) {
  const title = state === 'ready' ? 'Ready — switches instantly' : state === 'building' ? 'Preparing in the background…' : state === 'failed' ? 'Did not compile' : 'Not prepared yet';
  return <span className={`vdot ${state ?? 'none'}`} title={title} aria-hidden="true" />;
}

const shortName = (id: string) => getTemplate(id).name.replace(/^Canadian /, 'CA ').replace(/^French /, 'FR ');

/** Language toggle and format chips: switch the same CV between its variants in one click. */
export function VariantSwitcher() {
  const cv = useEditor((s) => s.cv)!;
  const variants = useEditor((s) => s.variants);
  const switchVariant = useEditor((s) => s.switchVariant);
  const removeFormat = useEditor((s) => s.removeFormat);
  const busy = useEditor((s) => s.phase !== 'idle');
  const [adding, setAdding] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);

  // Alt+L flips the language from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        const st = useEditor.getState();
        if (st.cv && st.phase === 'idle') st.switchVariant({ language: st.cv.language === 'en' ? 'fr' : 'en' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!adding) return;
    const close = (e: MouseEvent) => !addRef.current?.contains(e.target as Node) && setAdding(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [adding]);

  return (
    <div className="variant-switcher" aria-label="Variants">
      <button
        type="button"
        role="switch"
        aria-checked={cv.language === 'fr'}
        aria-label={`Language: ${cv.language === 'en' ? 'English' : 'French'}. Click to switch.`}
        title="Switch language (Alt+L)"
        className={`lang-switch ${cv.language}`}
        onClick={() => switchVariant({ language: cv.language === 'en' ? 'fr' : 'en' })}
        disabled={busy}
      >
        <span className="lang-knob" aria-hidden="true" />
        {(['en', 'fr'] as Lang[]).map((l) => (
          <span key={l} className={`lang-opt${cv.language === l ? ' on' : ''}`}>
            {l.toUpperCase()}
            {cv.language !== l && <Dot state={variants[variantKey(cv.templateId, l)]} />}
          </span>
        ))}
      </button>

      <div className="format-chips" role="radiogroup" aria-label="Format">
        {cv.formats.map((id) => {
          const active = id === cv.templateId;
          return (
            <div key={id} className={`format-chip${active ? ' active' : ''}`}>
              <button type="button" role="radio" aria-checked={active} onClick={() => switchVariant({ templateId: id })} title={getTemplate(id).description} disabled={busy && !active}>
                {!active && <Dot state={variants[variantKey(id, cv.language)]} />}
                {shortName(id)}
              </button>
              {!active && cv.formats.length > 1 && (
                <button type="button" className="chip-x" aria-label={`Remove ${getTemplate(id).name} from quick formats`} title="Remove from quick formats" onClick={() => removeFormat(id)}>
                  <Icon name="x" size={11} />
                </button>
              )}
            </div>
          );
        })}
        <div className="menu-wrap" ref={addRef}>
          <button type="button" className="chip-add" onClick={() => setAdding(!adding)} title="Add a format" aria-label="Add a format">
            <Icon name="plus" size={14} />
          </button>
          {adding && (
            <div className="menu add-format" role="menu">
              <div className="menu-title">Add a format to this CV</div>
              {TEMPLATES.filter((t) => !cv.formats.includes(t.id)).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAdding(false);
                    switchVariant({ templateId: t.id });
                  }}
                >
                  <span>{t.name}</span>
                  <small>{t.description}</small>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
