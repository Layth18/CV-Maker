// Static catalogs: fonts available to XeLaTeX, CV templates and section labels.
// Used by the editor to populate controls and by the LaTeX engine to emit code.

import type {
  BuiltinSectionKey,
  ColorConfig,
  CVConfig,
  DetailMode,
  FormatDesign,
  Lang,
  LayoutConfig,
  Region,
  SectionConfig,
  SectionKey,
  ThemeId,
  TypographyConfig,
} from './types';

// ---------------------------------------------------------------------------
// Fonts (all shipped with TeX Live; loaded by file name so no system install is needed)
// ---------------------------------------------------------------------------

export interface FontDef {
  id: string;
  label: string;
  kind: 'sans' | 'serif';
  ext: '.otf' | '.ttf';
  regular: string;
  italic: string;
  bold: string;
  boldItalic: string;
  light?: string;
  lightItalic?: string;
  semibold?: string;
  semiboldItalic?: string;
}

export const FONTS: FontDef[] = [
  { id: 'lmsans', label: 'Latin Modern Sans', kind: 'sans', ext: '.otf', regular: 'lmsans10-regular', italic: 'lmsans10-oblique', bold: 'lmsans10-bold', boldItalic: 'lmsans10-boldoblique' },
  { id: 'heros', label: 'TeX Gyre Heros (Helvetica-like)', kind: 'sans', ext: '.otf', regular: 'texgyreheros-regular', italic: 'texgyreheros-italic', bold: 'texgyreheros-bold', boldItalic: 'texgyreheros-bolditalic' },
  { id: 'fira', label: 'Fira Sans', kind: 'sans', ext: '.otf', regular: 'FiraSans-Regular', italic: 'FiraSans-Italic', bold: 'FiraSans-Bold', boldItalic: 'FiraSans-BoldItalic', light: 'FiraSans-Light', lightItalic: 'FiraSans-LightItalic', semibold: 'FiraSans-SemiBold', semiboldItalic: 'FiraSans-SemiBoldItalic' },
  { id: 'roboto', label: 'Roboto', kind: 'sans', ext: '.otf', regular: 'Roboto-Regular', italic: 'Roboto-Italic', bold: 'Roboto-Bold', boldItalic: 'Roboto-BoldItalic', light: 'Roboto-Light', lightItalic: 'Roboto-LightItalic', semibold: 'Roboto-Medium', semiboldItalic: 'Roboto-MediumItalic' },
  { id: 'sourcesans', label: 'Source Sans Pro', kind: 'sans', ext: '.otf', regular: 'SourceSansPro-Regular', italic: 'SourceSansPro-RegularIt', bold: 'SourceSansPro-Bold', boldItalic: 'SourceSansPro-BoldIt', light: 'SourceSansPro-Light', lightItalic: 'SourceSansPro-LightIt', semibold: 'SourceSansPro-Semibold', semiboldItalic: 'SourceSansPro-SemiboldIt' },
  { id: 'lato', label: 'Lato', kind: 'sans', ext: '.ttf', regular: 'Lato-Regular', italic: 'Lato-Italic', bold: 'Lato-Bold', boldItalic: 'Lato-BoldItalic', light: 'Lato-Light', lightItalic: 'Lato-LightItalic', semibold: 'Lato-Semibold', semiboldItalic: 'Lato-SemiboldItalic' },
  { id: 'plex', label: 'IBM Plex Sans', kind: 'sans', ext: '.otf', regular: 'IBMPlexSans-Regular', italic: 'IBMPlexSans-Italic', bold: 'IBMPlexSans-Bold', boldItalic: 'IBMPlexSans-BoldItalic', light: 'IBMPlexSans-Light', lightItalic: 'IBMPlexSans-LightItalic', semibold: 'IBMPlexSans-SemiBold', semiboldItalic: 'IBMPlexSans-SemiBoldItalic' },
  { id: 'inter', label: 'Inter', kind: 'sans', ext: '.otf', regular: 'Inter-Regular', italic: 'Inter-Italic', bold: 'Inter-Bold', boldItalic: 'Inter-BoldItalic', light: 'Inter-Light', lightItalic: 'Inter-LightItalic', semibold: 'Inter-SemiBold', semiboldItalic: 'Inter-SemiBoldItalic' },
  { id: 'opensans', label: 'Open Sans', kind: 'sans', ext: '.ttf', regular: 'OpenSans-Regular', italic: 'OpenSans-Italic', bold: 'OpenSans-Bold', boldItalic: 'OpenSans-BoldItalic', light: 'OpenSans-Light', lightItalic: 'OpenSans-LightItalic', semibold: 'OpenSans-SemiBold', semiboldItalic: 'OpenSans-SemiBoldItalic' },
  { id: 'notosans', label: 'Noto Sans', kind: 'sans', ext: '.ttf', regular: 'NotoSans-Regular', italic: 'NotoSans-Italic', bold: 'NotoSans-Bold', boldItalic: 'NotoSans-BoldItalic', light: 'NotoSans-Light', lightItalic: 'NotoSans-LightItalic', semibold: 'NotoSans-SemiBold', semiboldItalic: 'NotoSans-SemiBoldItalic' },
  { id: 'montserrat', label: 'Montserrat', kind: 'sans', ext: '.otf', regular: 'Montserrat-Regular', italic: 'Montserrat-Italic', bold: 'Montserrat-Bold', boldItalic: 'Montserrat-BoldItalic', light: 'Montserrat-Light', lightItalic: 'Montserrat-LightItalic', semibold: 'Montserrat-SemiBold', semiboldItalic: 'Montserrat-SemiBoldItalic' },
  { id: 'libertinussans', label: 'Libertinus Sans', kind: 'sans', ext: '.otf', regular: 'LibertinusSans-Regular', italic: 'LibertinusSans-Italic', bold: 'LibertinusSans-Bold', boldItalic: 'LibertinusSans-Bold' },
  { id: 'lmroman', label: 'Latin Modern Roman', kind: 'serif', ext: '.otf', regular: 'lmroman10-regular', italic: 'lmroman10-italic', bold: 'lmroman10-bold', boldItalic: 'lmroman10-bolditalic' },
  { id: 'termes', label: 'TeX Gyre Termes (Times-like)', kind: 'serif', ext: '.otf', regular: 'texgyretermes-regular', italic: 'texgyretermes-italic', bold: 'texgyretermes-bold', boldItalic: 'texgyretermes-bolditalic' },
  { id: 'pagella', label: 'TeX Gyre Pagella (Palatino-like)', kind: 'serif', ext: '.otf', regular: 'texgyrepagella-regular', italic: 'texgyrepagella-italic', bold: 'texgyrepagella-bold', boldItalic: 'texgyrepagella-bolditalic' },
  { id: 'libertinus', label: 'Libertinus Serif', kind: 'serif', ext: '.otf', regular: 'LibertinusSerif-Regular', italic: 'LibertinusSerif-Italic', bold: 'LibertinusSerif-Bold', boldItalic: 'LibertinusSerif-BoldItalic', semibold: 'LibertinusSerif-Semibold', semiboldItalic: 'LibertinusSerif-SemiboldItalic' },
  { id: 'sourceserif', label: 'Source Serif Pro', kind: 'serif', ext: '.otf', regular: 'SourceSerifPro-Regular', italic: 'SourceSerifPro-RegularIt', bold: 'SourceSerifPro-Bold', boldItalic: 'SourceSerifPro-BoldIt', light: 'SourceSerifPro-Light', lightItalic: 'SourceSerifPro-LightIt', semibold: 'SourceSerifPro-Semibold', semiboldItalic: 'SourceSerifPro-SemiboldIt' },
  { id: 'ebgaramond', label: 'EB Garamond', kind: 'serif', ext: '.otf', regular: 'EBGaramond-Regular', italic: 'EBGaramond-Italic', bold: 'EBGaramond-Bold', boldItalic: 'EBGaramond-BoldItalic', semibold: 'EBGaramond-SemiBold', semiboldItalic: 'EBGaramond-SemiBoldItalic' },
  { id: 'notoserif', label: 'Noto Serif', kind: 'serif', ext: '.ttf', regular: 'NotoSerif-Regular', italic: 'NotoSerif-Italic', bold: 'NotoSerif-Bold', boldItalic: 'NotoSerif-BoldItalic', light: 'NotoSerif-Light', lightItalic: 'NotoSerif-LightItalic', semibold: 'NotoSerif-SemiBold', semiboldItalic: 'NotoSerif-SemiBoldItalic' },
];

