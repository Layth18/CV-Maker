// Writes the generated LaTeX project for one template to a folder (for debugging).
// Usage: npx tsx scripts/dump-project.ts <outDir> <templateId> [en|fr]
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createCVConfig } from '../shared/factory';
import type { Lang, Profile } from '../shared/types';
import { writeProject } from '../server/compile/xelatex';
import { generateProject, STATIC_STYLE_FILES } from '../server/latex/generate';
import { loadPhoto } from '../server/assets';
import { LATEX_ASSETS_DIR } from '../server/paths';
import { getProfile } from '../server/store';

const [outDir, templateId, lang = 'en'] = process.argv.slice(2);
const profile: Profile = await getProfile();
const cv = createCVConfig({ id: 'dump', name: templateId, templateId, language: lang as Lang, profile });
const project = generateProject({ profile, cv, photo: await loadPhoto(profile.personal.photo) });
await fs.mkdir(outDir, { recursive: true });
await writeProject(outDir, { ...project, staticFiles: STATIC_STYLE_FILES.map((f) => ({ path: f, sourcePath: path.join(LATEX_ASSETS_DIR, f) })) });
console.log(`Wrote ${project.files.length} files to ${outDir}`);
