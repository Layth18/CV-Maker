// Input validation: coerce anything received over HTTP into well-formed
// Profile / CVConfig objects so the generator never sees malformed data.

import { BUILTIN_SECTIONS, currentDesign, FONTS, getTemplate, templateSections, THEMES } from '../shared/catalog';
import type {
  CVConfig,
  DetailMode,
  FormatDesign,
  Localized,
  Profile,
  SectionConfig,
  SectionKey,
  TextItem,
} from '../shared/types';

type Any = Record<string, unknown> | undefined | null;

const str = (v: unknown, max = 4000): string => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown, min: number, max: number, def: number): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const bool = (v: unknown, def: boolean): boolean => (typeof v === 'boolean' ? v : def);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], def: T): T =>
  allowed.includes(v as T) ? (v as T) : def;
const arr = (v: unknown): Any[] => (Array.isArray(v) ? (v as Any[]).slice(0, 200) : []);
const id = (v: unknown): string => {
  const s = str(v, 64);
  return /^[A-Za-z0-9_-]{1,64}$/.test(s) ? s : Math.random().toString(36).slice(2, 10);
};
const loc = (v: unknown, max = 4000): Localized => {
  const o = (v ?? {}) as Any;
  return { en: str(o?.en, max), fr: str(o?.fr, max) };
};
const textItems = (v: unknown): TextItem[] => arr(v).map((t) => ({ id: id(t?.id), text: loc(t?.text) }));
const color = (v: unknown, def: string): string => {
  const s = str(v, 9).trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toUpperCase() : def;
};

/** Split "React, Vite, UI/UX (Illustrator, Photoshop)" on commas outside parentheses. */
function splitList(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out.filter(Boolean);
}

/** Older profiles stored a group's skills as one comma-separated string per language. */
function splitSkills(groupId: string, items: Localized): TextItem[] {
  const en = splitList(items.en);
  const fr = splitList(items.fr);
  return Array.from({ length: Math.max(en.length, fr.length) }, (_, i) => ({
    id: `${groupId}-${i + 1}`.slice(0, 64),
    text: { en: en[i] ?? '', fr: fr[i] ?? '' },
  }));
}

export function normalizeProfile(input: unknown): Profile {
  const p = (input ?? {}) as Any;
  const personal = (p?.personal ?? {}) as Any;
  return {
    personal: {
      firstName: str(personal?.firstName, 100),
      lastName: str(personal?.lastName, 100),
      headline: loc(personal?.headline, 300),
      email: str(personal?.email, 200),
      phone: str(personal?.phone, 60),
      location: loc(personal?.location, 200),
      links: arr(personal?.links).map((l) => ({
        id: id(l?.id),
        kind: oneOf(l?.kind, ['linkedin', 'github', 'website', 'portfolio', 'other'] as const, 'other'),
        url: str(l?.url, 500),
        label: loc(l?.label, 200),
      })),
      photo: typeof personal?.photo === 'string' && /^[a-z0-9][a-z0-9-]{0,63}\.(png|jpg)$/.test(personal.photo) ? personal.photo : null,
    },
    summary: loc(p?.summary, 6000),
    skills: arr(p?.skills).map((s) => {
      const groupId = id(s?.id);
      return { id: groupId, category: loc(s?.category, 200), skills: Array.isArray(s?.skills) ? textItems(s.skills) : splitSkills(groupId, loc(s?.items, 2000)) };
    }),
    languages: arr(p?.languages).map((l) => ({ id: id(l?.id), name: loc(l?.name, 100), level: loc(l?.level, 100) })),
    studentLife: arr(p?.studentLife).map((g) => ({
      id: id(g?.id),
      title: loc(g?.title, 300),
      subtitle: loc(g?.subtitle, 300),
      date: loc(g?.date, 100),
      style: oneOf(g?.style, ['bullets', 'lines'] as const, 'bullets'),
      items: textItems(g?.items),
    })),
    experience: arr(p?.experience).map((e) => ({
      id: id(e?.id),
      kind: oneOf(e?.kind, ['work', 'internship', 'project', 'academic', 'volunteer'] as const, 'project'),
      title: loc(e?.title, 300),
      organization: loc(e?.organization, 300),
      location: loc(e?.location, 200),
      date: loc(e?.date, 100),
      tech: str(e?.tech, 500),
      description: loc(e?.description, 4000),
      bullets: textItems(e?.bullets),
    })),
    education: arr(p?.education).map((e) => ({
      id: id(e?.id),
      institution: loc(e?.institution, 300),
      degree: loc(e?.degree, 300),
      location: loc(e?.location, 200),
      date: loc(e?.date, 100),
      details: loc(e?.details, 2000),
    })),
    certifications: arr(p?.certifications).map((c) => ({
      id: id(c?.id),
      name: loc(c?.name, 300),
      issuer: loc(c?.issuer, 200),
      date: loc(c?.date, 100),
    })),
    customSections: arr(p?.customSections).map((c) => ({
      id: id(c?.id),
      title: loc(c?.title, 200),
      entries: arr(c?.entries).map((e) => ({
        id: id(e?.id),
        title: loc(e?.title, 300),
        subtitle: loc(e?.subtitle, 300),
        date: loc(e?.date, 100),
        description: loc(e?.description, 4000),
      })),
    })),
  };
}

