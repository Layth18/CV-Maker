import { getTemplate, templateSections } from './catalog';
import type { CVConfig, Lang, Profile } from './types';

export function createCVConfig(opts: {
  id: string;
  name: string;
  templateId: string;
  language?: Lang;
  profile: Pick<Profile, 'customSections'>;
  now?: string;
}): CVConfig {
  const t = getTemplate(opts.templateId);
  const now = opts.now ?? new Date().toISOString();
  return {
    id: opts.id,
    name: opts.name,
    language: opts.language ?? t.defaultLanguage,
    region: t.region,
    templateId: t.id,
    theme: t.theme,
    sections: templateSections(t, opts.profile.customSections.map((c) => c.id)),
    layout: structuredClone(t.layout),
    typography: structuredClone(t.typography),
    colors: structuredClone(t.colors),
    formats: [t.id],
    designs: {},
    advanced: { extraPreamble: '' },
    lastSuccessfulBuildId: null,
    createdAt: now,
    updatedAt: now,
  };
}