export function getFont(id: string): FontDef {
  return FONTS.find((f) => f.id === id) ?? FONTS[0];
}

// ---------------------------------------------------------------------------
// Section labels
// ---------------------------------------------------------------------------

export const BUILTIN_SECTIONS: BuiltinSectionKey[] = [
  'profile',
  'skills',
  'languages',
  'studentLife',
  'experience',
  'education',
  'certifications',
];

const LABELS: Record<Lang, Record<BuiltinSectionKey, string>> = {
  en: {
    profile: 'Profile',
    skills: 'Skills',
    languages: 'Languages',
    studentLife: 'Student Life',
    experience: 'Experience & Projects',
    education: 'Education',
    certifications: 'Certifications',
  },
  fr: {
    profile: 'Profil',
    skills: 'Compétences',
    languages: 'Langues',
    studentLife: 'Vie Associative',
    experience: 'Expériences & Projets',
    education: 'Formation',
    certifications: 'Certifications',
  },
};

/** North-American résumé conventions use slightly different headings. */
const CANADIAN_LABELS: Record<Lang, Partial<Record<BuiltinSectionKey, string>>> = {
  en: {
    profile: 'Professional Summary',
    skills: 'Technical Skills',
    studentLife: 'Leadership & Community Involvement',
  },
  fr: {
    profile: 'Profil Professionnel',
    skills: 'Compétences Techniques',
    studentLife: 'Leadership & Vie Associative',
  },
};

