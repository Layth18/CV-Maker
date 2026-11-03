// CV Studio HTTP API. Binds to localhost only; the React editor talks to it
// through the Vite dev proxy (or it serves the built client in production).

import express, { type NextFunction, type Request, type Response } from 'express';
import JSZip from 'jszip';
import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { applyTemplate, getTemplate, switchFormat } from '../shared/catalog';
import { createCVConfig } from '../shared/factory';
import { assetPath, MAX_IMAGE_BYTES, saveImage } from './assets';
import { buildCV, buildDir, deleteBuildsForCV, getBuild, prepareSource, toSourceResult } from './builds';
import { compilerVersion } from './compile/xelatex';
import { cvFileName, projectZip, sourceZip } from './exporter';
import { normalizeCV } from './normalize';
import { ASSET_RE, ROOT_DIR } from './paths';
import { deleteCV, getCV, getProfile, listCVs, newId, saveCV, saveProfile, updateCV } from './store';

// Own variable names: PORT/HOST are often set for the front-end dev server.
const PORT = Number(process.env.CV_API_PORT || 5174);
const HOST = process.env.CV_API_HOST || '127.0.0.1';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

type Handler = (req: Request, res: Response) => Promise<unknown>;
const h = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const notFound = (res: Response, what = 'Not found') => res.status(404).json({ error: what });

// --- system ---------------------------------------------------------------------
app.get('/api/health', h(async (_req, res) => {
  res.json({ ok: true, compiler: await compilerVersion() });
}));

// --- profile (bilingual database) ---------------------------------------------
app.get('/api/profile', h(async (_req, res) => res.json(await getProfile())));
app.put('/api/profile', h(async (req, res) => {
  if (typeof req.body !== 'object' || !req.body?.personal) return res.status(400).json({ error: 'Expected a profile object.' });
  res.json(await saveProfile(req.body));
}));

// --- CVs ------------------------------------------------------------------------
app.get('/api/cvs', h(async (_req, res) => res.json(await listCVs())));

app.post('/api/cvs', h(async (req, res) => {
  const template = getTemplate(String(req.body?.templateId ?? ''));
  const language = req.body?.language === 'fr' ? 'fr' : req.body?.language === 'en' ? 'en' : template.defaultLanguage;
  const name = String(req.body?.name ?? '').trim().slice(0, 120) || `${template.name} (${language.toUpperCase()})`;
  const cv = createCVConfig({ id: newId(), name, templateId: template.id, language, profile: await getProfile() });
  res.status(201).json(await saveCV(cv));
}));

app.get('/api/cvs/:id', h(async (req, res) => {
  const cv = await getCV(req.params.id);
  return cv ? res.json(cv) : notFound(res, 'CV not found');
}));

const isObject = (v: unknown) => typeof v === 'object' && v !== null && !Array.isArray(v);

app.put('/api/cvs/:id', h(async (req, res) => {
  if (!isObject(req.body)) return res.status(400).json({ error: 'Expected a CV configuration object.' });
  const saved = await updateCV(req.params.id, (existing) => normalizeCV(req.body, existing));
  return saved ? res.json(saved) : notFound(res, 'CV not found');
}));

app.post('/api/cvs/:id/apply-template', h(async (req, res) => {
  const template = getTemplate(String(req.body?.templateId ?? ''));
  // Same template: reset this format to the template defaults. Other template: switch format.
  const saved = await updateCV(req.params.id, (cv) => ({
    ...(cv.templateId === template.id ? applyTemplate(cv, template) : switchFormat(cv, template.id)),
    updatedAt: new Date().toISOString(),
  }));
  return saved ? res.json(saved) : notFound(res, 'CV not found');
}));

app.post('/api/cvs/:id/duplicate', h(async (req, res) => {
  const cv = await getCV(req.params.id);
  if (!cv) return notFound(res, 'CV not found');
  const now = new Date().toISOString();
  const copy = { ...structuredClone(cv), id: newId(), name: `${cv.name} (copy)`, lastSuccessfulBuildId: null, createdAt: now, updatedAt: now };
  res.status(201).json(await saveCV(copy));
}));

app.delete('/api/cvs/:id', h(async (req, res) => {
  await deleteBuildsForCV(req.params.id);
  await deleteCV(req.params.id);
  res.status(204).end();
}));

// --- generation & compilation --------------------------------------------------
app.post('/api/cvs/:id/source', h(async (req, res) => {
  const prepared = await prepareSource(req.params.id);
  return prepared ? res.json(toSourceResult(prepared)) : notFound(res, 'CV not found');
}));

app.post('/api/cvs/:id/build', h(async (req, res) => {
  const v = req.body?.variant;
  const variant = v && typeof v.templateId === 'string' && (v.language === 'en' || v.language === 'fr')
    ? { templateId: v.templateId as string, language: v.language as 'en' | 'fr' }
    : undefined;
  const result = await buildCV(req.params.id, variant);
  return result ? res.json(result) : notFound(res, 'CV not found');
}));

app.get('/api/builds/:buildId', h(async (req, res) => {
  const b = await getBuild(req.params.buildId);
  return b ? res.json(b) : notFound(res, 'Build not found');
}));

