import { useRef, useState, type ReactNode } from 'react';
import type {
  CertificationItem,
  CustomEntry,
  CVConfig,
  EducationItem,
  ExperienceItem,
  LanguageItem,
  Lang,
  LinkKind,
  Localized,
  Profile,
  SectionKey,
  SkillGroup,
  StudentLifeGroup,
  TextItem,
} from '../../../../shared/types';
import { api, preparePhoto, urls } from '../../api';
import { uid, useEditor } from '../../store';
import { Icon } from '../Icon';
import { Field, IconButton, LocalizedField, move, Select, TextInput } from '../ui';

const L = (): Localized => ({ en: '', fr: '' });
const FORMAT_HINT = 'Supports **bold** and *italic*.';

// --- per-CV inclusion helpers -------------------------------------------------

function included(cv: CVConfig, key: SectionKey, id: string): boolean {
  const s = cv.sections.find((x) => x.key === key);
  return !s || s.itemIds === null || s.itemIds.includes(id);
}

function setIncluded(cv: CVConfig, key: SectionKey, id: string, allIds: string[], on: boolean) {
  const s = cv.sections.find((x) => x.key === key);
  if (!s) return;
  let ids = s.itemIds ?? [...allIds];
  ids = on ? [...new Set([...ids, id])] : ids.filter((x) => x !== id);
  s.itemIds = allIds.every((x) => ids.includes(x)) ? null : ids.filter((x) => allIds.includes(x));
}

function text(l: Localized, lang: Lang): string {
  return l[lang] || l[lang === 'en' ? 'fr' : 'en'] || '';
}

// --- generic list of profile items ----------------------------------------------

type ListKey = 'skills' | 'languages' | 'studentLife' | 'experience' | 'education' | 'certifications';

function ItemList<T extends { id: string }>({
  listKey,
  sectionKey,
  items,
  title,
  subtitle,
  create,
  renderEditor,
  getItems,
}: {
  listKey: ListKey | null;
  sectionKey: SectionKey;
  items: T[];
  title: (item: T) => string;
  subtitle?: (item: T) => string;
  create: () => T;
  renderEditor: (item: T, update: (fn: (item: T) => void) => void) => ReactNode;
  /** Locate the mutable array inside a profile draft. */
  getItems: (p: Profile) => T[];
}) {
  const cv = useEditor((s) => s.cv)!;
  const updateCV = useEditor((s) => s.updateCV);
  const updateProfile = useEditor((s) => s.updateProfile);
  const [open, setOpen] = useState<string | null>(null);
  const allIds = items.map((i) => i.id);
  const count = items.filter((i) => included(cv, sectionKey, i.id)).length;

  const update = (id: string) => (fn: (item: T) => void) =>
    updateProfile((p) => {
      const item = getItems(p).find((x) => x.id === id);
      if (item) fn(item);
    });

  return (
    <div className="item-list">
      <div className="item-list-meta muted">
        {count} of {items.length} shown in this CV
      </div>
      {items.map((item, idx) => {
        const on = included(cv, sectionKey, item.id);
        const isOpen = open === item.id;
        return (
          <div key={item.id} className={`item-card${on ? '' : ' excluded'}${isOpen ? ' open' : ''}`}>
            <div className="item-head">
              <input
                type="checkbox"
                className="check"
                checked={on}
                title={on ? 'Shown in this CV — click to hide' : 'Hidden in this CV — click to show'}
                aria-label={`Show "${title(item) || 'item'}" in this CV`}
                onChange={(e) => updateCV((c) => setIncluded(c, sectionKey, item.id, allIds, e.target.checked))}
              />
              <button type="button" className="item-title" onClick={() => setOpen(isOpen ? null : item.id)} aria-expanded={isOpen}>
                <span className="item-title-main">{title(item) || <em className="muted">Untitled</em>}</span>
                {subtitle && <span className="item-title-sub">{subtitle(item)}</span>}
              </button>
              <div className="item-actions">
                <IconButton icon="arrowUp" label="Move up" disabled={idx === 0} onClick={() => updateProfile((p) => move(getItems(p), idx, idx - 1))} />
                <IconButton icon="arrowDown" label="Move down" disabled={idx === items.length - 1} onClick={() => updateProfile((p) => move(getItems(p), idx, idx + 1))} />
                <IconButton
                  icon="trash"
                  label="Delete from the database"
                  danger
                  onClick={() => {
                    if (!confirm(`Delete "${title(item) || 'this item'}" from your profile database? It will disappear from every CV.`)) return;
                    updateProfile((p) => {
                      const arr = getItems(p);
                      arr.splice(arr.findIndex((x) => x.id === item.id), 1);
                    });
                  }}
                />
                <IconButton icon={isOpen ? 'chevron-up' : 'chevron-down'} label={isOpen ? 'Collapse' : 'Edit'} onClick={() => setOpen(isOpen ? null : item.id)} />
              </div>
            </div>
            {isOpen && <div className="item-body">{renderEditor(item, update(item.id))}</div>}
          </div>
        );
      })}
      <button
        type="button"
        className="add-btn"
        onClick={() => {
          const item = create();
          updateProfile((p) => getItems(p).push(item));
          // New items appear in the CV being edited.
          updateCV((c) => {
            const s = c.sections.find((x) => x.key === sectionKey);
            if (s?.itemIds) s.itemIds.push(item.id);
          });
          setOpen(item.id);
        }}
      >
        <Icon name="plus" /> Add
      </button>
    </div>
  );
}

