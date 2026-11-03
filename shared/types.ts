// Data model shared by the editor (client) and the LaTeX engine (server).
// The profile is the single bilingual source of truth; each CV only stores
// configuration (what to show and how), never personal content.

export type Lang = 'en' | 'fr';
export type Localized = { en: string; fr: string };

// ---------------------------------------------------------------------------
// Bilingual profile database
// ---------------------------------------------------------------------------

export type LinkKind = 'linkedin' | 'github' | 'website' | 'portfolio' | 'other';

export interface ProfileLink {
  id: string;
  kind: LinkKind;
  url: string;
  label: Localized;
}

export interface PersonalInfo {
  firstName: string;
  lastName: string;
  headline: Localized;
  email: string;
  phone: string;
  location: Localized;
  links: ProfileLink[];
  /** Asset id of the profile picture, or null. */
  photo: string | null;
}

export interface SkillGroup {
  id: string;
  category: Localized;
  /** Individual skills; each CV/format can hide any of them. */
  skills: TextItem[];
}

export interface LanguageItem {
  id: string;
  name: Localized;
  level: Localized;
}

export interface TextItem {
  id: string;
  text: Localized;
}

export interface StudentLifeGroup {
  id: string;
  title: Localized;
  /** Optional role / subtitle shown when rendered as a full entry. */
  subtitle: Localized;
  date: Localized;
  /** 'bullets' renders items as a bulleted list, 'lines' as plain lines. */
  style: 'bullets' | 'lines';
  items: TextItem[];
}

export type ExperienceKind = 'work' | 'internship' | 'project' | 'academic' | 'volunteer';

export interface ExperienceItem {
  id: string;
  kind: ExperienceKind;
  title: Localized;
  organization: Localized;
  location: Localized;
  date: Localized;
  tech: string;
  description: Localized;
  bullets: TextItem[];
}

export interface EducationItem {
  id: string;
  institution: Localized;
  degree: Localized;
  location: Localized;
  date: Localized;
  details: Localized;
}

export interface CertificationItem {
  id: string;
  name: Localized;
  issuer: Localized;
  date: Localized;
}

export interface CustomEntry {
  id: string;
  title: Localized;
  subtitle: Localized;
  date: Localized;
  description: Localized;
}

export interface CustomSection {
  id: string;
  title: Localized;
  entries: CustomEntry[];
}

export interface Profile {
  personal: PersonalInfo;
  summary: Localized;
  skills: SkillGroup[];
  languages: LanguageItem[];
  studentLife: StudentLifeGroup[];
  experience: ExperienceItem[];
  education: EducationItem[];
  certifications: CertificationItem[];
  customSections: CustomSection[];
}

// ---------------------------------------------------------------------------
// Per-CV configuration
// ---------------------------------------------------------------------------

export type BuiltinSectionKey =
  | 'profile'
  | 'skills'
  | 'languages'
  | 'studentLife'
  | 'experience'
  | 'education'
  | 'certifications';

/** Built-in key, or `custom:<customSectionId>`. */
export type SectionKey = BuiltinSectionKey | `custom:${string}`;

export type DetailMode = 'description' | 'bullets' | 'both';

export interface SectionConfig {
  key: SectionKey;
  visible: boolean;
  column: 'main' | 'sidebar';
  /** Per-language title override; empty string = default label. */
  title: Localized;
  /** Ids of profile items included in this CV; null = include everything. */
  itemIds: string[] | null;
  /** How experience / student-life entries show their details. */
  detail: DetailMode;
  /** Sub-items hidden in this CV: individual skills, bullet points, student-life lines. */
  hiddenSubItems: string[];
}

export type ThemeId = 'classic' | 'modern' | 'academic' | 'compact';
export type HeaderStyle = 'banner' | 'left' | 'centered' | 'sidebar' | 'main';
export type PhotoShape = 'circle' | 'rounded' | 'square';
export type PageNumbering = 'none' | 'simple' | 'of-total';
export type PaperSize = 'a4' | 'letter';
export type Region = 'CA' | 'FR' | 'INTL';

export interface LayoutConfig {
  columns: 1 | 2;
  sidebarPosition: 'left' | 'right';
  /** Sidebar share of the text width, 0.2 – 0.45. */
  sidebarWidth: number;
  sidebarFilled: boolean;
  columnDivider: boolean;
  headerStyle: HeaderStyle;
  /** Vertical space before each section heading, in pt. */
  sectionSpacing: number;
  /** Vertical space between entries, in pt. */
  entrySpacing: number;
  margins: { top: number; bottom: number; left: number; right: number }; // cm
  pageNumbering: PageNumbering;
  showPhoto: boolean;
  photoShape: PhotoShape;
  /** Photo diameter / side, in cm. */
  photoSize: number;
  paper: PaperSize;
}

export type BodyWeight = 'light' | 'regular';
export type BoldWeight = 'semibold' | 'bold';

export interface TypographyConfig {
  fontFamily: string;
  headingFontFamily: string; // '' = same as body
  fontSize: number; // pt
  headingSize: number; // pt
  nameSize: number; // pt
  alignment: 'left' | 'justify';
  lineSpacing: number;
  bodyWeight: BodyWeight;
  boldWeight: BoldWeight;
  headingBold: boolean;
  headingUppercase: boolean;
}

export interface ColorConfig {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  sidebarBg: string;
  sidebarText: string;
  heading: string;
  headerBg: string;
  headerText: string;
}

/** Everything that belongs to one format (template) of a CV. */
export interface FormatDesign {
  region: Region;
  theme: ThemeId;
  sections: SectionConfig[];
  layout: LayoutConfig;
  typography: TypographyConfig;
  colors: ColorConfig;
}

export interface CVConfig {
  id: string;
  name: string;
  language: Lang;
  /** The active format; its design lives in the top-level fields below. */
  region: Region;
  templateId: string;
  theme: ThemeId;
  sections: SectionConfig[];
  layout: LayoutConfig;
  typography: TypographyConfig;
  colors: ColorConfig;
  /** Formats offered in the quick switcher (template ids), in display order. */
  formats: string[];
  /** Saved designs of the inactive formats, by template id. */
  designs: Record<string, FormatDesign>;
  advanced: {
    /** Raw LaTeX appended to the preamble (custom_preamble.tex). */
    extraPreamble: string;
  };
  /** Last successful build shown in the preview; survives reloads and failed builds. */
  lastSuccessfulBuildId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CVSummary = Pick<
  CVConfig,
  'id' | 'name' | 'language' | 'region' | 'templateId' | 'formats' | 'updatedAt' | 'lastSuccessfulBuildId'
>;

// ---------------------------------------------------------------------------
// Generation / compilation results
// ---------------------------------------------------------------------------

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface SourceResult {
  sourceHash: string;
  mainFile: string;
  files: GeneratedFile[];
  assets: string[];
}

export interface LatexIssue {
  severity: 'error' | 'warning';
  file: string | null;
  line: number | null;
  message: string;
  context?: string;
}

export interface BuildResult {
  buildId: string;
  cvId: string;
  sourceHash: string;
  status: 'success' | 'error';
  cached: boolean;
  pageCount: number | null;
  durationMs: number;
  passes: number;
  errors: LatexIssue[];
  warnings: LatexIssue[];
  createdAt: string;
  /** Short human-readable failure reason (timeout, missing compiler, ...). */
  failureReason?: string;
  /** The format and language this build was made for. */
  templateId?: string;
  language?: Lang;
}