export function defaultSectionLabel(key: BuiltinSectionKey, lang: Lang, region: Region): string {
  if (region === 'CA') return CANADIAN_LABELS[lang][key] ?? LABELS[lang][key];
  return LABELS[lang][key];
}

/** Small UI strings the LaTeX output needs in each language. */
export const DOC_STRINGS: Record<Lang, { page: string; of: string; tech: string }> = {
  en: { page: 'Page', of: 'of', tech: 'Tech Stack' },
  fr: { page: 'Page', of: 'sur', tech: 'Stack Technique' },
};

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export interface TemplateSection {
  key: BuiltinSectionKey;
  column: 'main' | 'sidebar';
  visible?: boolean;
  detail?: DetailMode;
}

export interface TemplateDef {
  id: string;
  name: string;
  description: string;
  region: Region;
  defaultLanguage: Lang;
  theme: ThemeId;
  layout: LayoutConfig;
  typography: TypographyConfig;
  colors: ColorConfig;
  sections: TemplateSection[];
}

const NAVY: ColorConfig = {
  primary: '#0F3C73',
  secondary: '#3C3C3C',
  accent: '#006EBE',
  text: '#3C3C3C',
  sidebarBg: '#EEF3F9',
  sidebarText: '#2B2B2B',
  heading: '#0F3C73',
  headerBg: '#0F3C73',
  headerText: '#FFFFFF',
};

const baseLayout: LayoutConfig = {
  columns: 1,
  sidebarPosition: 'left',
  sidebarWidth: 0.32,
  sidebarFilled: false,
  columnDivider: false,
  headerStyle: 'centered',
  sectionSpacing: 12,
  entrySpacing: 7,
  margins: { top: 1.9, bottom: 1.9, left: 1.9, right: 1.9 },
  pageNumbering: 'none',
  showPhoto: false,
  photoShape: 'circle',
  photoSize: 3,
  paper: 'letter',
};

const baseType: TypographyConfig = {
  fontFamily: 'lmsans',
  headingFontFamily: '',
  fontSize: 10,
  headingSize: 13,
  nameSize: 26,
  alignment: 'left',
  lineSpacing: 1.05,
  bodyWeight: 'regular',
  boldWeight: 'bold',
  headingBold: true,
  headingUppercase: true,
};

