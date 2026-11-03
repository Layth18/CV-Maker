// Runs XeLaTeX on a generated project inside an isolated temporary directory.
//  - no shell: the compiler is spawned directly with a fixed argument list
//  - -no-shell-escape: \write18 is disabled
//  - only validated relative paths are written; the directory is removed afterwards
//  - every pass has a timeout; on expiry the whole process tree is killed

import { spawn, execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { GeneratedFile, LatexIssue } from '../../shared/types';
import { parseLog } from './logParser';

export const COMPILER = process.env.CV_LATEX_ENGINE || 'xelatex';
const PASS_TIMEOUT_MS = Number(process.env.CV_COMPILE_TIMEOUT_MS || 60_000);
const MAX_PASSES = 3;

export interface CompileInput {
  files: GeneratedFile[];
  assets: { path: string; sourcePath: string }[];
  /** Files that must be copied verbatim (style files), project path -> absolute source. */
  staticFiles: { path: string; sourcePath: string }[];
  mainFile: string;
  /** Runs needed regardless of rerun warnings (positions, page totals). */
  minPasses: number;
}

export interface CompileOutput {
  ok: boolean;
  pdf: Buffer | null;
  log: string;
  passes: number;
  pageCount: number | null;
  errors: LatexIssue[];
  warnings: LatexIssue[];
  durationMs: number;
  failureReason?: string;
}

const SAFE_PATH = /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+$/;

/** Resolve a project-relative path inside root, rejecting anything that escapes it. */
export function safeJoin(root: string, rel: string): string {
  if (!SAFE_PATH.test(rel) || rel.split('/').some((p) => p === '..' || p === '.')) {
    throw new Error(`Unsafe project path: ${rel}`);
  }
  const full = path.resolve(root, rel);
  if (!full.startsWith(path.resolve(root) + path.sep)) throw new Error(`Path escapes project: ${rel}`);
  return full;
}

export async function writeProject(root: string, input: Pick<CompileInput, 'files' | 'assets' | 'staticFiles'>) {
  for (const f of input.files) {
    const dest = safeJoin(root, f.path);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, f.content, 'utf8');
  }
  for (const a of [...input.staticFiles, ...input.assets]) {
    const dest = safeJoin(root, a.path);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(a.sourcePath, dest);
  }
}

function killTree(pid: number | undefined) {
  if (!pid) return;
  if (process.platform === 'win32') {
    execFile('taskkill', ['/pid', String(pid), '/T', '/F'], () => {});
  } else {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        /* already gone */
      }
    }
  }
}

interface PassResult {
  code: number | null;
  timedOut: boolean;
  spawnError?: NodeJS.ErrnoException;
}

function runPass(cwd: string, mainFile: string, noPdf: boolean): Promise<PassResult> {
  const args = [
    '-interaction=nonstopmode',
    '-halt-on-error',
    '-file-line-error',
    '-no-shell-escape',
    ...(noPdf ? ['-no-pdf'] : []),
    mainFile,
  ];
  return new Promise((resolve) => {
    let settled = false;
    const child = spawn(COMPILER, args, {
      cwd,
      shell: false,
      windowsHide: true,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'ignore', 'ignore'],
      env: {
        ...process.env,
        max_print_line: '1000',
        error_line: '254',
        half_error_line: '238',
        openout_any: 'p',
        shell_escape: 'f',
      },
    });
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      killTree(child.pid);
      resolve({ code: null, timedOut: true });
    }, PASS_TIMEOUT_MS);
    child.on('error', (err: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: null, timedOut: false, spawnError: err });
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, timedOut: false });
    });
  });
}

async function readLog(cwd: string, mainFile: string): Promise<string> {
  try {
    return await fs.readFile(path.join(cwd, mainFile.replace(/\.tex$/, '.log')), 'latin1');
  } catch {
    return '';
  }
}

export async function compile(input: CompileInput): Promise<CompileOutput> {
  const started = Date.now();
  const workdir = await fs.mkdtemp(path.join(os.tmpdir(), 'cvstudio-'));
  const done = (o: Omit<CompileOutput, 'durationMs'>): CompileOutput => ({ ...o, durationMs: Date.now() - started });

  try {
    await writeProject(workdir, input);

    let log = '';
    let passes = 0;
    while (passes < MAX_PASSES) {
      passes++;
      const minReached = passes >= input.minPasses;
      // Intermediate passes skip PDF conversion (faster); the final one produces the PDF.
      const result = await runPass(workdir, input.mainFile, !minReached);
      log = await readLog(workdir, input.mainFile);
      const parsed = parseLog(log);

      if (result.spawnError) {
        const missing = result.spawnError.code === 'ENOENT';
        return done({
          ok: false, pdf: null, log, passes, pageCount: null, errors: [], warnings: [],
          failureReason: missing
            ? `The LaTeX compiler "${COMPILER}" was not found. Install TeX Live or MiKTeX and make sure ${COMPILER} is on the PATH (or set CV_LATEX_ENGINE).`
            : `Could not start ${COMPILER}: ${result.spawnError.message}`,
        });
      }
      if (result.timedOut) {
        return done({
          ok: false, pdf: null, log, passes, pageCount: null, errors: parsed.errors, warnings: parsed.warnings,
          failureReason: `Compilation timed out after ${Math.round(PASS_TIMEOUT_MS / 1000)} s and was stopped.`,
        });
      }
      if (result.code !== 0 || parsed.errors.length) {
        return done({
          ok: false, pdf: null, log, passes, pageCount: null,
          errors: parsed.errors.length
            ? parsed.errors
            : [{ severity: 'error', file: null, line: null, message: `${COMPILER} exited with code ${result.code}. See the full log.` }],
          warnings: parsed.warnings,
          failureReason: 'LaTeX reported an error.',
        });
      }
      if (!minReached) continue;
      if (parsed.needsRerun && passes < MAX_PASSES) continue;

      const pdfPath = path.join(workdir, input.mainFile.replace(/\.tex$/, '.pdf'));
      const pdf = await fs.readFile(pdfPath).catch(() => null);
      if (!pdf) {
        return done({
          ok: false, pdf: null, log, passes, pageCount: null, errors: parsed.errors, warnings: parsed.warnings,
          failureReason: 'The compiler finished but produced no PDF.',
        });
      }
      return done({ ok: true, pdf, log, passes, pageCount: parsed.pageCount, errors: [], warnings: parsed.warnings });
    }
    return done({ ok: false, pdf: null, log, passes, pageCount: null, errors: [], warnings: [], failureReason: 'Too many passes.' });
  } catch (err) {
    return done({
      ok: false, pdf: null, log: '', passes: 0, pageCount: null, errors: [], warnings: [],
      failureReason: `Internal error while preparing the build: ${(err as Error).message}`,
    });
  } finally {
    await fs.rm(workdir, { recursive: true, force: true }).catch(() => {});
  }
}

let versionCache: Promise<string | null> | null = null;
export function compilerVersion(): Promise<string | null> {
  versionCache ??= new Promise((resolve) => {
    execFile(COMPILER, ['--version'], { timeout: 10_000, windowsHide: true }, (err, stdout) => {
      resolve(err ? null : stdout.split(/\r?\n/)[0]?.trim() || null);
    });
  });
  return versionCache;
}

export function hashSource(files: GeneratedFile[], binaries: Buffer[], extra: string): string {
  const h = createHash('sha256');
  h.update(extra);
  for (const f of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    h.update('\0' + f.path + '\0' + f.content);
  }
  for (const b of binaries) h.update(b);
  return h.digest('hex').slice(0, 24);
}