/**
 * A list of sub-items (skills, bullet points, lines). Text is shared by every CV;
 * the checkbox shows or hides the item in this CV and format only.
 */
function TextItems({
  items,
  lang,
  onChange,
  label,
  sectionKey,
  addLabel = 'Add line',
  multiline = true,
  quickAdd,
}: {
  items: TextItem[];
  lang: Lang;
  onChange: (fn: (items: TextItem[]) => void) => void;
  label: string;
  sectionKey: SectionKey;
  addLabel?: string;
  multiline?: boolean;
  /** Placeholder for a one-line "type and press Enter" box (same text in both languages). */
  quickAdd?: string;
}) {
  const hidden = useEditor((s) => s.cv?.sections.find((x) => x.key === sectionKey)?.hiddenSubItems ?? []);
  const updateCV = useEditor((s) => s.updateCV);
  const [draft, setDraft] = useState('');
  const toggle = (id: string, show: boolean) =>
    updateCV((c) => {
      const sec = c.sections.find((x) => x.key === sectionKey);
      if (sec) sec.hiddenSubItems = show ? sec.hiddenSubItems.filter((x) => x !== id) : [...new Set([...sec.hiddenSubItems, id])];
    });
  const shownCount = items.filter((b) => !hidden.includes(b.id)).length;

  return (
    <div className="field">
      <span className="field-label">
        {label}
        {items.length > 0 && <span className="field-hint">{shownCount} of {items.length} shown in this CV</span>}
      </span>
      <div className="text-items">
        {items.map((b, i) => {
          const on = !hidden.includes(b.id);
          return (
            <div key={b.id} className={`text-item${on ? '' : ' off'}${multiline ? '' : ' compact'}`}>
              <input
                type="checkbox"
                className="check"
                checked={on}
                title={on ? 'Shown in this CV — click to hide' : 'Hidden in this CV — click to show'}
                aria-label={`Show ${label.toLowerCase()} ${i + 1} in this CV`}
                onChange={(e) => toggle(b.id, e.target.checked)}
              />
              <LocalizedField label={`${label} ${i + 1}`} value={b.text} lang={lang} multiline={multiline} rows={2} onChange={(v) => onChange((arr) => (arr[i].text = v))} />
              <div className="text-item-actions">
                <IconButton icon="arrowUp" label="Move up" disabled={i === 0} onClick={() => onChange((arr) => move(arr, i, i - 1))} />
                <IconButton icon="arrowDown" label="Move down" disabled={i === items.length - 1} onClick={() => onChange((arr) => move(arr, i, i + 1))} />
                <IconButton icon="trash" label="Delete from the database" danger onClick={() => onChange((arr) => arr.splice(i, 1))} />
              </div>
            </div>
          );
        })}
        {quickAdd ? (
          <div className="quick-add">
            <Icon name="plus" size={14} />
            <input
              className="input"
              value={draft}
              placeholder={quickAdd}
              aria-label={quickAdd}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || !draft.trim()) return;
                e.preventDefault();
                const text = draft.trim();
                onChange((arr) => arr.push({ id: uid('t'), text: { en: text, fr: text } }));
                setDraft('');
              }}
            />
            <span className="kbd">Enter</span>
          </div>
        ) : (
          <button type="button" className="add-btn small" onClick={() => onChange((arr) => arr.push({ id: uid('t'), text: L() }))}>
            <Icon name="plus" /> {addLabel}
          </button>
        )}
      </div>
    </div>
  );
}