const singleColumnSections = (detail: DetailMode): TemplateSection[] => [
  { key: 'profile', column: 'main' },
  { key: 'skills', column: 'main' },
  { key: 'languages', column: 'main' },
  { key: 'experience', column: 'main', detail },
  { key: 'studentLife', column: 'main', detail: 'bullets' },
  { key: 'education', column: 'main' },
  { key: 'certifications', column: 'main' },
];

const splitSections: TemplateSection[] = [
  { key: 'skills', column: 'sidebar' },
  { key: 'languages', column: 'sidebar' },
  { key: 'studentLife', column: 'sidebar', detail: 'bullets' },
  { key: 'profile', column: 'main' },
  { key: 'experience', column: 'main', detail: 'description' },
  { key: 'education', column: 'main' },
  { key: 'certifications', column: 'main' },
];

function tpl(def: Omit<TemplateDef, 'layout' | 'typography' | 'colors'> & {
  layout?: Partial<LayoutConfig>;
  typography?: Partial<TypographyConfig>;
  colors?: Partial<ColorConfig>;
}): TemplateDef {
  return {
    ...def,
    layout: { ...baseLayout, ...def.layout, margins: { ...baseLayout.margins, ...def.layout?.margins } },
    typography: { ...baseType, ...def.typography },
    colors: { ...NAVY, ...def.colors },
  };
}

