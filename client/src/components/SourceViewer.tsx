import { useEffect, useMemo, useRef, useState } from 'react';
import type { GeneratedFile } from '../../../shared/types';

/** Minimal LaTeX highlighting: comments, commands, braces. */
function highlightLine(line: string) {
  const out: React.ReactNode[] = [];
  const re = /(%.*$)|(\\[A-Za-z@]+\*?|\\.)|([{}[\]])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index));
    if (m[1] !== undefined) {
      // A % preceded by a backslash is an escaped percent, not a comment.
      if (m.index > 0 && line[m.index - 1] === '\\') {
        out.push('%');
        re.lastIndex = m.index + 1;
        last = m.index + 1;
        continue;
      }
      out.push(<span key={k++} className="tx-comment">{m[1]}</span>);
    } else if (m[2]) out.push(<span key={k++} className="tx-cmd">{m[2]}</span>);
    else out.push(<span key={k++} className="tx-brace">{m[3]}</span>);
    last = re.lastIndex;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

export function SourceViewer({ files, highlight, notes }: { files: GeneratedFile[]; highlight: { file: string; line: number } | null; notes: string[] }) {
  const [active, setActive] = useState('main.tex');
  const lineRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (highlight && files.some((f) => f.path === highlight.file)) setActive(highlight.file);
  }, [highlight, files]);

  useEffect(() => {
    lineRef.current?.scrollIntoView({ block: 'center' });
  }, [active, highlight]);

  const file = files.find((f) => f.path === active) ?? files[0];
  const lines = useMemo(() => (file?.content ?? '').replace(/\n$/, '').split('\n'), [file]);
  const hlLine = highlight && file && highlight.file === file.path ? highlight.line : null;
  const missingHighlight = highlight && !files.some((f) => f.path === highlight.file);

  if (!files.length) return <div className="pdf-empty muted">The LaTeX source appears here once it has been generated.</div>;

  return (
    <div className="source-viewer">
      <div className="source-files" role="tablist" aria-label="Generated files">
        {files.map((f) => (
          <button key={f.path} role="tab" aria-selected={f.path === file?.path} className={f.path === file?.path ? 'active' : ''} onClick={() => setActive(f.path)}>
            {f.path}
          </button>
        ))}
      </div>
      <div className="source-toolbar">
        <span className="muted small">
          Generated from your current settings — read-only. Change the CV in the editor; style files (cvcore.sty, themes) are included in the export.
        </span>
        <button
          className="btn small"
          onClick={() => {
            void navigator.clipboard.writeText(file.content).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? 'Copied' : 'Copy file'}
        </button>
      </div>
      {missingHighlight && (
        <div className="callout warn small">
          The error is in <code>{highlight!.file}</code> line {highlight!.line}, a shared style file. It is usually caused by text or settings passed to it from the files below.
        </div>
      )}
      {notes.length > 0 && (
        <div className="callout warn small">
          {notes.map((n) => <div key={n}>{n}</div>)}
        </div>
      )}
      <pre className="source-code" tabIndex={0}>
        {lines.map((l, i) => (
          <div key={i} ref={hlLine === i + 1 ? lineRef : undefined} className={hlLine === i + 1 ? 'hl' : undefined}>
            <span className="ln">{i + 1}</span>
            <span>{highlightLine(l)}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}
