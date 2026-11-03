// Extracts errors, warnings and the page count from a (Xe)LaTeX log.
// Expects the log of a run with -file-line-error and max_print_line=1000,
// so errors look like "./sections/experience.tex:14: Undefined control sequence."

import type { LatexIssue } from '../../shared/types';

const FILE_LINE_ERROR = /^(.*?\.(?:tex|sty|cls|def|cfg)):(\d+): (.+)$/;
const BANG_ERROR = /^! (.+)$/;
const CONTEXT_LINE = /^l\.(\d+) (.*)$/;
const WARNING = /^(?:LaTeX|Package (\S+)|Class (\S+)) Warning: (.+)$/;
const MISSING_CHAR = /^Missing character: (.+)$/;
const BOX_WARNING = /^(Overfull|Underfull) \\[hv]box (.+?) (?:in paragraph |detected |has occurred while \\output is active)?(?:at lines? (\d+)(?:--\d+)?)?/;

const MAX_WARNINGS = 40;

function cleanFile(file: string): string {
  const f = file.replace(/\\/g, '/').replace(/^\.\//, '');
  // Package files from the TeX distribution: keep only the base name.
  if (/^[a-zA-Z]:\//.test(f) || f.startsWith('/')) return f.split('/').pop() ?? f;
  return f;
}

export interface ParsedLog {
  errors: LatexIssue[];
  warnings: LatexIssue[];
  pageCount: number | null;
  needsRerun: boolean;
}

export function parseLog(log: string): ParsedLog {
  const lines = log.replace(/\r\n?/g, '\n').split('\n');
  const errors: LatexIssue[] = [];
  const warnings: LatexIssue[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const fe = FILE_LINE_ERROR.exec(line);
    const be = fe ? null : BANG_ERROR.exec(line);
    if (fe || be) {
      let message = fe ? fe[3] : be![1];
      // Some messages continue on the following lines until a blank line or context.
      let context: string | undefined;
      let lineNo = fe ? Number(fe[2]) : null;
      for (let j = i + 1; j < Math.min(lines.length, i + 14); j++) {
        const ctx = CONTEXT_LINE.exec(lines[j]);
        if (ctx) {
          context = (ctx[2] + ' ' + (lines[j + 1] ?? '').trim()).trim();
          lineNo ??= Number(ctx[1]);
          break;
        }
        if (j === i + 1 && lines[j].trim() && !lines[j].startsWith('See the') && !lines[j].startsWith('Type ')) {
          message += ' ' + lines[j].trim();
        }
      }
      const issue: LatexIssue = {
        severity: 'error',
        file: fe ? cleanFile(fe[1]) : null,
        line: lineNo,
        message: message.replace(/\s+/g, ' ').trim(),
        context,
      };
      const key = `${issue.file}:${issue.line}:${issue.message}`;
      if (!seen.has(key)) {
        seen.add(key);
        errors.push(issue);
      }
      continue;
    }

    if (warnings.length >= MAX_WARNINGS) continue;

    const w = WARNING.exec(line);
    if (w) {
      let message = w[3];
      // Continuation lines are indented with "(pkgname)" or spaces.
      for (let j = i + 1; j < lines.length && /^(\(\S+\)|\s{4,})/.test(lines[j]); j++) {
        message += ' ' + lines[j].replace(/^\(\S+\)\s*/, '').trim();
      }
      const pkg = w[1] ?? w[2];
      const lineMatch = /on input line (\d+)/.exec(message);
      const text = `${pkg ? `[${pkg}] ` : ''}${message.replace(/\s+/g, ' ').trim()}`;
      if (!seen.has(text)) {
        seen.add(text);
        warnings.push({ severity: 'warning', file: null, line: lineMatch ? Number(lineMatch[1]) : null, message: text });
      }
      continue;
    }

    const mc = MISSING_CHAR.exec(line);
    if (mc) {
      const text = `Missing character: ${mc[1]}`;
      if (!seen.has(text)) {
        seen.add(text);
        warnings.push({ severity: 'warning', file: null, line: null, message: text });
      }
      continue;
    }

    const bw = BOX_WARNING.exec(line);
    if (bw && bw[1] === 'Overfull') {
      const text = `Overfull box ${bw[2]} — some content sticks out of its column`;
      warnings.push({ severity: 'warning', file: null, line: bw[3] ? Number(bw[3]) : null, message: text });
    }
  }

  const pages = /Output written on .*?\((\d+) pages?/.exec(log);
  const needsRerun =
    /Rerun to get|Label\(s\) may have changed|Package rerunfilecheck Warning|There were undefined references|Please rerun LaTeX|Package paracol Warning:.*rerun/i.test(log);

  return { errors, warnings, pageCount: pages ? Number(pages[1]) : null, needsRerun };
}
