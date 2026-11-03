import { useMemo } from 'react';
import type { Lang, Localized, Profile, Region } from '../../../../shared/types';
import { useEditor } from '../../store';
import { Field, Panel, Segmented, TextArea, TextInput } from '../ui';

/** Fields whose text exists in one language but not the other. */
function missingTranslations(p: Profile, lang: Lang): string[] {
  const other: Lang = lang === 'en' ? 'fr' : 'en';
  const out: string[] = [];
  const check = (l: Localized, where: string) => {
    if (!l[lang].trim() && l[other].trim()) out.push(where);
  };
  check(p.personal.headline, 'Headline');
  check(p.personal.location, 'Location');
  p.personal.links.forEach((l) => check(l.label, `Link text (${l.kind})`));
  check(p.summary, 'Professional summary');
  p.skills.forEach((s) => (check(s.category, `Skill category "${s.category[other]}"`), s.skills.forEach((k) => check(k.text, `Skill "${k.text[other]}"`))));
  p.languages.forEach((l) => (check(l.name, `Language "${l.name[other]}"`), check(l.level, `Level of "${l.name[other] || l.name[lang]}"`)));
  p.studentLife.forEach((g) => {
    check(g.title, `Student life "${g.title[other]}"`);
    g.items.forEach((i, n) => check(i.text, `Line ${n + 1} of "${g.title[other] || g.title[lang]}"`));
  });
  p.experience.forEach((e) => {
    const name = e.title[other] || e.title[lang];
    check(e.title, `Title of "${name}"`);
    check(e.organization, `Organization of "${name}"`);
    check(e.date, `Date of "${name}"`);
    check(e.description, `Description of "${name}"`);
    e.bullets.forEach((b, n) => check(b.text, `Bullet ${n + 1} of "${name}"`));
  });
  p.education.forEach((e) => (check(e.institution, `Institution "${e.institution[other]}"`), check(e.degree, `Degree at "${e.institution[other] || e.institution[lang]}"`)));
  p.certifications.forEach((c) => check(c.name, `Certification "${c.name[other]}"`));
  return out;
}

export function LanguagePanel() {
  const cv = useEditor((s) => s.cv)!;
  const profile = useEditor((s) => s.profile)!;
  const notes = useEditor((s) => s.source?.notes ?? []);
  const updateCV = useEditor((s) => s.updateCV);
  const missing = useMemo(() => missingTranslations(profile, cv.language), [profile, cv.language]);

  return (
    <div className="panel-scroll">
      <Panel title="CV">
        <Field label="Name of this CV">
          <TextInput value={cv.name} onChange={(v) => updateCV((c) => (c.name = v))} />
        </Field>
      </Panel>
      <Panel title="Language" description="Which side of your bilingual database this CV uses.">
        <Segmented<Lang>
          value={cv.language}
          options={[{ value: 'en', label: 'English' }, { value: 'fr', label: 'Français' }]}
          onChange={(v) => updateCV((c) => (c.language = v))}
        />
        {missing.length > 0 ? (
          <div className="callout warn">
            <strong>{missing.length} field{missing.length > 1 ? 's' : ''} missing in {cv.language === 'en' ? 'English' : 'French'}</strong> — the other language is used instead:
            <ul>{missing.slice(0, 12).map((m) => <li key={m}>{m}</li>)}</ul>
            {missing.length > 12 && <span className="muted">…and {missing.length - 12} more.</span>}
          </div>
        ) : (
          <p className="muted small">Every field has a {cv.language === 'en' ? 'English' : 'French'} version.</p>
        )}
        {notes.length > 0 && missing.length === 0 && <p className="muted small">{notes.length} generation note(s).</p>}
      </Panel>
      <Panel title="Regional style" description="Sets conventional section names (e.g. “Professional Summary” for Canada). Templates set this automatically.">
        <Segmented<Region>
          value={cv.region}
          options={[{ value: 'CA', label: 'Canada' }, { value: 'FR', label: 'France' }, { value: 'INTL', label: 'International' }]}
          onChange={(v) => updateCV((c) => (c.region = v))}
        />
      </Panel>
      <Panel title="Advanced: extra LaTeX" description="Raw LaTeX added to the preamble as custom_preamble.tex. Not needed for normal use; errors here are reported with line numbers.">
        <TextArea
          mono
          rows={6}
          value={cv.advanced.extraPreamble}
          placeholder={'% e.g.\n\\setlength\\cvbannerpad{0.5cm}'}
          aria-label="Extra preamble LaTeX"
          onChange={(v) => updateCV((c) => (c.advanced.extraPreamble = v))}
        />
      </Panel>
    </div>
  );
}
