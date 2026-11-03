// Build service: generate -> hash -> (cache hit | compile) -> persist.
// Each build is stored in data/builds/<buildId>/ with the exact sources that
// produced its PDF, so exports always match what the preview shows.

import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getTemplate, variantConfig } from '../shared/catalog';
import type { BuildResult, CVConfig, Lang, SourceResult } from '../shared/types';
import { loadPhoto } from './assets';
import { compile, COMPILER, hashSource, writeProject } from './compile/xelatex';
import { generateProject, STATIC_STYLE_FILES, type GeneratedProject } from './latex/generate';
import { BUILDS_DIR, ID_RE, LATEX_ASSETS_DIR } from './paths';
import { getCV, getProfile, updateCV } from './store';

// Room for every format x language variant plus a few older builds.
const KEEP_BUILDS_PER_CV = 16;
const MAX_CONCURRENT = 2;

export interface PreparedSource {
  cv: CVConfig;
  project: GeneratedProject;
  staticFiles: { path: string; sourcePath: string }[];
  sourceHash: string;
}

/** cvcore.sty plus the theme the CV uses. */
function staticFiles(theme: string) {
  return STATIC_STYLE_FILES.filter((f) => f === 'cvcore.sty' || f === `cvtheme-${theme}.sty`).map((f) => ({
    path: f,
    sourcePath: path.join(LATEX_ASSETS_DIR, f),
  }));
}

export interface Variant {
  templateId: string;
  language: Lang;
}

/** Generate the active CV, or another format/language variant of it without changing it. */
export async function prepareSource(cvId: string, variant?: Variant): Promise<PreparedSource | null> {
  const stored = await getCV(cvId);
  if (!stored) return null;
  const cv = variant ? variantConfig(stored, getTemplate(variant.templateId).id, variant.language) : stored;
  const profile = await getProfile();
  const photo = await loadPhoto(profile.personal.photo);
  const project = generateProject({ profile, cv, photo });
  const statics = staticFiles(cv.theme);
  const binaries = await Promise.all([...statics, ...project.assets].map((a) => fs.readFile(a.sourcePath)));
  const sourceHash = hashSource(project.files, binaries, `${COMPILER}|${project.assets.map((a) => a.path).join(',')}`);
  return { cv, project, staticFiles: statics, sourceHash };
}

export function toSourceResult(p: PreparedSource): SourceResult & { notes: string[] } {
  return {
    sourceHash: p.sourceHash,
    mainFile: p.project.mainFile,
    files: p.project.files,
    assets: p.project.assets.map((a) => a.path),
    notes: p.project.notes,
  };
}

// --- build records -----------------------------------------------------------

export function buildDir(buildId: string): string {
  if (!ID_RE.test(buildId)) throw Object.assign(new Error('Invalid build id'), { status: 400 });
  return path.join(BUILDS_DIR, buildId);
}

export async function getBuild(buildId: string): Promise<BuildResult | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(buildDir(buildId), 'build.json'), 'utf8'));
  } catch {
    return null;
  }
}

async function buildsForCV(cvId: string): Promise<BuildResult[]> {
  await fs.mkdir(BUILDS_DIR, { recursive: true });
  const ids = await fs.readdir(BUILDS_DIR);
  const all = await Promise.all(ids.filter((id) => ID_RE.test(id)).map(getBuild));
  return all.filter((b): b is BuildResult => b?.cvId === cvId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function prune(cvId: string, keep: string | null) {
  const builds = await buildsForCV(cvId);
  for (const b of builds.slice(KEEP_BUILDS_PER_CV)) {
    if (b.buildId === keep) continue;
    await fs.rm(buildDir(b.buildId), { recursive: true, force: true });
  }
}

export async function deleteBuildsForCV(cvId: string) {
  for (const b of await buildsForCV(cvId)) await fs.rm(buildDir(b.buildId), { recursive: true, force: true });
}

// --- concurrency ---------------------------------------------------------------

let running = 0;
const queue: (() => void)[] = [];
async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT) await new Promise<void>((r) => queue.push(r));
  running++;
  try {
    return await fn();
  } finally {
    running--;
    queue.shift()?.();
  }
}

const inFlight = new Map<string, Promise<BuildResult>>();

/** Build the CV; a variant build warms the cache without becoming the CV's preview. */
export async function buildCV(cvId: string, variant?: Variant): Promise<BuildResult | null> {
  const prepared = await prepareSource(cvId, variant);
  if (!prepared) return null;
  const key = `${cvId}:${prepared.sourceHash}`;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const promise = runBuild(prepared, !variant).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

async function runBuild({ cv, project, staticFiles: statics, sourceHash }: PreparedSource, isPreview: boolean): Promise<BuildResult> {
  // Same source as an earlier successful build: reuse that exact PDF.
  const cached = (await buildsForCV(cv.id)).find((b) => b.sourceHash === sourceHash && b.status === 'success');
  if (cached) {
    if (isPreview) await markSuccessful(cv.id, cached.buildId);
    if (!cached.templateId || !cached.language) {
      // Builds made before variants existed: record what they were built for.
      Object.assign(cached, { templateId: cv.templateId, language: cv.language });
      await fs.writeFile(path.join(buildDir(cached.buildId), 'build.json'), JSON.stringify(cached, null, 2));
    }
    return { ...cached, cached: true };
  }

  const out = await withSlot(() => compile({ ...project, staticFiles: statics }));
  const buildId = `b${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
  const dir = buildDir(buildId);
  await fs.mkdir(dir, { recursive: true });
  await writeProject(path.join(dir, 'source'), { files: project.files, assets: project.assets, staticFiles: statics });
  await fs.writeFile(path.join(dir, 'main.log'), out.log, 'latin1');
  if (out.pdf) await fs.writeFile(path.join(dir, 'main.pdf'), out.pdf);

  const result: BuildResult = {
    buildId,
    cvId: cv.id,
    sourceHash,
    status: out.ok ? 'success' : 'error',
    cached: false,
    pageCount: out.pageCount,
    durationMs: out.durationMs,
    passes: out.passes,
    errors: out.errors,
    warnings: out.warnings,
    createdAt: new Date().toISOString(),
    failureReason: out.failureReason,
    templateId: cv.templateId,
    language: cv.language,
  };
  await fs.writeFile(path.join(dir, 'build.json'), JSON.stringify(result, null, 2));
  const fresh = await getCV(cv.id);
  if (out.ok && isPreview) await markSuccessful(cv.id, buildId);
  await prune(cv.id, out.ok ? buildId : fresh?.lastSuccessfulBuildId ?? null);
  return result;
}

async function markSuccessful(cvId: string, buildId: string) {
  await updateCV(cvId, (cv) => ({ ...cv, lastSuccessfulBuildId: buildId }));
}
