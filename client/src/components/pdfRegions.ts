// Maps the compiled PDF back to CV sections so they can be clicked in the preview.
// Section headings are located in the PDF text layer; each section's area runs
// from its heading to the next heading in the same column (or the page bottom).

import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

export interface RegionTarget {
  id: string;
  /** Heading text as it appears in the PDF (case-insensitive). */
  label: string;
}

/** A clickable area, in fractions of the page size. */
export interface PdfRegion {
  id: string;
  label: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Heading {
  id: string;
  page: number;
  x: number;
  top: number;
  size: number;
}

const norm = (s: string) => s.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, '');

export async function computeRegions(doc: PDFDocumentProxy, targets: RegionTarget[], headerLabel: string): Promise<PdfRegion[][]> {
  const want = new Map(targets.map((t) => [norm(t.label), t]));
  const labels = new Map(targets.map((t) => [t.id, t.label]));
  const found = new Map<string, Heading>();
  const sizes: { w: number; h: number }[] = [];

  for (let p = 0; p < doc.numPages; p++) {
    const page = await doc.getPage(p + 1);
    const vp = page.getViewport({ scale: 1 });
    sizes.push({ w: vp.width, h: vp.height });
    const content = await page.getTextContent();
    const items = (content.items as TextItem[])
      .filter((it) => 'str' in it && it.str.trim())
      .map((it) => ({ str: it.str, x: it.transform[4], base: it.transform[5], w: it.width, size: Math.hypot(it.transform[2], it.transform[3]) || it.height }))
      .sort((a, b) => b.base - a.base || a.x - b.x);

    // Rebuild lines; items far apart on the same baseline (two columns) stay separate.
    const lines: { x: number; base: number; size: number; text: string; end: number }[] = [];
    for (const it of items) {
      const line = lines.find((l) => Math.abs(l.base - it.base) < it.size * 0.35 && it.x - l.end < it.size * 1.2 && it.x > l.x - 1);
      if (line) {
        line.text += it.str;
        line.end = it.x + it.w;
        line.size = Math.max(line.size, it.size);
      } else lines.push({ x: it.x, base: it.base, size: it.size, text: it.str, end: it.x + it.w });
    }
    for (const line of lines) {
      const t = want.get(norm(line.text));
      if (!t) continue;
      const prev = found.get(t.id);
      if (!prev || line.size > prev.size) {
        found.set(t.id, { id: t.id, page: p, x: line.x, top: vp.height - line.base - line.size * 0.85, size: line.size });
      }
    }
  }

  const regions: PdfRegion[][] = sizes.map(() => []);
  if (!sizes.length) return regions;
  const { w: W, h: H } = sizes[0];
  const headings = [...found.values()];

  // Columns = clusters of heading x positions.
  const cols: number[] = [];
  for (const x of headings.map((h) => h.x).sort((a, b) => a - b)) {
    if (!cols.length || x - cols[cols.length - 1] > 20) cols.push(x);
  }
  if (!cols.length) {
    regions[0].push({ id: 'personal', label: headerLabel, x0: 0, y0: 0, x1: 1, y1: 0.2 });
    return regions;
  }
  const margin = Math.max(18, cols[0]);
  const colOf = (h: Heading) => cols.reduce((best, x, k) => (Math.abs(x - h.x) < Math.abs(cols[best] - h.x) ? k : best), 0);
  const colX0 = (k: number) => Math.max(0, cols[k] - 10);
  const colX1 = (k: number) => (k + 1 < cols.length ? cols[k + 1] - 12 : W - margin + 10);
  const push = (page: number, id: string, k: number, y0: number, y1: number) => {
    if (y1 - y0 < 12) return;
    regions[page].push({ id, label: id === 'personal' ? headerLabel : labels.get(id) ?? id, x0: colX0(k) / W, x1: colX1(k) / W, y0: y0 / H, y1: y1 / H });
  };

  // The header: everything above the first heading on page 1 (full width), plus
  // the top of any column whose first heading starts lower (e.g. header in a sidebar).
  const page1 = headings.filter((h) => h.page === 0);
  const firstTop = page1.length ? Math.min(...page1.map((h) => h.top)) - 4 : H * 0.2;
  if (firstTop > 12) regions[0].push({ id: 'personal', label: headerLabel, x0: 0, y0: 0, x1: 1, y1: firstTop / H });

  const last: (Heading | null)[] = cols.map(() => null);
  for (let p = 0; p < sizes.length; p++) {
    const bottom = sizes[p].h - margin * 0.7;
    cols.forEach((_, k) => {
      const hs = headings.filter((h) => h.page === p && colOf(h) === k).sort((a, b) => a.top - b.top);
      const firstInCol = hs.length ? hs[0].top - 4 : bottom;
      if (p === 0) push(0, 'personal', k, Math.max(firstTop, 0), firstInCol);
      else if (last[k]) push(p, last[k]!.id, k, margin * 0.6, firstInCol); // continued from the previous page
      hs.forEach((h, j) => push(p, h.id, k, h.top - 4, j + 1 < hs.length ? hs[j + 1].top - 4 : bottom));
      if (hs.length) last[k] = hs[hs.length - 1];
    });
  }
  return regions;
}
