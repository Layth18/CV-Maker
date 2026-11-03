import { isCustomKey, sectionLabel } from '../../../shared/catalog';
import type { CVConfig, Profile, SectionConfig } from '../../../shared/types';

/** Icon per section or design toolbox. */
export const SECTION_ICON: Record<string, string> = {
  personal: 'user',
  profile: 'text',
  skills: 'zap',
  languages: 'globe',
  studentLife: 'users',
  experience: 'briefcase',
  education: 'cap',
  certifications: 'award',
};

export const DESIGN_TOOLS = [
  { id: 'design:format', icon: 'template', label: 'Formats & templates' },
  { id: 'design:layout', icon: 'columns', label: 'Layout' },
  { id: 'design:typography', icon: 'type', label: 'Typography' },
  { id: 'design:colors', icon: 'palette', label: 'Colors' },
  { id: 'design:settings', icon: 'sliders', label: 'Language & settings' },
] as const;

export const iconFor = (key: string) => (isCustomKey(key as SectionConfig['key']) ? 'layers' : SECTION_ICON[key] ?? 'file');

/** The heading text this section has in the PDF, in the CV language. */
export function displayLabel(cv: CVConfig, profile: Profile, s: SectionConfig): string {
  const custom = isCustomKey(s.key) ? profile.customSections.find((c) => `custom:${c.id}` === s.key) : undefined;
  const customTitle = custom ? custom.title[cv.language] || custom.title.en || custom.title.fr : undefined;
  return sectionLabel(cv, s, customTitle);
}

/** Items in a section and how many of them this CV shows. */
export function itemCounts(cv: CVConfig, profile: Profile, s: SectionConfig): { shown: number; total: number } | null {
  const list =
    s.key === 'skills' ? profile.skills
    : s.key === 'languages' ? profile.languages
    : s.key === 'studentLife' ? profile.studentLife
    : s.key === 'experience' ? profile.experience
    : s.key === 'education' ? profile.education
    : s.key === 'certifications' ? profile.certifications
    : isCustomKey(s.key) ? profile.customSections.find((c) => `custom:${c.id}` === s.key)?.entries
    : null;
  if (!list) return null;
  const shown = s.itemIds === null ? list.length : list.filter((i) => s.itemIds!.includes(i.id)).length;
  return { shown, total: list.length };
}
