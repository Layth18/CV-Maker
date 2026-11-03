import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(here, '..');
export const DATA_DIR = path.resolve(process.env.CV_DATA_DIR || path.join(ROOT_DIR, 'data'));
export const CVS_DIR = path.join(DATA_DIR, 'cvs');
export const ASSETS_DIR = path.join(DATA_DIR, 'assets');
export const BUILDS_DIR = path.join(DATA_DIR, 'builds');
export const LATEX_ASSETS_DIR = path.join(here, 'latex-assets');

/** Ids used in URLs and file names: strictly validated to prevent path traversal. */
export const ID_RE = /^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/;
export const ASSET_RE = /^[a-z0-9][a-z0-9-]{0,63}\.(png|jpg)$/;