export const TEMPLATES: TemplateDef[] = [
  tpl({
    id: 'canadian-standard',
    name: 'Canadian Standard',
    description: 'ATS-friendly single column, centered header, no photo, Letter paper.',
    region: 'CA',
    defaultLanguage: 'en',
    theme: 'classic',
    sections: singleColumnSections('bullets'),
  }),
  tpl({
    id: 'canadian-modern',
    name: 'Canadian Modern',
    description: 'Single column with a colored banner header and accent tech lines. No photo.',
    region: 'CA',
    defaultLanguage: 'en',
    theme: 'modern',
    layout: { headerStyle: 'banner', margins: { top: 1.6, bottom: 1.6, left: 1.8, right: 1.8 } },
    typography: { fontFamily: 'sourcesans', fontSize: 10.5 },
    sections: singleColumnSections('both'),
  }),
  tpl({
    id: 'canadian-split',
    name: 'Canadian Split',
    description: 'Two columns with a filled sidebar for skills and languages. No photo.',
    region: 'CA',
    defaultLanguage: 'en',
    theme: 'modern',
    layout: { columns: 2, sidebarFilled: true, headerStyle: 'banner', margins: { top: 1.3, bottom: 1.3, left: 1.3, right: 1.3 } },
    typography: { fontFamily: 'sourcesans' },
    sections: splitSections,
  }),
  tpl({
    id: 'canadian-split-photo',
    name: 'Canadian Split + Photo',
    description: 'Two columns, banner header with a circular profile picture.',
    region: 'CA',
    defaultLanguage: 'en',
    theme: 'modern',
    layout: { columns: 2, columnDivider: true, headerStyle: 'banner', showPhoto: true, margins: { top: 1.27, bottom: 1.27, left: 1.27, right: 1.27 } },
    sections: splitSections,
  }),
  tpl({
    id: 'french-classic',
    name: 'French Classic',
    description: 'Traditional French CV: A4, serif type, header with photo on the right.',
    region: 'FR',
    defaultLanguage: 'fr',
    theme: 'classic',
    layout: { headerStyle: 'left', showPhoto: true, photoShape: 'rounded', photoSize: 2.8, paper: 'a4', margins: { top: 1.6, bottom: 1.6, left: 1.8, right: 1.8 } },
    typography: { fontFamily: 'libertinus', fontSize: 10.5, alignment: 'justify', headingUppercase: false },
    colors: { primary: '#7A1F2B', accent: '#7A1F2B', heading: '#7A1F2B', headerBg: '#7A1F2B' },
    sections: singleColumnSections('description'),
  }),
  tpl({
    id: 'french-modern',
    name: 'French Modern',
    description: 'A4 single column with a full-width banner and circular photo.',
    region: 'FR',
    defaultLanguage: 'fr',
    theme: 'modern',
    layout: { headerStyle: 'banner', showPhoto: true, paper: 'a4', photoSize: 2.6, margins: { top: 1.4, bottom: 1.4, left: 1.6, right: 1.6 } },
    typography: { fontFamily: 'lato' },
    colors: { primary: '#1D4E5F', accent: '#2A9D8F', heading: '#1D4E5F', headerBg: '#1D4E5F' },
    sections: singleColumnSections('description'),
  }),
  tpl({
    id: 'french-split',
    name: 'French Split',
    description: 'A4 two columns: name and contacts at the top of a full-height colored sidebar.',
    region: 'FR',
    defaultLanguage: 'fr',
    theme: 'modern',
    layout: { columns: 2, sidebarFilled: true, headerStyle: 'sidebar', paper: 'a4', sidebarWidth: 0.33, margins: { top: 1.3, bottom: 1.3, left: 1.2, right: 1.4 } },
    typography: { fontFamily: 'fira', bodyWeight: 'light', boldWeight: 'semibold', nameSize: 22 },
    colors: { sidebarBg: '#0F3C73', sidebarText: '#FFFFFF' },
    sections: splitSections,
  }),
  tpl({
    id: 'french-split-photo',
    name: 'French Split + Photo',
    description: 'A4 two columns with a banner header, circular photo and column divider.',
    region: 'FR',
    defaultLanguage: 'fr',
    theme: 'modern',
    layout: { columns: 2, columnDivider: true, headerStyle: 'banner', showPhoto: true, paper: 'a4', margins: { top: 1.27, bottom: 1.27, left: 1.27, right: 1.27 } },
    sections: splitSections,
  }),
  tpl({
    id: 'academic',
    name: 'Academic',
    description: 'Serif, education first, understated headings with rules. Suited to research applications.',
    region: 'INTL',
    defaultLanguage: 'en',
    theme: 'academic',
    layout: { paper: 'a4', margins: { top: 2.2, bottom: 2.2, left: 2.2, right: 2.2 }, pageNumbering: 'of-total' },
    typography: { fontFamily: 'pagella', fontSize: 11, headingSize: 12, nameSize: 22, alignment: 'justify', headingUppercase: false },
    colors: { primary: '#222222', accent: '#1F4E79', heading: '#222222', headerBg: '#222222' },
    sections: [
      { key: 'education', column: 'main' },
      { key: 'profile', column: 'main' },
      { key: 'experience', column: 'main', detail: 'both' },
      { key: 'certifications', column: 'main' },
      { key: 'skills', column: 'main' },
      { key: 'languages', column: 'main' },
      { key: 'studentLife', column: 'main', detail: 'bullets' },
    ],
  }),
  tpl({
    id: 'compact',
    name: 'Compact',
    description: 'Dense one-page layout: small type, tight margins, inline dates.',
    region: 'INTL',
    defaultLanguage: 'en',
    theme: 'compact',
    layout: { headerStyle: 'left', sectionSpacing: 7, entrySpacing: 3, paper: 'a4', margins: { top: 1.1, bottom: 1.1, left: 1.3, right: 1.3 } },
    typography: { fontFamily: 'plex', fontSize: 9, headingSize: 10.5, nameSize: 20, lineSpacing: 1 },
    colors: { primary: '#14532D', accent: '#15803D', heading: '#14532D', headerBg: '#14532D' },
    sections: singleColumnSections('bullets'),
  }),
  tpl({
    id: 'custom',
    name: 'Custom',
    description: 'A neutral starting point. Every layout, typography and color option is yours to set.',
    region: 'INTL',
    defaultLanguage: 'en',
    theme: 'modern',
    layout: { paper: 'a4' },
    typography: { fontFamily: 'heros' },
    colors: { primary: '#333333', accent: '#555555', heading: '#222222', headerBg: '#333333', sidebarBg: '#F2F2F2' },
    sections: singleColumnSections('both'),
  }),
];

