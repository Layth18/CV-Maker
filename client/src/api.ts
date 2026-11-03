import type { BuildResult, CVConfig, CVSummary, Lang, Profile, SourceResult } from '../../shared/types';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: init?.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : init?.headers,
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      msg = (await res.json()).error ?? msg;
    } catch {
      /* not JSON */
    }
    throw new ApiError(msg, res.status);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

const json = (body: unknown) => JSON.stringify(body);

export const api = {
  health: () => req<{ ok: boolean; compiler: string | null }>('/health'),
  profile: () => req<Profile>('/profile'),
  saveProfile: (p: Profile) => req<Profile>('/profile', { method: 'PUT', body: json(p) }),
  listCVs: () => req<CVSummary[]>('/cvs'),
  createCV: (body: { name: string; templateId: string; language: Lang }) =>
    req<CVConfig>('/cvs', { method: 'POST', body: json(body) }),
  getCV: (id: string) => req<CVConfig>(`/cvs/${id}`),
  saveCV: (cv: CVConfig) => req<CVConfig>(`/cvs/${cv.id}`, { method: 'PUT', body: json(cv) }),
  applyTemplate: (id: string, templateId: string) =>
    req<CVConfig>(`/cvs/${id}/apply-template`, { method: 'POST', body: json({ templateId }) }),
  duplicateCV: (id: string) => req<CVConfig>(`/cvs/${id}/duplicate`, { method: 'POST' }),
  deleteCV: (id: string) => req<void>(`/cvs/${id}`, { method: 'DELETE' }),
  source: (id: string) => req<SourceResult & { notes: string[] }>(`/cvs/${id}/source`, { method: 'POST' }),
  build: (id: string, variant?: { templateId: string; language: Lang }) =>
    req<BuildResult>(`/cvs/${id}/build`, { method: 'POST', body: json(variant ? { variant } : {}) }),
  getBuild: (buildId: string) => req<BuildResult>(`/builds/${buildId}`),
  buildLog: async (buildId: string) => {
    const res = await fetch(`/api/builds/${buildId}/log`);
    return res.ok ? res.text() : '';
  },
  uploadImage: (blob: Blob) =>
    req<{ id: string }>('/assets', { method: 'POST', body: blob, headers: { 'Content-Type': blob.type } }),
};

export const urls = {
  pdf: (buildId: string) => `/api/builds/${buildId}/pdf`,
  pdfDownload: (buildId: string) => `/api/builds/${buildId}/pdf?download=1`,
  sourceZip: (buildId: string) => `/api/builds/${buildId}/source.zip`,
  projectZip: (buildId: string) => `/api/builds/${buildId}/project.zip`,
  mainTex: (buildId: string) => `/api/builds/${buildId}/main.tex`,
  asset: (id: string) => `/api/assets/${id}`,
  allVariants: (cvId: string) => `/api/cvs/${cvId}/all-variants.zip`,
};

/** Downscale a photo in the browser and re-encode it as JPEG (fast for XeLaTeX). */
export async function preparePhoto(file: File, maxSide = 900): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/jpeg', 0.9),
  );
}