const LINK_KINDS: { value: LinkKind; label: string }[] = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'github', label: 'GitHub' },
  { value: 'website', label: 'Website' },
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'other', label: 'Other' },
];

function PersonalInfo({ profile, lang }: { profile: Profile; lang: Lang }) {
  const updateProfile = useEditor((s) => s.updateProfile);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const p = profile.personal;
  const set = (fn: (pi: Profile['personal']) => void) => updateProfile((d) => fn(d.personal));

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading('Uploading…');
    try {
      const blob = await preparePhoto(file);
      const { id } = await api.uploadImage(blob);
      set((pi) => (pi.photo = id));
      setUploading(null);
    } catch (err) {
      setUploading(`Upload failed: ${(err as Error).message}`);
    }
  };

  return (
    <>
      <div className="photo-row">
        <div className="photo-thumb">{p.photo ? <img src={urls.asset(p.photo)} alt="Profile" /> : <Icon name="image" size={28} />}</div>
        <div className="photo-actions">
          <span className="field-label">Profile picture</span>
          <div className="row">
            <button type="button" className="btn small" onClick={() => fileRef.current?.click()}>
              {p.photo ? 'Replace…' : 'Upload…'}
            </button>
            {p.photo && (
              <button type="button" className="btn small ghost" onClick={() => set((pi) => (pi.photo = null))}>
                Remove
              </button>
            )}
          </div>
          <span className="field-hint">{uploading ?? 'PNG or JPEG. Shown only when the layout enables the photo.'}</span>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        </div>
      </div>
      <div className="grid-2">
        <Field label="First name"><TextInput value={p.firstName} onChange={(v) => set((pi) => (pi.firstName = v))} /></Field>
        <Field label="Last name"><TextInput value={p.lastName} onChange={(v) => set((pi) => (pi.lastName = v))} /></Field>
      </div>
      <LocalizedField label="Headline" value={p.headline} lang={lang} onChange={(v) => set((pi) => (pi.headline = v))} />
      <div className="grid-2">
        <Field label="Email"><TextInput type="email" value={p.email} onChange={(v) => set((pi) => (pi.email = v))} /></Field>
        <Field label="Phone"><TextInput value={p.phone} onChange={(v) => set((pi) => (pi.phone = v))} /></Field>
      </div>
      <LocalizedField label="Location" value={p.location} lang={lang} placeholder={{ en: 'e.g. Montréal, QC', fr: 'ex. Paris, France' }} onChange={(v) => set((pi) => (pi.location = v))} />
      <div className="field">
        <span className="field-label">Links</span>
        {p.links.map((link, i) => (
          <div key={link.id} className="link-card">
            <div className="link-row">
              <Select value={link.kind} options={LINK_KINDS} aria-label="Link type" onChange={(v) => set((pi) => (pi.links[i].kind = v))} />
              <TextInput value={link.url} placeholder="https://…" aria-label="URL" onChange={(v) => set((pi) => (pi.links[i].url = v))} />
              <IconButton icon="arrowUp" label="Move up" disabled={i === 0} onClick={() => set((pi) => move(pi.links, i, i - 1))} />
              <IconButton icon="trash" label="Remove link" danger onClick={() => set((pi) => pi.links.splice(i, 1))} />
            </div>
            <LocalizedField label="Displayed text" value={link.label} lang={lang} placeholder={{ en: 'e.g. LinkedIn Profile', fr: 'ex. Profil LinkedIn' }} onChange={(v) => set((pi) => (pi.links[i].label = v))} />
          </div>
        ))}
        <button type="button" className="add-btn small" onClick={() => set((pi) => pi.links.push({ id: uid('lnk'), kind: 'website', url: '', label: L() }))}>
          <Icon name="plus" /> Add link
        </button>
      </div>
    </>
  );
}

