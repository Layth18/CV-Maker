import { useEffect, useMemo, useRef, useState } from 'react';
import { getTemplate } from '../../../shared/catalog';
import type { BuildResult, LatexIssue } from '../../../shared/types';
import { api, urls } from '../api';
import { docStatus, useEditor, type DocStatus } from '../store';
import { Icon } from './Icon';
import { Outline } from './Outline';
import { PdfViewer } from './PdfViewer';
import { displayLabel } from './sectionMeta';
import { SourceViewer } from './SourceViewer';
import { CVMenu } from './CVMenu';
import { Toolbox } from './Toolbox';
import { VariantSwitcher } from './VariantSwitcher';

const STATUS: Record<DocStatus, { label: string; tone: string; icon: string }> = {
  'not-generated': { label: 'Not generated', tone: 'neutral', icon: 'file' },
  generating: { label: 'Generating LaTeX…', tone: 'busy', icon: 'spinner' },
  compiling: { label: 'Compiling PDF…', tone: 'busy', icon: 'spinner' },
  ready: { label: 'Preview ready', tone: 'ok', icon: 'check' },
  failed: { label: 'Compilation failed', tone: 'error', icon: 'alert' },
  unsaved: { label: 'Unsaved changes', tone: 'pending', icon: 'sparkle' },
  outdated: { label: 'Preview outdated', tone: 'pending', icon: 'refresh' },
};

function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s} s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

