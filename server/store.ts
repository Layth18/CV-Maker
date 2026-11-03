// JSON-file database: data/profile.json (bilingual source of truth) and
// data/cvs/<id>.json (one configuration per CV). Writes are atomic.

import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { CVConfig, CVSummary, Profile } from '../shared/types';
import { normalizeProfile, upgradeCV } from './normalize';
import { CVS_DIR, DATA_DIR, ID_RE, ROOT_DIR } from './paths';

const PROFILE_FILE = path.join(DATA_DIR, 'profile.json');
const STARTER_PROFILE = path.join(ROOT_DIR, 'server', 'starter-profile.json');

async function writeJsonAtomic(file: string, data: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomBytes(4).toString('hex')}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  await fs.rename(tmp, file);
}

function cvFile(id: string): string {
  if (!ID_RE.test(id)) throw Object.assign(new Error('Invalid CV id'), { status: 400 });
  return path.join(CVS_DIR, `${id}.json`);
}

export function newId(prefix = 'cv'): string {
  return `${prefix}-${randomBytes(5).toString('hex')}`;
}

export async function getProfile(): Promise<Profile> {
  try {
    return normalizeProfile(JSON.parse(await fs.readFile(PROFILE_FILE, 'utf8')));
  } catch (err) {
    // First launch: start from an anonymous example profile.
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return normalizeProfile(JSON.parse(await fs.readFile(STARTER_PROFILE, 'utf8')));
    throw err;
  }
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  const clean = normalizeProfile(profile);
  await writeJsonAtomic(PROFILE_FILE, clean);
  return clean;
}

export async function getCV(id: string): Promise<CVConfig | null> {
  try {
    return upgradeCV(JSON.parse(await fs.readFile(cvFile(id), 'utf8')) as CVConfig);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function saveCV(cv: CVConfig): Promise<CVConfig> {
  await writeJsonAtomic(cvFile(cv.id), cv);
  return cv;
}

// Serialize read-modify-write cycles per CV (editor saves vs. build bookkeeping).
const locks = new Map<string, Promise<unknown>>();
export async function updateCV(id: string, fn: (cv: CVConfig) => CVConfig | Promise<CVConfig>): Promise<CVConfig | null> {
  const prev = locks.get(id) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(async () => {
    const cv = await getCV(id);
    return cv ? saveCV(await fn(cv)) : null;
  });
  locks.set(id, next);
  try {
    return await next;
  } finally {
    if (locks.get(id) === next) locks.delete(id);
  }
}

export async function deleteCV(id: string): Promise<void> {
  await fs.rm(cvFile(id), { force: true });
}

export async function listCVs(): Promise<CVSummary[]> {
  await fs.mkdir(CVS_DIR, { recursive: true });
  const names = (await fs.readdir(CVS_DIR)).filter((n) => n.endsWith('.json'));
  const cvs = await Promise.all(names.map((n) => getCV(n.slice(0, -5)).catch(() => null)));
  return cvs
    .filter((c): c is CVConfig => Boolean(c))
    .map(({ id, name, language, region, templateId, formats, updatedAt, lastSuccessfulBuildId }) => ({
      id, name, language, region, templateId, formats, updatedAt, lastSuccessfulBuildId,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
