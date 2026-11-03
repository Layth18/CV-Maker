import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useEffect, useRef, useState } from 'react';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** First page of a compiled PDF, rendered small. Calls onError if it cannot be shown. */
export function PdfThumb({ url, width = 260, onError }: { url: string; width?: number; onError?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const task = pdfjs.getDocument({ url, isEvalSupported: false });
    task.promise
      .then(async (doc) => {
        const page = await doc.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const vp = page.getViewport({ scale: (width / base.width) * dpr });
        const canvas = ref.current;
        if (!canvas || cancelled) return void doc.destroy();
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
        void doc.destroy();
        if (!cancelled) setReady(true);
      })
      .catch(() => !cancelled && onError?.());
    return () => {
      cancelled = true;
    };
  }, [url, width]); // eslint-disable-line react-hooks/exhaustive-deps

  return <canvas ref={ref} className={`pdf-thumb${ready ? ' ready' : ''}`} style={{ width, aspectRatio: '210 / 297' }} />;
}
