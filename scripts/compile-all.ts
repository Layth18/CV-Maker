// Generates and compiles test documents from your profile (or the starter profile).
// Usage:
//   npm run test:latex -- [outDir] [templateFilter]   every template, EN and FR
//   npm run test:latex -- [outDir] --fonts            every font with light + semibold weights
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { FONTS, TEMPLATES } from '../shared/catalog';
import { createCVConfig } from '../shared/factory';
import type { CVConfig, Lang, Profile } from '../shared/types';
import { compile } from '../server/compile/xelatex';
import { generateProject, STATIC_STYLE_FILES } from '../server/latex/generate';
import { loadPhoto } from '../server/assets';
import { LATEX_ASSETS_DIR } from '../server/paths';
import { getProfile } from '../server/store';

const outDir = path.resolve(process.argv[2] ?? 'out');
const filter = process.argv[3] ?? '';
await fs.mkdir(outDir, { recursive: true });
const profile: Profile = await getProfile();
const photo = await loadPhoto(profile.personal.photo);

const cases: { name: string; cv: CVConfig }[] = [];
if (filter === '--fonts') {
  for (const f of FONTS) {
    const cv = createCVConfig({ id: 'test', name: f.label, templateId: 'custom', language: 'fr', profile });
    cv.typography = { ...cv.typography, fontFamily: f.id, headingFontFamily: 'heros', bodyWeight: 'light', boldWeight: 'semibold' };
    cases.push({ name: `font-${f.id}`, cv });
  }
} else {
  for (const t of TEMPLATES.filter((t) => t.id.includes(filter))) {
    for (const lang of ['en', 'fr'] as Lang[]) {
      cases.push({ name: `${t.id}-${lang}`, cv: createCVConfig({ id: 'test', name: `${t.name} ${lang}`, templateId: t.id, language: lang, profile }) });
    }
  }
}

let failures = 0;
for (const { name, cv } of cases) {
  const project = generateProject({ profile, cv, photo });
  const res = await compile({
    ...project,
    staticFiles: STATIC_STYLE_FILES.map((f) => ({ path: f, sourcePath: path.join(LATEX_ASSETS_DIR, f) })),
  });
  if (res.ok && res.pdf) {
    await fs.writeFile(path.join(outDir, `${name}.pdf`), res.pdf);
    const missing = res.warnings.filter((w) => w.message.startsWith('Missing character')).length;
    console.log(`OK   ${name.padEnd(28)} ${res.pageCount}p ${res.passes} passes ${res.durationMs}ms  warnings=${res.warnings.length}${missing ? `  MISSING GLYPHS=${missing}` : ''}`);
  } else {
    failures++;
    console.log(`FAIL ${name}: ${res.failureReason}`);
    for (const e of res.errors) console.log(`     ${e.file}:${e.line} ${e.message} | ${e.context ?? ''}`);
    await fs.writeFile(path.join(outDir, `${name}.log`), res.log);
    const srcDir = path.join(outDir, `${name}-src`);
    for (const f of project.files) {
      await fs.mkdir(path.dirname(path.join(srcDir, f.path)), { recursive: true });
      await fs.writeFile(path.join(srcDir, f.path), f.content);
    }
  }
  if (project.notes.length) console.log(`     notes: ${project.notes.join(' | ')}`);
}
process.exit(failures ? 1 : 0);
