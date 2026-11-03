// Builds one stored CV exactly as the app would and writes the PDF (debug helper).
// Usage: npx tsx scripts/build-cv.ts <cvNameSubstring> <out.pdf>
import { promises as fs } from 'node:fs';
import { listCVs } from '../server/store';
import { prepareSource } from '../server/builds';
import { compile } from '../server/compile/xelatex';

const [needle, out] = process.argv.slice(2);
const cv = (await listCVs()).find((c) => c.name.includes(needle));
if (!cv) throw new Error(`No CV matching "${needle}"`);
const p = (await prepareSource(cv.id))!;
const res = await compile({ ...p.project, staticFiles: p.staticFiles });
console.log(cv.name, res.ok ? `OK ${res.pageCount}p` : res.failureReason, res.warnings.map((w) => w.message).join(' | '));
if (res.pdf) await fs.writeFile(out, res.pdf);
