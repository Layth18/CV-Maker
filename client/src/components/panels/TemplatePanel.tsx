import { useState } from 'react';
import { TEMPLATES, THEMES } from '../../../../shared/catalog';
import type { ThemeId } from '../../../../shared/types';
import { api } from '../../api';
import { useEditor } from '../../store';
import { TemplateThumb } from '../TemplateThumb';
import { Field, Panel, Select } from '../ui';

const REGION_LABEL = { CA: 'Canada', FR: 'France', INTL: 'International' } as const;

export function TemplatePanel() {
  const cv = useEditor((s) => s.cv)!;
  const updateCV = useEditor((s) => s.updateCV);
  const replaceCV = useEditor((s) => s.replaceCV);
  const switchVariant = useEditor((s) => s.switchVariant);
  const flush = useEditor((s) => s.flush);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = async () => {
    if (!confirm('Reset the layout, typography, colors and section arrangement of this format to the template defaults? Your content is not affected.')) return;
    setBusy(true);
    setError(null);
    try {
      await flush();
      replaceCV(await api.applyTemplate(cv.id, cv.templateId));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel-scroll">
      <p className="panel-intro muted">
        Each format remembers its own design. Click a template to switch this CV to it — it is added to the quick switcher at the top. Your content is shared by all formats.
      </p>
      {error && <div className="callout error">{error}</div>}
      <div className="template-grid">
        {TEMPLATES.map((t) => {
          const active = t.id === cv.templateId;
          const inFormats = cv.formats.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              className={`template-card${active ? ' selected' : ''}`}
              onClick={() => !active && switchVariant({ templateId: t.id })}
              aria-pressed={active}
            >
              <TemplateThumb layout={t.layout} colors={t.colors} />
              <span className="template-name">{t.name}</span>
              <span className="template-meta">
                {active ? <span className="badge accent">Current</span> : inFormats && <span className="badge ok">In switcher</span>}
                <span className="badge">{REGION_LABEL[t.region]}</span>
                <span className="badge">{t.layout.paper.toUpperCase()}</span>
              </span>
              <span className="template-desc">{t.description}</span>
            </button>
          );
        })}
      </div>

      <Panel title="LaTeX theme" description="The theme package (cvtheme-*.sty) that typesets headings and entries in this format.">
        <Field label="Theme">
          <Select<ThemeId>
            value={cv.theme}
            options={THEMES.map((t) => ({ value: t.id, label: `${t.label} — ${t.description}` }))}
            onChange={(v) => updateCV((c) => (c.theme = v))}
          />
        </Field>
        <button type="button" className="btn small" onClick={() => void reset()} disabled={busy}>
          {busy ? 'Resetting…' : 'Reset this format to template defaults'}
        </button>
      </Panel>
    </div>
  );
}
