// Turning user text into safe LaTeX. Every piece of profile content goes
// through here, so user data can never inject LaTeX commands.

const SPECIALS: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '{': '\\{',
  '}': '\\}',
  $: '\\$',
  '&': '\\&',
  '%': '\\%',
  '#': '\\#',
  _: '\\_',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
};

/** Escape plain text (no formatting). Line breaks become spaces. */
export function tex(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .replace(/[\\{}$&%#_~^]/g, (c) => SPECIALS[c])
    .replace(/\s*\n\s*/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim();
}

/**
 * Escape text that may contain light formatting:
 *   **bold**, *italic*, and blank lines for paragraph breaks.
 */
export function richTex(text: string | undefined | null): string {
  if (!text) return '';
  const paragraphs = text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return paragraphs
    .map((p) =>
      tex(p)
        .replace(/\*\*(.+?)\*\*/g, '\\textbf{$1}')
        .replace(/(^|[^\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])/g, '$1\\textit{$2}'),
    )
    .join('\n\\par ');
}

/**
 * Escape a URL for \href. Characters that are special to TeX are
 * percent-encoded, which is equivalent for any URL consumer.
 */
export function texUrl(url: string | undefined | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!/^(https?:|mailto:|tel:)/i.test(trimmed)) return '';
  return trimmed.replace(/[\\{}%#~^_&\s$]/g, (c) => {
    const hex = c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0');
    return `\\%${hex}`;
  });
}

/** Validate a hex color and return it without '#', falling back if invalid. */
export function hexColor(value: string | undefined, fallback: string): string {
  const v = (value ?? '').trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(v)) return v.toUpperCase();
  if (/^[0-9a-fA-F]{3}$/.test(v)) return v.split('').map((c) => c + c).join('').toUpperCase();
  return fallback.replace(/^#/, '').toUpperCase();
}

/** Format a number for TeX lengths without exponent noise. */
export function num(n: number, digits = 3): string {
  return Number(n.toFixed(digits)).toString();
}