export function Editor({ cvId }: { cvId: string }) {
  const s = useEditor();
  const [view, setView] = useState<'pdf' | 'source'>('pdf');
  const [highlight, setHighlight] = useState<{ file: string; line: number } | null>(null);
  const [logFor, setLogFor] = useState<BuildResult | null>(null);

  useEffect(() => {
    void s.load(cvId);
    return () => s.unload();
  }, [cvId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ctrl+S / Ctrl+Enter regenerates. Ctrl+Z / Ctrl+Y (or Ctrl+Shift+Z) undo and redo,
  // except inside a text field, where the browser's own text undo applies.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === 's' || key === 'enter') {
        e.preventDefault();
        void useEditor.getState().generate();
        return;
      }
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && !['checkbox', 'radio', 'range', 'color'].includes((t as HTMLInputElement).type)));
      if (typing) return;
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useEditor.getState().undo();
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        useEditor.getState().redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Warn before closing with unsaved edits.
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      const st = useEditor.getState();
      if (st.cvSave === 'pending' || st.profileSave === 'pending' || st.cvSave === 'saving' || st.profileSave === 'saving') {
        void st.flush();
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  // Headings to make clickable in the PDF (the ones actually printed).
  const regionTargets = useMemo(
    () => (s.cv && s.profile ? s.cv.sections.filter((x) => x.visible).map((x) => ({ id: x.key, label: displayLabel(s.cv!, s.profile!, x) })) : []),
    [s.cv, s.profile],
  );

  if (s.loadError) {
    return (
      <div className="center-screen">
        <div className="callout error">Could not open this CV: {s.loadError}</div>
        <button className="btn" onClick={() => (window.location.hash = '#/library')}>Open another CV</button>
      </div>
    );
  }
  if (!s.cv || !s.profile) return <div className="center-screen muted"><Icon name="spinner" size={22} /> Loading…</div>;

  const status = docStatus(s);
  const st = STATUS[status];
  const busy = s.phase !== 'idle';
  const template = getTemplate(s.cv.templateId);
  const pdfUrl = s.preview ? urls.pdf(s.preview.buildId) : null;

  const jumpTo = (issue: LatexIssue) => {
    if (!issue.file || !issue.line) return;
    setHighlight({ file: issue.file, line: issue.line });
    setView('source');
  };

  return (
    <div className="editor">
      <header className="topbar">
        <CVMenu />
        <div className="history-btns">
          <button className="icon-btn" onClick={s.undo} disabled={!s.canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">
            <Icon name="undo" />
          </button>
          <button className="icon-btn" onClick={s.redo} disabled={!s.canRedo} title="Redo (Ctrl+Y)" aria-label="Redo">
            <Icon name="redo" />
          </button>
        </div>
        <VariantSwitcher />
        <div className="topbar-spacer" />
        <SaveIndicator />
        <span className={`status-chip tone-${st.tone}`} role="status" aria-live="polite" key={status}>
          <Icon name={st.icon} size={14} /> {st.label}
        </span>
        <label className="auto-toggle" title="Regenerate the PDF automatically shortly after each change">
          <input type="checkbox" checked={s.autoCompile} onChange={(e) => s.setAutoCompile(e.target.checked)} />
          <span className="mini-switch" aria-hidden="true" />
          Auto
        </label>
        <button className="btn primary" onClick={() => void s.generate()} disabled={busy} title="Regenerate LaTeX and compile (Ctrl+Enter)">
          <Icon name={busy ? 'spinner' : 'refresh'} /> {s.preview ? 'Refresh' : 'Generate PDF'}
        </button>
        <ExportMenu cvId={s.cv.id} variantCount={s.cv.formats.length * 2} preview={s.preview} outdated={status === 'outdated' || status === 'unsaved' || status === 'failed'} />
      </header>

      <div className="workspace">
        <Outline />
        <aside className="toolbox-pane">
          <Toolbox />
        </aside>

        <main className="right-panel">
          <div className="view-tabs">
            <div className="segmented dark" role="tablist">
              <button role="tab" aria-selected={view === 'pdf'} className={view === 'pdf' ? 'active' : ''} onClick={() => setView('pdf')}>
                <Icon name="file" size={14} /> PDF
              </button>
              <button role="tab" aria-selected={view === 'source'} className={view === 'source' ? 'active' : ''} onClick={() => setView('source')}>
                <Icon name="code" size={14} /> LaTeX
              </button>
            </div>
            {view === 'pdf' && <span className="click-hint"><Icon name="cursor" size={12} /> Click a section in the PDF to edit it</span>}
            {s.preview && (
              <span className="build-meta">
                {s.preview.pageCount} page{s.preview.pageCount === 1 ? '' : 's'} · {timeAgo(s.preview.createdAt)}
                {s.preview.cached ? ' · instant' : ` · ${(s.preview.durationMs / 1000).toFixed(1)} s`}
                {s.preview.warnings.length > 0 && (
                  <button className="link-btn" onClick={() => setLogFor(s.preview)}>
                    {s.preview.warnings.length} warning{s.preview.warnings.length > 1 ? 's' : ''}
                  </button>
                )}
              </span>
            )}
          </div>

          {(s.failure || s.pipelineError) && (
            <FailurePanel
              failure={s.failure}
              pipelineError={s.pipelineError}
              hasPreview={Boolean(s.preview)}
              previewAge={s.preview ? timeAgo(s.preview.createdAt) : null}
              onJump={jumpTo}
              onLog={() => s.failure && setLogFor(s.failure)}
              onRetry={() => void s.generate()}
              busy={busy}
            />
          )}

          <div className="view-body">
            {view === 'pdf' ? (
              <PdfViewer
                url={pdfUrl}
                regionTargets={regionTargets}
                selectedRegion={s.selected}
                onSelectRegion={s.select}
                overlay={busy && <div className="compile-overlay"><Icon name="spinner" /> {st.label}</div>}
                emptyState={
                  busy ? (
                    <><Icon name="spinner" size={28} /><p>{st.label}</p></>
                  ) : (
                    <>
                      <Icon name="file" size={36} />
                      <p>No PDF generated yet.</p>
                      <button className="btn primary" onClick={() => void s.generate()}>Generate PDF</button>
                    </>
                  )
                }
              />
            ) : (
              <SourceViewer files={s.source?.files ?? []} highlight={highlight} notes={s.source?.notes ?? []} />
            )}
          </div>
        </main>
      </div>

      {logFor && <LogModal build={logFor} onClose={() => setLogFor(null)} />}
    </div>
  );
}

function SaveIndicator() {
  const cvSave = useEditor((s) => s.cvSave);
  const profileSave = useEditor((s) => s.profileSave);
  const err = useEditor((s) => s.saveError);
  const states = [cvSave, profileSave];
  const text = states.includes('error')
    ? `Save failed: ${err}`
    : states.includes('saving')
      ? 'Saving…'
      : states.includes('pending')
        ? 'Editing…'
        : 'All changes saved';
  return <span className={`save-indicator${states.includes('error') ? ' error-text' : ''}`}>{text}</span>;
}

function ExportMenu({ cvId, variantCount, preview, outdated }: { cvId: string; variantCount: number; preview: BuildResult | null; outdated: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const items = preview
    ? [
        { href: urls.pdfDownload(preview.buildId), label: 'Export PDF', desc: 'The exact PDF shown in the preview' },
        { href: urls.sourceZip(preview.buildId), label: 'Export LaTeX source (.zip)', desc: '.tex files, style files and images' },
        { href: urls.mainTex(preview.buildId), label: 'Download main.tex only', desc: 'Entry file (needs the other source files)' },
        { href: urls.projectZip(preview.buildId), label: 'Export full project (.zip)', desc: 'Sources, PDF, README and latexmk config' },
        { href: urls.allVariants(cvId), label: `All ${variantCount} PDFs (.zip)`, desc: 'Every format in English and French — may take a few seconds' },
      ]
    : [];

  return (
    <div className="menu-wrap" ref={ref}>
      <button className="btn" onClick={() => setOpen(!open)} disabled={!preview} aria-haspopup="menu" aria-expanded={open}>
        <Icon name="download" /> Export
      </button>
      {open && preview && (
        <div className="menu" role="menu">
          {outdated && (
            <div className="menu-note">
              <Icon name="alert" size={14} /> These files match the PDF currently shown, which does not include your latest changes. Refresh the preview first to include them.
            </div>
          )}
          {items.map((i) => (
            <a key={i.href} role="menuitem" href={i.href} download onClick={() => setOpen(false)}>
              <span>{i.label}</span>
              <small>{i.desc}</small>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function FailurePanel(props: {
  failure: BuildResult | null;
  pipelineError: string | null;
  hasPreview: boolean;
  previewAge: string | null;
  onJump: (i: LatexIssue) => void;
  onLog: () => void;
  onRetry: () => void;
  busy: boolean;
}) {
  const { failure, pipelineError } = props;
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="failure" role="alert">
      <div className="failure-head">
        <Icon name="alert" />
        <div className="failure-title">
          <strong>{pipelineError ? 'Could not reach the compiler' : 'Compilation failed'}</strong>
          <span>
            {pipelineError ?? failure?.failureReason}{' '}
            {props.hasPreview ? `Showing the last successful PDF (${props.previewAge}).` : 'No earlier PDF to show.'}
          </span>
        </div>
        <div className="row">
          {failure && <button className="btn small" onClick={props.onLog}><Icon name="log" size={14} /> Full log</button>}
          <button className="btn small primary" onClick={props.onRetry} disabled={props.busy}><Icon name="refresh" size={14} /> Try again</button>
          {failure && failure.errors.length > 0 && (
            <button className="icon-btn" onClick={() => setExpanded(!expanded)} aria-label={expanded ? 'Hide details' : 'Show details'}>
              <Icon name={expanded ? 'chevron-up' : 'chevron-down'} />
            </button>
          )}
        </div>
      </div>
      {expanded && failure && failure.errors.length > 0 && (
        <ul className="issue-list">
          {failure.errors.slice(0, 8).map((e, i) => (
            <li key={i}>
              {e.file && e.line ? (
                <button className="issue-loc" onClick={() => props.onJump(e)} title="Show in LaTeX source">
                  {e.file}:{e.line}
                </button>
              ) : (
                <span className="issue-loc static">{e.file ?? 'LaTeX'}</span>
              )}
              <span className="issue-msg">{e.message}</span>
              {e.context && <code className="issue-ctx">{e.context}</code>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LogModal({ build, onClose }: { build: BuildResult; onClose: () => void }) {
  const [log, setLog] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'problems'>(build.status === 'error' ? 'problems' : 'all');
  useEffect(() => {
    void api.buildLog(build.buildId).then(setLog);
  }, [build.buildId]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  const lines = useMemo(() => (log ?? '').split(/\r?\n/), [log]);
  const isProblem = (l: string) => /^(!|.*\.(tex|sty):\d+:)|Warning|Missing character|Overfull/.test(l);
  const shown = filter === 'all' ? lines.map((l, i) => [l, i] as const) : lines.flatMap((l, i) => (isProblem(l) ? [[l, i] as const] : []));

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Compilation log">
        <header className="modal-head">
          <div>
            <strong>Compilation log</strong>
            <span className="muted"> · build {build.buildId} · {build.status === 'success' ? 'succeeded' : 'failed'} · {build.passes} pass{build.passes > 1 ? 'es' : ''}</span>
          </div>
          <div className="row">
            <div className="segmented">
              <button className={filter === 'problems' ? 'active' : ''} onClick={() => setFilter('problems')}>Errors & warnings</button>
              <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Full log</button>
            </div>
            <a className="btn small" href={`/api/builds/${build.buildId}/log`} target="_blank" rel="noreferrer">Open raw</a>
            <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
          </div>
        </header>
        {build.warnings.length > 0 && filter === 'problems' && (
          <ul className="warning-list">
            {build.warnings.map((w, i) => <li key={i}>{w.message}{w.line ? ` (line ${w.line})` : ''}</li>)}
          </ul>
        )}
        <pre className="log">
          {log === null
            ? 'Loading…'
            : shown.length
              ? shown.map(([l, i]) => (
                  <div key={i} className={/^(!|.*\.(tex|sty):\d+:)/.test(l) ? 'log-error' : isProblem(l) ? 'log-warn' : undefined}>
                    <span className="log-no">{i + 1}</span>{l}
                  </div>
                ))
              : 'No problems found in the log.'}
        </pre>
      </div>
    </div>
  );
}
