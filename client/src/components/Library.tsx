import { useEffect, useState } from 'react';
import { getTemplate, TEMPLATES } from '../../../shared/catalog';
import type { CVSummary, Lang } from '../../../shared/types';
import { api, urls } from '../api';
import { openHome } from '../nav';
import { Icon } from './Icon';
import { PdfThumb } from './PdfThumb';
import { TemplateThumb } from './TemplateThumb';
import { Field, Segmented, TextInput } from './ui';

function CardPreview({ cv }: { cv: CVSummary }) {
  const t = getTemplate(cv.templateId);
  const [failed, setFailed] = useState(false);
  if (cv.lastSuccessfulBuildId && !failed) {
    return <PdfThumb url={urls.pdf(cv.lastSuccessfulBuildId)} width={220} onError={() => setFailed(true)} />;
  }
  return <TemplateThumb layout={t.layout} colors={t.colors} />;
}

export function Library({ onOpen }: { onOpen: (id: string) => void }) {
  const [cvs, setCvs] = useState<CVSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compiler, setCompiler] = useState<string | null | undefined>(undefined);
  const [creating, setCreating] = useState(false);

  const refresh = () => api.listCVs().then(setCvs).catch((e) => setError(e.message));
  useEffect(() => {
    void refresh();
    api.health().then((h) => setCompiler(h.compiler)).catch(() => setCompiler(null));
  }, []);

  return (
    <div className="library">
      <header className="hero">
        <div className="hero-brand">
          <button type="button" className="icon-btn hero-back" onClick={openHome} title="Back to the editor" aria-label="Back to the editor">
            <Icon name="back" />
          </button>
          <img src="/favicon.png" alt="" className="hero-logo" />
          <div>
            <h1>CV Studio</h1>
            <p>Edit visually. Typeset with LaTeX. Preview the real PDF.</p>
          </div>
        </div>
        <div className="row">
          {compiler !== undefined && (
            <span className={`status-chip ${compiler ? 'tone-ok' : 'tone-error'}`} title={compiler ?? undefined}>
              <Icon name={compiler ? 'check' : 'alert'} size={14} /> {compiler ? 'XeLaTeX ready' : 'XeLaTeX not found'}
            </span>
          )}
          <button className="btn primary lg" onClick={() => setCreating(true)}>
            <Icon name="plus" /> New CV
          </button>
        </div>
      </header>

      {error && <div className="callout error">{error}</div>}
      {compiler === null && (
        <div className="callout error">
          The LaTeX compiler could not be found. Install TeX Live or MiKTeX and make sure <code>xelatex</code> is on your PATH, then restart CV Studio.
        </div>
      )}

      <div className="cv-grid">
        {cvs?.map((cv, i) => (
          <article key={cv.id} className="cv-card" style={{ animationDelay: `${i * 50}ms` }}>
            <button className="cv-card-open" onClick={() => onOpen(cv.id)} aria-label={`Open ${cv.name}`}>
              <CardPreview cv={cv} />
              <span className="cv-card-cta"><Icon name="cursor" size={14} /> Open editor</span>
            </button>
            <div className="cv-card-body">
              <button className="cv-card-title" onClick={() => onOpen(cv.id)}>{cv.name}</button>
              <div className="template-meta">
                <span className="badge accent">{cv.language.toUpperCase()}</span>
                {(cv.formats?.length ? cv.formats : [cv.templateId]).map((f) => (
                  <span key={f} className={`badge${f === cv.templateId ? ' strong' : ''}`}>{getTemplate(f).name}</span>
                ))}
              </div>
              <span className="muted small">Edited {new Date(cv.updatedAt).toLocaleString()}</span>
            </div>
            <div className="cv-card-actions">
              <button className="btn small" onClick={() => onOpen(cv.id)}>Open</button>
              <button className="icon-btn" title="Duplicate" aria-label={`Duplicate ${cv.name}`} onClick={() => void api.duplicateCV(cv.id).then(refresh)}>
                <Icon name="copy" />
              </button>
              <button
                className="icon-btn danger"
                title="Delete"
                aria-label={`Delete ${cv.name}`}
                onClick={() => {
                  if (confirm(`Delete “${cv.name}”? Its configuration and generated PDFs are removed. Your profile database is not affected.`)) {
                    void api.deleteCV(cv.id).then(refresh);
                  }
                }}
              >
                <Icon name="trash" />
              </button>
            </div>
          </article>
        ))}
        {cvs && !cvs.length && <p className="muted">No CVs yet. Create one to get started.</p>}
      </div>

      {creating && <NewCVDialog onClose={() => setCreating(false)} onCreated={(id) => onOpen(id)} />}
    </div>
  );
}

export function NewCVDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const [language, setLanguage] = useState<Lang>('en');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = getTemplate(templateId);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="modal new-cv"
        role="dialog"
        aria-modal="true"
        aria-label="New CV"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const cv = await api.createCV({ name, templateId, language });
            onCreated(cv.id);
          } catch (err) {
            setError((err as Error).message);
            setBusy(false);
          }
        }}
      >
        <header className="modal-head">
          <strong>New CV</strong>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </header>
        <div className="modal-body">
          <div className="grid-2">
            <Field label="Name">
              <TextInput value={name} onChange={setName} placeholder={`${t.name} (${language.toUpperCase()})`} />
            </Field>
            <Field label="Starting language">
              <Segmented<Lang> value={language} options={[{ value: 'en', label: 'English' }, { value: 'fr', label: 'Français' }]} onChange={setLanguage} />
            </Field>
          </div>
          <span className="field-label">Starting format</span>
          <div className="template-grid compact">
            {TEMPLATES.map((tp) => (
              <button
                key={tp.id}
                type="button"
                className={`template-card${tp.id === templateId ? ' selected' : ''}`}
                onClick={() => {
                  setTemplateId(tp.id);
                  setLanguage(tp.defaultLanguage);
                }}
              >
                <TemplateThumb layout={tp.layout} colors={tp.colors} />
                <span className="template-name">{tp.name}</span>
              </button>
            ))}
          </div>
          <p className="muted small">{t.description} You can switch language and add more formats from the editor at any time.</p>
          {error && <div className="callout error">{error}</div>}
        </div>
        <footer className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Creating…' : 'Create CV'}</button>
        </footer>
      </form>
    </div>
  );
}