app.get('/api/builds/:buildId/log', h(async (req, res) => {
  const file = path.join(buildDir(req.params.buildId), 'main.log');
  if (!existsSync(file)) return notFound(res, 'Log not found');
  res.type('text/plain; charset=utf-8').send(await fs.readFile(file, 'latin1'));
}));

app.get('/api/builds/:buildId/files', h(async (req, res) => {
  const b = await getBuild(req.params.buildId);
  if (!b) return notFound(res, 'Build not found');
  const root = path.join(buildDir(b.buildId), 'source');
  const out: { path: string; content: string }[] = [];
  const walk = async (dir: string, prefix: string) => {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      if (e.isDirectory()) await walk(path.join(dir, e.name), `${prefix}${e.name}/`);
      else if (/\.(tex|sty)$/.test(e.name)) out.push({ path: prefix + e.name, content: await fs.readFile(path.join(dir, e.name), 'utf8') });
    }
  };
  await walk(root, '');
  res.json(out);
}));

async function buildAndName(req: Request, res: Response) {
  const b = await getBuild(req.params.buildId);
  if (!b) {
    notFound(res, 'Build not found');
    return null;
  }
  const cv = await getCV(b.cvId);
  return { build: b, cv, base: cvFileName(await getProfile(), cv, b) };
}

// Every format x language of a CV as PDFs in one ZIP (variants are built or reused).
app.get('/api/cvs/:id/all-variants.zip', h(async (req, res) => {
  const cv = await getCV(req.params.id);
  if (!cv) return notFound(res, 'CV not found');
  const profile = await getProfile();
  const zip = new JSZip();
  for (const templateId of cv.formats) {
    for (const language of ['en', 'fr'] as const) {
      const b = await buildCV(cv.id, { templateId, language });
      if (!b) continue;
      // Named from the variant requested (older builds do not record their format).
      const name = cvFileName(profile, { ...cv, formats: cv.formats.length > 1 ? cv.formats : [templateId, templateId] }, { templateId, language });
      if (b.status === 'success') zip.file(`${name}.pdf`, await fs.readFile(path.join(buildDir(b.buildId), 'main.pdf')));
      else zip.file(`${name}_FAILED.txt`, `${b.failureReason ?? 'Compilation failed'}\n\n${b.errors.map((e) => `${e.file ?? ''}:${e.line ?? ''} ${e.message}`).join('\n')}\n`);
    }
  }
  const base = cvFileName(profile, { ...cv, formats: [cv.templateId] }, { language: cv.language }).replace(/_[A-Z]{2}$/, '');
  res.setHeader('Content-Disposition', `attachment; filename="${base}_all_versions.zip"`);
  res.type('application/zip').send(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
}));

app.get('/api/builds/:buildId/pdf', h(async (req, res) => {
  const info = await buildAndName(req, res);
  if (!info) return;
  const file = path.join(buildDir(info.build.buildId), 'main.pdf');
  if (!existsSync(file)) return notFound(res, 'This build has no PDF');
  const disposition = req.query.download ? 'attachment' : 'inline';
  res.setHeader('Content-Disposition', `${disposition}; filename="${info.base}.pdf"`);
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  res.type('application/pdf').send(await fs.readFile(file));
}));

app.get('/api/builds/:buildId/source.zip', h(async (req, res) => {
  const info = await buildAndName(req, res);
  if (!info) return;
  res.setHeader('Content-Disposition', `attachment; filename="${info.base}_latex_source.zip"`);
  res.type('application/zip').send(await sourceZip(info.build));
}));

app.get('/api/builds/:buildId/project.zip', h(async (req, res) => {
  const info = await buildAndName(req, res);
  if (!info) return;
  res.setHeader('Content-Disposition', `attachment; filename="${info.base}_latex_project.zip"`);
  res.type('application/zip').send(await projectZip(info.build, info.cv, info.base));
}));

app.get('/api/builds/:buildId/main.tex', h(async (req, res) => {
  const info = await buildAndName(req, res);
  if (!info) return;
  const file = path.join(buildDir(info.build.buildId), 'source', 'main.tex');
  res.setHeader('Content-Disposition', `attachment; filename="${info.base}.tex"`);
  res.type('application/x-tex; charset=utf-8').send(await fs.readFile(file, 'utf8'));
}));

// --- assets -------------------------------------------------------------------
app.post(
  '/api/assets',
  express.raw({ type: ['image/png', 'image/jpeg'], limit: MAX_IMAGE_BYTES }),
  h(async (req, res) => {
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'Send a PNG or JPEG image body.' });
    try {
      res.status(201).json({ id: await saveImage(req.body) });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  }),
);

app.get('/api/assets/:id', h(async (req, res) => {
  if (!ASSET_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid asset id' });
  const file = assetPath(req.params.id);
  if (!existsSync(file)) return notFound(res);
  res.sendFile(file);
}));

// --- production: serve the built editor ----------------------------------------
const dist = path.join(ROOT_DIR, 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err: Error & { status?: number; type?: string }, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status ?? (err.type === 'entity.too.large' ? 413 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
});

app.listen(PORT, HOST, async () => {
  console.log(`CV Studio API on http://${HOST}:${PORT}`);
  console.log(`LaTeX engine: ${(await compilerVersion()) ?? 'NOT FOUND — install TeX Live / MiKTeX'}`);
});