function sectionKey(v: unknown): SectionKey | null {
  const s = str(v, 80);
  if ((BUILTIN_SECTIONS as string[]).includes(s)) return s as SectionKey;
  if (/^custom:[A-Za-z0-9_-]{1,64}$/.test(s)) return s as SectionKey;
  return null;
}

function normalizeSections(input: unknown, fallback: SectionConfig[]): SectionConfig[] {
  const seen = new Set<string>();
  const sections: SectionConfig[] = [];
  for (const s of arr(input)) {
    const key = sectionKey(s?.key);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    sections.push({
      key,
      visible: bool(s?.visible, true),
      column: oneOf(s?.column, ['main', 'sidebar'] as const, 'main'),
      title: loc(s?.title, 200),
      itemIds: s?.itemIds === null || s?.itemIds === undefined ? null : arr(s.itemIds).map((x) => str(x, 64)).filter(Boolean),
      detail: oneOf<DetailMode>(s?.detail, ['description', 'bullets', 'both'], 'both'),
      hiddenSubItems: arr(s?.hiddenSubItems).map((x) => str(x, 64)).filter(Boolean),
    });
  }
  return sections.length ? sections : fallback.map((s) => ({ ...s, hiddenSubItems: s.hiddenSubItems ?? [] }));
}

/** Validate one format's design; missing or invalid fields keep the fallback's value. */
export function normalizeDesign(input: unknown, e: FormatDesign): FormatDesign {
  const c = (input ?? {}) as Any;
  const l = (c?.layout ?? {}) as Any;
  const ty = (c?.typography ?? {}) as Any;
  const co = (c?.colors ?? {}) as Any;
  const m = (l?.margins ?? {}) as Any;
  const fontIds = FONTS.map((f) => f.id);
  return {
    region: oneOf(c?.region, ['CA', 'FR', 'INTL'] as const, e.region),
    theme: oneOf(c?.theme, THEMES.map((x) => x.id), e.theme),
    sections: normalizeSections(c?.sections, e.sections),
    layout: {
      columns: l?.columns === 2 ? 2 : l?.columns === 1 ? 1 : e.layout.columns,
      sidebarPosition: oneOf(l?.sidebarPosition, ['left', 'right'] as const, e.layout.sidebarPosition),
      sidebarWidth: num(l?.sidebarWidth, 0.2, 0.45, e.layout.sidebarWidth),
      sidebarFilled: bool(l?.sidebarFilled, e.layout.sidebarFilled),
      columnDivider: bool(l?.columnDivider, e.layout.columnDivider),
      headerStyle: oneOf(l?.headerStyle, ['banner', 'left', 'centered', 'sidebar', 'main'] as const, e.layout.headerStyle),
      sectionSpacing: num(l?.sectionSpacing, 0, 40, e.layout.sectionSpacing),
      entrySpacing: num(l?.entrySpacing, 0, 30, e.layout.entrySpacing),
      margins: {
        top: num(m?.top, 0.5, 4, e.layout.margins.top),
        bottom: num(m?.bottom, 0.5, 4, e.layout.margins.bottom),
        left: num(m?.left, 0.5, 4, e.layout.margins.left),
        right: num(m?.right, 0.5, 4, e.layout.margins.right),
      },
      pageNumbering: oneOf(l?.pageNumbering, ['none', 'simple', 'of-total'] as const, e.layout.pageNumbering),
      showPhoto: bool(l?.showPhoto, e.layout.showPhoto),
      photoShape: oneOf(l?.photoShape, ['circle', 'rounded', 'square'] as const, e.layout.photoShape),
      photoSize: num(l?.photoSize, 1.5, 5, e.layout.photoSize),
      paper: oneOf(l?.paper, ['a4', 'letter'] as const, e.layout.paper),
    },
    typography: {
      fontFamily: oneOf(ty?.fontFamily, fontIds, e.typography.fontFamily),
      headingFontFamily: ty?.headingFontFamily === '' ? '' : oneOf(ty?.headingFontFamily, fontIds, e.typography.headingFontFamily),
      fontSize: num(ty?.fontSize, 8, 13, e.typography.fontSize),
      headingSize: num(ty?.headingSize, 8, 24, e.typography.headingSize),
      nameSize: num(ty?.nameSize, 14, 44, e.typography.nameSize),
      alignment: oneOf(ty?.alignment, ['left', 'justify'] as const, e.typography.alignment),
      lineSpacing: num(ty?.lineSpacing, 0.9, 1.6, e.typography.lineSpacing),
      bodyWeight: oneOf(ty?.bodyWeight, ['light', 'regular'] as const, e.typography.bodyWeight),
      boldWeight: oneOf(ty?.boldWeight, ['semibold', 'bold'] as const, e.typography.boldWeight),
      headingBold: bool(ty?.headingBold, e.typography.headingBold),
      headingUppercase: bool(ty?.headingUppercase, e.typography.headingUppercase),
    },
    colors: {
      primary: color(co?.primary, e.colors.primary),
      secondary: color(co?.secondary, e.colors.secondary),
      accent: color(co?.accent, e.colors.accent),
      text: color(co?.text, e.colors.text),
      sidebarBg: color(co?.sidebarBg, e.colors.sidebarBg),
      sidebarText: color(co?.sidebarText, e.colors.sidebarText),
      heading: color(co?.heading, e.colors.heading),
      headerBg: color(co?.headerBg, e.colors.headerBg),
      headerText: color(co?.headerText, e.colors.headerText),
    },
  };
}

