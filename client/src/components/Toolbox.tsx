import { defaultSectionLabel, isCustomKey } from '../../../shared/catalog';
import type { BuiltinSectionKey, DetailMode } from '../../../shared/types';
import { useEditor } from '../store';
import { Icon } from './Icon';
import { SectionContent } from './panels/ContentPanel';
import { ColorsPanel, LayoutPanel, TypographyPanel } from './panels/DesignPanels';
import { LanguagePanel } from './panels/LanguagePanel';
import { TemplatePanel } from './panels/TemplatePanel';
import { DESIGN_TOOLS, displayLabel, iconFor, itemCounts } from './sectionMeta';
import { Field, Segmented, Select, TextInput, Toggle } from './ui';

const DESIGN_DESCRIPTIONS: Record<string, string> = {
  'design:format': 'Formats this CV can switch between, and the template behind each one.',
  'design:layout': 'Page size, columns, header placement, spacing and photo.',
  'design:typography': 'Fonts, sizes, weights and alignment.',
  'design:colors': 'Palette for name, headings, banner and sidebar.',
  'design:settings': 'CV name, language, regional style and advanced LaTeX.',
};

/** Shows exactly one toolbox: the selected section's, or a design tool's. */
export function Toolbox() {
  const cv = useEditor((s) => s.cv)!;
  const profile = useEditor((s) => s.profile)!;
  const selected = useEditor((s) => s.selected);
  const updateCV = useEditor((s) => s.updateCV);

  const design = DESIGN_TOOLS.find((d) => d.id === selected);
  if (design) {
    return (
      <div className="toolbox" key={selected}>
        <header className="tb-head">
          <span className="tb-icon"><Icon name={design.icon} size={18} /></span>
          <div>
            <h2>{design.label}</h2>
            <p>{DESIGN_DESCRIPTIONS[design.id]}</p>
          </div>
        </header>
        <div className="tb-body">
          {design.id === 'design:format' && <TemplatePanel />}
          {design.id === 'design:layout' && <LayoutPanel />}
          {design.id === 'design:typography' && <TypographyPanel />}
          {design.id === 'design:colors' && <ColorsPanel />}
          {design.id === 'design:settings' && <LanguagePanel />}
        </div>
      </div>
    );
  }

  const index = cv.sections.findIndex((s) => s.key === selected);
  const section = index >= 0 ? cv.sections[index] : null;
  const key = section ? section.key : 'personal';
  const lang = cv.language;
  const set = (fn: (s: typeof cv.sections[number]) => void) => updateCV((c) => fn(c.sections[index]));
  const counts = section ? itemCounts(cv, profile, section) : null;
  const defaultTitle = section
    ? isCustomKey(section.key)
      ? displayLabel(cv, { ...profile }, { ...section, title: { en: '', fr: '' } })
      : defaultSectionLabel(section.key as BuiltinSectionKey, lang, cv.region)
    : '';

  return (
    <div className="toolbox" key={key}>
      <header className="tb-head">
        <span className="tb-icon"><Icon name={iconFor(key)} size={18} /></span>
        <div>
          <h2>{section ? displayLabel(cv, profile, section) : 'Header & contact'}</h2>
          <p>
            {section
              ? `${counts ? `${counts.shown} of ${counts.total} entries shown · ` : ''}${cv.layout.columns === 2 ? (section.column === 'sidebar' ? 'Sidebar' : 'Main column') : 'Single column'}`
              : 'Name, headline, contact details and photo — shared by every CV.'}
          </p>
        </div>
      </header>

      <div className="tb-body">
        {section && (
          <section className="tb-card section-settings">
            <div className="tb-card-title">Section settings <span className="muted">· this CV only</span></div>
            <Toggle label="Show this section" checked={section.visible} onChange={(v) => set((s) => (s.visible = v))} />
            <Field label={`Heading (${lang.toUpperCase()})`} hint="Leave empty to use the default heading.">
              <TextInput value={section.title[lang]} placeholder={defaultTitle} onChange={(v) => set((s) => (s.title[lang] = v))} />
            </Field>
            <div className="row settings-row">
              {cv.layout.columns === 2 && (
                <Field label="Column">
                  <Segmented
                    value={section.column}
                    options={[{ value: 'sidebar', label: 'Sidebar' }, { value: 'main', label: 'Main' }]}
                    onChange={(v) => set((s) => (s.column = v))}
                  />
                </Field>
              )}
              {(section.key === 'experience' || section.key === 'studentLife') && (
                <Field label="Entry details">
                  <Select<DetailMode>
                    value={section.detail}
                    options={[
                      { value: 'description', label: 'Description' },
                      { value: 'bullets', label: 'Bullet points' },
                      { value: 'both', label: 'Description + bullets' },
                    ]}
                    onChange={(v) => set((s) => (s.detail = v))}
                  />
                </Field>
              )}
            </div>
          </section>
        )}

        <section className="tb-content">
          {section && (
            <div className="tb-card-title">
              Content <span className="muted">· shared database, tick to show in this CV</span>
            </div>
          )}
          <SectionContent sectionKey={key} />
        </section>
      </div>
    </div>
  );
}
