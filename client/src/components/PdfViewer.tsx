import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { Icon } from './Icon';
import { computeRegions, type PdfRegion, type RegionTarget } from './pdfRegions';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

type ZoomMode = 'fit-width' | 'fit-page' | 'custom';
const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const PAGE_GAP = 16;
const PADDING = 24;

interface Props {
  url: string | null;
  /** Rendered on top of the pages (e.g. while compiling). */
  overlay?: React.ReactNode;
  emptyState?: React.ReactNode;
  /** Section headings to make clickable in the preview. */
  regionTargets?: RegionTarget[];
  selectedRegion?: string;
  onSelectRegion?: (id: string) => void;
}

export function PdfViewer({ url, overlay, emptyState, regionTargets, selectedRegion, onSelectRegion }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const renderTasks = useRef<RenderTask[]>([]);

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageSizes, setPageSizes] = useState<{ w: number; h: number }[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<ZoomMode>('fit-width');
  const [customZoom, setCustomZoom] = useState(1);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [current, setCurrent] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [regions, setRegions] = useState<PdfRegion[][]>([]);
  const [refreshed, setRefreshed] = useState(false);

  // Load the document; the previous one stays visible until the new one is ready.
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const task = pdfjs.getDocument({ url, isEvalSupported: false });
    task.promise
      .then(async (pdf) => {
        const sizes = await Promise.all(
          Array.from({ length: pdf.numPages }, async (_, i) => {
            const vp = (await pdf.getPage(i + 1)).getViewport({ scale: 1 });
            return { w: vp.width, h: vp.height };
          }),
        );
        if (cancelled) return void pdf.destroy();
        setDoc((old) => {
          void old?.destroy();
          return pdf;
        });
        setPageSizes(sizes);
        setLoadError(null);
        setRefreshed(true);
        setTimeout(() => setRefreshed(false), 700);
      })
      .catch((err) => !cancelled && setLoadError(String(err?.message ?? err)));
    return () => {
      cancelled = true;
    };
  }, [url]);

  const docRef = useRef<PDFDocumentProxy | null>(null);
  docRef.current = doc;
  useEffect(() => () => void docRef.current?.destroy(), []);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const first = pageSizes[0];
  const scale = !first || !box.w
    ? 1
    : mode === 'fit-width'
      ? Math.max(0.2, (box.w - PADDING * 2) / first.w)
      : mode === 'fit-page'
        ? Math.max(0.2, Math.min((box.w - PADDING * 2) / first.w, (box.h - PADDING * 2) / first.h))
        : customZoom;

  // Render every page at the current scale (CVs are short documents).
  useEffect(() => {
    if (!doc || !pageSizes.length) return;
    let cancelled = false;
    renderTasks.current.forEach((t) => t.cancel());
    renderTasks.current = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    (async () => {
      for (let i = 0; i < doc.numPages; i++) {
        if (cancelled) return;
        const canvas = canvasRefs.current[i];
        if (!canvas) continue;
        const page = await doc.getPage(i + 1);
        const vp = page.getViewport({ scale: scale * dpr });
        const off = document.createElement('canvas');
        off.width = Math.floor(vp.width);
        off.height = Math.floor(vp.height);
        const task = page.render({ canvasContext: off.getContext('2d')!, viewport: vp });
        renderTasks.current.push(task);
        try {
          await task.promise;
        } catch {
          return; // cancelled by a newer render
        }
        if (cancelled) return;
        // Swap in the finished bitmap at once: no blank flash while re-rendering.
        canvas.width = off.width;
        canvas.height = off.height;
        canvas.getContext('2d')!.drawImage(off, 0, 0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, pageSizes, scale]);

  // Locate section headings in the new document to make them clickable.
  const targetsKey = JSON.stringify(regionTargets ?? []);
  useEffect(() => {
    if (!doc || !regionTargets) return void setRegions([]);
    let cancelled = false;
    computeRegions(doc, regionTargets, 'Header & contact')
      .then((r) => !cancelled && setRegions(r))
      .catch(() => !cancelled && setRegions([]));
    return () => {
      cancelled = true;
    };
  }, [doc, targetsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track the page in view.
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !pageSizes.length) return;
    const mid = el.scrollTop + el.clientHeight / 2;
    let y = PADDING;
    for (let i = 0; i < pageSizes.length; i++) {
      const h = pageSizes[i].h * scale;
      if (mid < y + h + PAGE_GAP / 2) {
        setCurrent(i + 1);
        return;
      }
      y += h + PAGE_GAP;
    }
    setCurrent(pageSizes.length);
  }, [pageSizes, scale]);

  const goTo = (n: number) => {
    const el = scrollRef.current;
    if (!el || !pageSizes.length) return;
    const page = Math.min(pageSizes.length, Math.max(1, n));
    let y = PADDING;
    for (let i = 0; i < page - 1; i++) y += pageSizes[i].h * scale + PAGE_GAP;
    el.scrollTo({ top: y - PADDING / 2, behavior: 'smooth' });
    setCurrent(page);
  };

  const zoomBy = (dir: 1 | -1) => {
    const z = scale;
    const next = dir > 0 ? ZOOM_STEPS.find((s) => s > z + 0.01) : [...ZOOM_STEPS].reverse().find((s) => s < z - 0.01);
    setCustomZoom(next ?? z);
    setMode('custom');
  };

  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void frameRef.current?.requestFullscreen();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'PageDown' || (e.key === 'ArrowRight' && e.altKey)) goTo(current + 1);
    else if (e.key === 'PageUp' || (e.key === 'ArrowLeft' && e.altKey)) goTo(current - 1);
    else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) (e.preventDefault(), zoomBy(1));
    else if ((e.ctrlKey || e.metaKey) && e.key === '-') (e.preventDefault(), zoomBy(-1));
  };

  const pages = pageSizes.length;

  return (
    <div className={`pdf-frame${fullscreen ? ' is-fullscreen' : ''}`} ref={frameRef} onKeyDown={onKey} tabIndex={-1}>
      <div className="pdf-toolbar" role="toolbar" aria-label="PDF viewer controls">
        <div className="tb-group">
          <button className="icon-btn" onClick={() => goTo(current - 1)} disabled={!pages || current <= 1} title="Previous page (Page Up)">
            <Icon name="chevron-up" />
          </button>
          <span className="page-indicator">
            <input
              aria-label="Current page"
              value={pages ? current : 0}
              onChange={(e) => goTo(Number(e.target.value) || 1)}
              disabled={!pages}
            />
            <span>/ {pages}</span>
          </span>
          <button className="icon-btn" onClick={() => goTo(current + 1)} disabled={!pages || current >= pages} title="Next page (Page Down)">
            <Icon name="chevron-down" />
          </button>
        </div>
        <div className="tb-group">
          <button className="icon-btn" onClick={() => zoomBy(-1)} disabled={!pages} title="Zoom out (Ctrl −)">
            <Icon name="minus" />
          </button>
          <span className="zoom-label">{Math.round(scale * 100)}%</span>
          <button className="icon-btn" onClick={() => zoomBy(1)} disabled={!pages} title="Zoom in (Ctrl +)">
            <Icon name="plus" />
          </button>
          <span className="tb-sep" />
          <button className={`text-btn${mode === 'fit-width' ? ' active' : ''}`} onClick={() => setMode('fit-width')} disabled={!pages}>
            Fit width
          </button>
          <button className={`text-btn${mode === 'fit-page' ? ' active' : ''}`} onClick={() => setMode('fit-page')} disabled={!pages}>
            Fit page
          </button>
          <span className="tb-sep" />
          <button className="icon-btn" onClick={toggleFullscreen} disabled={!pages} title={fullscreen ? 'Exit full screen' : 'Full screen'}>
            <Icon name={fullscreen ? 'collapse' : 'expand'} />
          </button>
        </div>
      </div>

      <div className="pdf-scroll" ref={scrollRef} onScroll={onScroll}>
        {!url && !doc && <div className="pdf-empty">{emptyState}</div>}
        {loadError && <div className="pdf-empty error-text">Could not display the PDF: {loadError}</div>}
        <div className={`pdf-pages${refreshed ? ' refreshed' : ''}`} style={{ padding: PADDING, gap: PAGE_GAP }}>
          {pageSizes.map((p, i) => (
            <div key={i} className="pdf-page" style={{ width: Math.floor(p.w * scale), height: Math.floor(p.h * scale) }}>
              <canvas ref={(el) => (canvasRefs.current[i] = el)} aria-label={`Page ${i + 1}`} />
              {onSelectRegion &&
                regions[i]?.map((r, k) => (
                  <button
                    key={`${r.id}-${k}`}
                    type="button"
                    className={`pdf-region${r.id === selectedRegion ? ' selected' : ''}`}
                    style={{ left: `${r.x0 * 100}%`, top: `${r.y0 * 100}%`, width: `${(r.x1 - r.x0) * 100}%`, height: `${(r.y1 - r.y0) * 100}%` }}
                    onClick={() => onSelectRegion(r.id)}
                    aria-label={`Edit ${r.label}`}
                  >
                    <span className="pdf-region-tag">
                      <Icon name="cursor" size={11} /> {r.label}
                    </span>
                  </button>
                ))}
            </div>
          ))}
        </div>
      </div>
      {overlay}
    </div>
  );
}