/** The editor for one CV section (or the personal-information header). */
export function SectionContent({ sectionKey }: { sectionKey: string }) {
  const cv = useEditor((s) => s.cv)!;
  const profile = useEditor((s) => s.profile)!;
  const updateProfile = useEditor((s) => s.updateProfile);
  const updateCV = useEditor((s) => s.updateCV);
  const lang = cv.language;
  const t = (l: Localized) => text(l, lang);

  switch (sectionKey) {
    case 'personal':
      return <PersonalInfo profile={profile} lang={lang} />;
    case 'profile':
      return (
        <>
          <LocalizedField label="Summary" value={profile.summary} lang={lang} multiline rows={6} onChange={(v) => updateProfile((p) => (p.summary = v))} />
          <span className="field-hint">{FORMAT_HINT} Leave a blank line between paragraphs.</span>
        </>
      );
    case 'skills':
      return (
        <ItemList<SkillGroup>
          listKey="skills"
          sectionKey="skills"
          items={profile.skills}
          getItems={(p) => p.skills}
          title={(i) => t(i.category)}
          subtitle={(i) => {
            const hidden = cv.sections.find((x) => x.key === 'skills')?.hiddenSubItems ?? [];
            const shownSkills = i.skills.filter((k) => !hidden.includes(k.id));
            return `${shownSkills.map((k) => t(k.text)).join(', ') || 'No skill shown'} · ${shownSkills.length}/${i.skills.length}`;
          }}
          create={() => ({ id: uid('sk'), category: L(), skills: [] })}
          renderEditor={(i, up) => (
            <>
              <LocalizedField label="Category" value={i.category} lang={lang} onChange={(v) => up((x) => (x.category = v))} />
              <TextItems
                label="Skills"
                sectionKey="skills"
                items={i.skills}
                lang={lang}
                multiline={false}
                quickAdd="Add a skill and press Enter"
                onChange={(fn) => up((x) => fn(x.skills))}
              />
              <span className="field-hint">Untick a skill to leave it out of this CV and format; it stays in your database. Translate a skill only if its name differs in French.</span>
            </>
          )}
        />
      );
    case 'languages':
      return (
        <ItemList<LanguageItem>
          listKey="languages"
          sectionKey="languages"
          items={profile.languages}
          getItems={(p) => p.languages}
          title={(i) => t(i.name)}
          subtitle={(i) => t(i.level)}
          create={() => ({ id: uid('lg'), name: L(), level: L() })}
          renderEditor={(i, up) => (
            <>
              <LocalizedField label="Language" value={i.name} lang={lang} onChange={(v) => up((x) => (x.name = v))} />
              <LocalizedField label="Level" value={i.level} lang={lang} placeholder={{ en: 'Native, Fluent, B2…', fr: 'Maternelle, Courant, B2…' }} onChange={(v) => up((x) => (x.level = v))} />
            </>
          )}
        />
      );
    case 'studentLife':
      return (
        <ItemList<StudentLifeGroup>
          listKey="studentLife"
          sectionKey="studentLife"
          items={profile.studentLife}
          getItems={(p) => p.studentLife}
          title={(i) => t(i.title)}
          subtitle={(i) => `${i.items.length} line${i.items.length === 1 ? '' : 's'}`}
          create={() => ({ id: uid('sl'), title: L(), subtitle: L(), date: L(), style: 'bullets', items: [] })}
          renderEditor={(i, up) => (
            <>
              <LocalizedField label="Title" value={i.title} lang={lang} onChange={(v) => up((x) => (x.title = v))} />
              <div className="grid-2">
                <LocalizedField label="Role / subtitle" value={i.subtitle} lang={lang} onChange={(v) => up((x) => (x.subtitle = v))} />
                <LocalizedField label="Date" value={i.date} lang={lang} onChange={(v) => up((x) => (x.date = v))} />
              </div>
              <Field label="Display in sidebar as">
                <Select value={i.style} options={[{ value: 'bullets', label: 'Bulleted list' }, { value: 'lines', label: 'Plain lines' }]} onChange={(v) => up((x) => (x.style = v))} />
              </Field>
              <TextItems label="Lines" sectionKey="studentLife" items={i.items} lang={lang} onChange={(fn) => up((x) => fn(x.items))} />
              <span className="field-hint">{FORMAT_HINT}</span>
            </>
          )}
        />
      );
    case 'experience':
      return (
        <ItemList<ExperienceItem>
          listKey="experience"
          sectionKey="experience"
          items={profile.experience}
          getItems={(p) => p.experience}
          title={(i) => t(i.title)}
          subtitle={(i) => [t(i.organization), t(i.date)].filter(Boolean).join(' · ')}
          create={() => ({ id: uid('ex'), kind: 'project', title: L(), organization: L(), location: L(), date: L(), tech: '', description: L(), bullets: [] })}
          renderEditor={(i, up) => (
            <>
              <LocalizedField label="Title" value={i.title} lang={lang} onChange={(v) => up((x) => (x.title = v))} />
              <div className="grid-2">
                <LocalizedField label="Organization / context" value={i.organization} lang={lang} onChange={(v) => up((x) => (x.organization = v))} />
                <LocalizedField label="Location" value={i.location} lang={lang} onChange={(v) => up((x) => (x.location = v))} />
              </div>
              <div className="grid-2">
                <LocalizedField label="Date" value={i.date} lang={lang} placeholder={{ en: 'Summer 2025', fr: 'Été 2025' }} onChange={(v) => up((x) => (x.date = v))} />
                <Field label="Type">
                  <Select
                    value={i.kind}
                    options={[
                      { value: 'work', label: 'Work' },
                      { value: 'internship', label: 'Internship' },
                      { value: 'project', label: 'Project' },
                      { value: 'academic', label: 'Academic' },
                      { value: 'volunteer', label: 'Volunteer' },
                    ]}
                    onChange={(v) => up((x) => (x.kind = v))}
                  />
                </Field>
              </div>
              <Field label="Tech stack" hint="Same in both languages.">
                <TextInput value={i.tech} placeholder="React, Node.js, MongoDB" onChange={(v) => up((x) => (x.tech = v))} />
              </Field>
              <LocalizedField label="Description" value={i.description} lang={lang} multiline rows={3} onChange={(v) => up((x) => (x.description = v))} />
              <TextItems label="Bullet points" sectionKey="experience" items={i.bullets} lang={lang} addLabel="Add bullet" onChange={(fn) => up((x) => fn(x.bullets))} />
              <span className="field-hint">{FORMAT_HINT} Choose description, bullets or both in this section’s settings above.</span>
            </>
          )}
        />
      );
    case 'education':
      return (
        <ItemList<EducationItem>
          listKey="education"
          sectionKey="education"
          items={profile.education}
          getItems={(p) => p.education}
          title={(i) => t(i.institution)}
          subtitle={(i) => t(i.date)}
          create={() => ({ id: uid('ed'), institution: L(), degree: L(), location: L(), date: L(), details: L() })}
          renderEditor={(i, up) => (
            <>
              <LocalizedField label="Institution" value={i.institution} lang={lang} onChange={(v) => up((x) => (x.institution = v))} />
              <LocalizedField label="Degree" value={i.degree} lang={lang} onChange={(v) => up((x) => (x.degree = v))} />
              <div className="grid-2">
                <LocalizedField label="Location" value={i.location} lang={lang} onChange={(v) => up((x) => (x.location = v))} />
                <LocalizedField label="Date" value={i.date} lang={lang} onChange={(v) => up((x) => (x.date = v))} />
              </div>
              <LocalizedField label="Details" value={i.details} lang={lang} multiline rows={2} onChange={(v) => up((x) => (x.details = v))} />
            </>
          )}
        />
      );
    case 'certifications':
      return (
        <ItemList<CertificationItem>
          listKey="certifications"
          sectionKey="certifications"
          items={profile.certifications}
          getItems={(p) => p.certifications}
          title={(i) => t(i.name)}
          subtitle={(i) => [t(i.issuer), t(i.date)].filter(Boolean).join(' · ')}
          create={() => ({ id: uid('ce'), name: L(), issuer: L(), date: L() })}
          renderEditor={(i, up) => (
            <>
              <LocalizedField label="Name" value={i.name} lang={lang} onChange={(v) => up((x) => (x.name = v))} />
              <div className="grid-2">
                <LocalizedField label="Issuer" value={i.issuer} lang={lang} onChange={(v) => up((x) => (x.issuer = v))} />
                <LocalizedField label="Date" value={i.date} lang={lang} onChange={(v) => up((x) => (x.date = v))} />
              </div>
            </>
          )}
        />
      );
  }

  const section = profile.customSections.find((c) => `custom:${c.id}` === sectionKey);
  if (!section) return <p className="muted">This custom section no longer exists in your database.</p>;
  const si = profile.customSections.indexOf(section);
  return (
    <>
      <LocalizedField label="Section title" value={section.title} lang={lang} onChange={(v) => updateProfile((p) => (p.customSections[si].title = v))} />
      <ItemList<CustomEntry>
        listKey={null}
        sectionKey={`custom:${section.id}`}
        items={section.entries}
        getItems={(p) => p.customSections.find((c) => c.id === section.id)!.entries}
        title={(i) => t(i.title)}
        subtitle={(i) => t(i.date)}
        create={() => ({ id: uid('ce'), title: L(), subtitle: L(), date: L(), description: L() })}
        renderEditor={(i, up) => (
          <>
            <LocalizedField label="Title" value={i.title} lang={lang} onChange={(v) => up((x) => (x.title = v))} />
            <div className="grid-2">
              <LocalizedField label="Subtitle" value={i.subtitle} lang={lang} onChange={(v) => up((x) => (x.subtitle = v))} />
              <LocalizedField label="Date" value={i.date} lang={lang} onChange={(v) => up((x) => (x.date = v))} />
            </div>
            <LocalizedField label="Description" value={i.description} lang={lang} multiline rows={3} onChange={(v) => up((x) => (x.description = v))} />
          </>
        )}
      />
      <button
        type="button"
        className="btn small danger-outline"
        onClick={() => {
          if (!confirm('Delete this custom section and all its entries from your database? It disappears from every CV.')) return;
          updateProfile((p) => p.customSections.splice(si, 1));
          updateCV((c) => (c.sections = c.sections.filter((s) => s.key !== sectionKey)));
          useEditor.getState().select('personal');
        }}
      >
        Delete this custom section
      </button>
    </>
  );
}