function templateDesign(templateId: string): FormatDesign {
  const t = getTemplate(templateId);
  return {
    region: t.region,
    theme: t.theme,
    sections: templateSections(t, []),
    layout: structuredClone(t.layout),
    typography: structuredClone(t.typography),
    colors: structuredClone(t.colors),
  };
}

/** Normalize a CV received from the client, keeping server-owned fields from `existing`. */
export function normalizeCV(input: unknown, existing: CVConfig): CVConfig {
  const c = (input ?? {}) as Any;
  const e = upgradeCV(existing);
  const t = getTemplate(str(c?.templateId) || e.templateId);
  const active = normalizeDesign(c, t.id === e.templateId ? currentDesign(e) : (e.designs[t.id] ?? templateDesign(t.id)));

  const designs: Record<string, FormatDesign> = {};
  const inDesigns = (c?.designs ?? e.designs) as Record<string, unknown>;
  if (inDesigns && typeof inDesigns === 'object' && !Array.isArray(inDesigns)) {
    for (const [id, d] of Object.entries(inDesigns).slice(0, 20)) {
      if (id === t.id || getTemplate(id).id !== id) continue;
      designs[id] = normalizeDesign(d, e.designs[id] ?? (id === e.templateId ? currentDesign(e) : templateDesign(id)));
    }
  }
  const formats = [...new Set(arr(c?.formats ?? e.formats).map((x) => str(x, 64)).filter((id) => getTemplate(id).id === id))];
  if (!formats.includes(t.id)) formats.unshift(t.id);

  return {
    id: e.id,
    name: str(c?.name, 120).trim() || e.name,
    language: oneOf(c?.language, ['en', 'fr'] as const, e.language),
    templateId: t.id,
    ...active,
    formats,
    designs,
    advanced: {
      extraPreamble: typeof (c?.advanced as Any)?.extraPreamble === 'string'
        ? str((c?.advanced as Any)?.extraPreamble, 20000)
        : e.advanced.extraPreamble,
    },
    lastSuccessfulBuildId: e.lastSuccessfulBuildId,
    createdAt: e.createdAt,
    updatedAt: new Date().toISOString(),
  };
}

/** Fill fields added after a CV file was first written. */
export function upgradeCV(cv: CVConfig): CVConfig {
  const fixSections = (sections: SectionConfig[]) => sections.map((s) => ({ ...s, hiddenSubItems: s.hiddenSubItems ?? [] }));
  const designs = cv.designs && typeof cv.designs === 'object' ? cv.designs : {};
  return {
    ...cv,
    sections: fixSections(cv.sections),
    formats: Array.isArray(cv.formats) && cv.formats.length ? cv.formats : [cv.templateId],
    designs: Object.fromEntries(Object.entries(designs).map(([k, d]) => [k, { ...d, sections: fixSections(d.sections) }])),
  };
}