export const THEMES: { id: ThemeId; label: string; description: string }[] = [
  { id: 'classic', label: 'Classic', description: 'Bold titles, dates on the right, underlined section headings.' },
  { id: 'modern', label: 'Modern', description: 'Accent-colored tech line with icons, thin heading rules.' },
  { id: 'academic', label: 'Academic', description: 'Small caps headings, italic institutions, restrained color.' },
  { id: 'compact', label: 'Compact', description: 'Single-line entries and tight spacing.' },
];

export function getTemplate(id: string): TemplateDef {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[TEMPLATES.length - 1];
}

const emptyTitle = () => ({ en: '', fr: '' });

export function templateSections(t: TemplateDef, customSectionIds: string[]): SectionConfig[] {
  const sections: SectionConfig[] = t.sections.map((s) => ({
    key: s.key,
    visible: s.visible ?? true,
    column: s.column,
    title: emptyTitle(),
    itemIds: null,
    detail: s.detail ?? 'both',
    hiddenSubItems: [],
  }));
  for (const id of customSectionIds) {
    sections.push({ key: `custom:${id}`, visible: true, column: 'main', title: emptyTitle(), itemIds: null, detail: 'both', hiddenSubItems: [] });
  }
  return sections;
}

/**
 * Apply a template to an existing CV: visual settings come from the template,
 * while content choices (visibility, item selection, title overrides) are kept.
 */
export function applyTemplate(cv: CVConfig, t: TemplateDef): CVConfig {
  const byKey = new Map(cv.sections.map((s) => [s.key, s]));
  const ordered: SectionConfig[] = [];
  for (const ts of t.sections) {
    const prev = byKey.get(ts.key);
    ordered.push({
      key: ts.key,
      visible: prev?.visible ?? true,
      column: ts.column,
      title: prev?.title ?? emptyTitle(),
      itemIds: prev?.itemIds ?? null,
      detail: ts.detail ?? prev?.detail ?? 'both',
      hiddenSubItems: prev?.hiddenSubItems ?? [],
    });
    byKey.delete(ts.key);
  }
  // Custom sections and anything the template does not know about keep their place at the end.
  for (const rest of byKey.values()) ordered.push({ ...rest, column: t.layout.columns === 1 ? 'main' : rest.column });
  return {
    ...cv,
    templateId: t.id,
    region: t.region,
    theme: t.theme,
    sections: ordered,
    layout: structuredClone(t.layout),
    typography: structuredClone(t.typography),
    colors: structuredClone(t.colors),
  };
}

// ---------------------------------------------------------------------------
// Formats: one CV, several templates, each remembering its own design
// ---------------------------------------------------------------------------

export function currentDesign(cv: CVConfig): FormatDesign {
  const { region, theme, sections, layout, typography, colors } = cv;
  return structuredClone({ region, theme, sections, layout, typography, colors });
}

/**
 * Make `templateId` the active format. The current format's design is stored;
 * the target's saved design is restored, or created from the template while
 * keeping the current content choices (visible sections, selected items, titles).
 */
export function switchFormat(cv: CVConfig, templateId: string): CVConfig {
  if (templateId === cv.templateId) return cv;
  const t = getTemplate(templateId);
  const designs = { ...cv.designs, [cv.templateId]: currentDesign(cv) };
  const saved = designs[t.id];
  delete designs[t.id];
  const base: CVConfig = saved
    ? { ...cv, ...structuredClone(saved), templateId: t.id }
    : applyTemplate(cv, t);
  return {
    ...base,
    designs,
    formats: cv.formats.includes(t.id) ? cv.formats : [...cv.formats, t.id],
  };
}

/** The configuration a given format + language combination would compile. */
export function variantConfig(cv: CVConfig, templateId: string, language: Lang): CVConfig {
  return { ...switchFormat(structuredClone(cv), templateId), language };
}

export function sectionLabel(cv: Pick<CVConfig, 'language' | 'region'>, s: SectionConfig, customTitle?: string): string {
  const override = s.title[cv.language]?.trim();
  if (override) return override;
  if (s.key.startsWith('custom:')) return customTitle ?? 'Custom';
  return defaultSectionLabel(s.key as BuiltinSectionKey, cv.language, cv.region);
}

export function isCustomKey(key: SectionKey): key is `custom:${string}` {
  return key.startsWith('custom:');
}
