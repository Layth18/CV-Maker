import { FONTS, getFont } from '../../../../shared/catalog';
import type { ColorConfig, HeaderStyle, LayoutConfig, PageNumbering, PaperSize, PhotoShape, TypographyConfig } from '../../../../shared/types';
import { urls } from '../../api';
import { useEditor } from '../../store';
import { ColorField, Field, Panel, Segmented, Select, Slider, Toggle } from '../ui';

function useLayout() {
  const cv = useEditor((s) => s.cv)!;
  const updateCV = useEditor((s) => s.updateCV);
  return [cv.layout, (fn: (l: LayoutConfig) => void) => updateCV((c) => fn(c.layout))] as const;
}

export function LayoutPanel() {
  const [L, set] = useLayout();
  const profile = useEditor((s) => s.profile)!;
  const two = L.columns === 2;
  const headerOptions: { value: HeaderStyle; label: string; disabled?: boolean }[] = [
    { value: 'banner', label: 'Full-width colored banner' },
    { value: 'left', label: 'Top, left-aligned' },
    { value: 'centered', label: 'Top, centered' },
    { value: 'sidebar', label: 'Inside the sidebar', disabled: !two },
    { value: 'main', label: 'Top of the main column', disabled: !two },
  ];
  const m = L.margins;
  const allSame = m.top === m.bottom && m.top === m.left && m.top === m.right;

  return (
    <div className="panel-scroll">
      <Panel title="Page">
        <div className="grid-2">
          <Field label="Paper">
            <Segmented<PaperSize> value={L.paper} options={[{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'US Letter' }]} onChange={(v) => set((l) => (l.paper = v))} />
          </Field>
          <Field label="Page numbers">
            <Select<PageNumbering>
              value={L.pageNumbering}
              options={[
                { value: 'none', label: 'None' },
                { value: 'simple', label: '1, 2, 3' },
                { value: 'of-total', label: 'Page 1 of 2' },
              ]}
              onChange={(v) => set((l) => (l.pageNumbering = v))}
            />
          </Field>
        </div>
        <Slider label="Margins (all sides)" value={allSame ? m.top : m.left} min={0.6} max={3} step={0.05} format={(v) => `${v.toFixed(2)} cm`}
          onChange={(v) => set((l) => (l.margins = { top: v, bottom: v, left: v, right: v }))} />
        <details className="subtle-details">
          <summary>Individual margins</summary>
          <div className="grid-2">
            {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
              <Slider key={side} label={side[0].toUpperCase() + side.slice(1)} value={m[side]} min={0.5} max={4} step={0.05} format={(v) => `${v.toFixed(2)} cm`}
                onChange={(v) => set((l) => (l.margins[side] = v))} />
            ))}
          </div>
        </details>
      </Panel>

      <Panel title="Columns">
        <Field label="Layout">
          <Segmented<1 | 2> value={L.columns} options={[{ value: 1, label: 'Single column' }, { value: 2, label: 'Two columns' }]}
            onChange={(v) => set((l) => {
              l.columns = v;
              if (v === 1 && (l.headerStyle === 'sidebar' || l.headerStyle === 'main')) l.headerStyle = 'left';
            })} />
        </Field>
        {two && (
          <>
            <Field label="Sidebar position">
              <Segmented value={L.sidebarPosition} options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]} onChange={(v) => set((l) => (l.sidebarPosition = v))} />
            </Field>
            <Slider label="Sidebar width" value={L.sidebarWidth} min={0.2} max={0.45} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set((l) => (l.sidebarWidth = v))} />
            <Toggle label="Colored sidebar background" checked={L.sidebarFilled} onChange={(v) => set((l) => (l.sidebarFilled = v))} />
            <Toggle label="Divider line between columns" checked={L.columnDivider} disabled={L.sidebarFilled} onChange={(v) => set((l) => (l.columnDivider = v))} />
          </>
        )}
      </Panel>

      <Panel title="Header">
        <Field label="Header position">
          <Select<HeaderStyle> value={L.headerStyle} options={headerOptions} onChange={(v) => set((l) => (l.headerStyle = v))} />
        </Field>
      </Panel>

      <Panel title="Spacing">
        <Slider label="Space before sections" value={L.sectionSpacing} min={0} max={30} step={1} unit=" pt" onChange={(v) => set((l) => (l.sectionSpacing = v))} />
        <Slider label="Space between entries" value={L.entrySpacing} min={0} max={20} step={1} unit=" pt" onChange={(v) => set((l) => (l.entrySpacing = v))} />
      </Panel>

      <Panel title="Profile picture">
        <Toggle label="Show profile picture" checked={L.showPhoto} onChange={(v) => set((l) => (l.showPhoto = v))}
          hint={profile.personal.photo ? undefined : 'No photo uploaded yet — add one under Content › Personal information.'} />
        {L.showPhoto && (
          <>
            <div className="row">
              {profile.personal.photo && <img className={`photo-preview shape-${L.photoShape}`} src={urls.asset(profile.personal.photo)} alt="" />}
              <Field label="Shape">
                <Segmented<PhotoShape> value={L.photoShape} options={[{ value: 'circle', label: 'Circle' }, { value: 'rounded', label: 'Rounded' }, { value: 'square', label: 'Square' }]}
                  onChange={(v) => set((l) => (l.photoShape = v))} />
              </Field>
            </div>
            <Slider label="Size" value={L.photoSize} min={1.5} max={5} step={0.1} format={(v) => `${v.toFixed(1)} cm`} onChange={(v) => set((l) => (l.photoSize = v))} />
          </>
        )}
      </Panel>
    </div>
  );
}

export function TypographyPanel() {
  const cv = useEditor((s) => s.cv)!;
  const updateCV = useEditor((s) => s.updateCV);
  const T = cv.typography;
  const set = (fn: (t: TypographyConfig) => void) => updateCV((c) => fn(c.typography));
  const body = getFont(T.fontFamily);
  const fontOptions = FONTS.map((f) => ({ value: f.id, label: f.label, group: f.kind === 'sans' ? 'Sans-serif' : 'Serif' }));

  return (
    <div className="panel-scroll">
      <Panel title="Fonts" description="All fonts ship with TeX Live and are embedded in the PDF.">
        <Field label="Body font">
          <Select value={T.fontFamily} options={fontOptions} onChange={(v) => set((t) => (t.fontFamily = v))} />
        </Field>
        <Field label="Name & heading font">
          <Select value={T.headingFontFamily} options={[{ value: '', label: 'Same as body' }, ...fontOptions]} onChange={(v) => set((t) => (t.headingFontFamily = v))} />
        </Field>
      </Panel>

      <Panel title="Sizes">
        <Slider label="Body text" value={T.fontSize} min={8} max={13} step={0.5} unit=" pt" onChange={(v) => set((t) => (t.fontSize = v))} />
        <Slider label="Section headings" value={T.headingSize} min={8} max={20} step={0.5} unit=" pt" onChange={(v) => set((t) => (t.headingSize = v))} />
        <Slider label="Name" value={T.nameSize} min={14} max={40} step={1} unit=" pt" onChange={(v) => set((t) => (t.nameSize = v))} />
      </Panel>

      <Panel title="Text">
        <Field label="Alignment">
          <Segmented value={T.alignment} options={[{ value: 'left', label: 'Left (ragged)' }, { value: 'justify', label: 'Justified' }]} onChange={(v) => set((t) => (t.alignment = v))} />
        </Field>
        <Slider label="Line spacing" value={T.lineSpacing} min={0.9} max={1.5} step={0.01} format={(v) => `× ${v.toFixed(2)}`} onChange={(v) => set((t) => (t.lineSpacing = v))} />
        <Field label="Body weight" hint={body.light ? undefined : `${body.label} has no light weight.`}>
          <Segmented value={T.bodyWeight} options={[{ value: 'light', label: 'Light', disabled: !body.light }, { value: 'regular', label: 'Regular' }]}
            onChange={(v) => set((t) => (t.bodyWeight = v))} />
        </Field>
        <Field label="Bold weight" hint={body.semibold ? undefined : `${body.label} has no semibold weight.`}>
          <Segmented value={T.boldWeight} options={[{ value: 'semibold', label: 'Semibold', disabled: !body.semibold }, { value: 'bold', label: 'Bold' }]}
            onChange={(v) => set((t) => (t.boldWeight = v))} />
        </Field>
      </Panel>

      <Panel title="Section headings">
        <Toggle label="Bold headings" checked={T.headingBold} onChange={(v) => set((t) => (t.headingBold = v))} />
        <Toggle label="Uppercase headings" checked={T.headingUppercase} onChange={(v) => set((t) => (t.headingUppercase = v))} />
      </Panel>
    </div>
  );
}

const PALETTES: { name: string; colors: Partial<ColorConfig> }[] = [
  { name: 'Navy', colors: { primary: '#0F3C73', accent: '#006EBE', heading: '#0F3C73', headerBg: '#0F3C73', sidebarBg: '#EEF3F9' } },
  { name: 'Teal', colors: { primary: '#1D4E5F', accent: '#2A9D8F', heading: '#1D4E5F', headerBg: '#1D4E5F', sidebarBg: '#EDF6F5' } },
  { name: 'Burgundy', colors: { primary: '#7A1F2B', accent: '#B23A48', heading: '#7A1F2B', headerBg: '#7A1F2B', sidebarBg: '#F8EEF0' } },
  { name: 'Forest', colors: { primary: '#14532D', accent: '#15803D', heading: '#14532D', headerBg: '#14532D', sidebarBg: '#EEF6F0' } },
  { name: 'Charcoal', colors: { primary: '#2B2B2B', accent: '#5A5A5A', heading: '#2B2B2B', headerBg: '#2B2B2B', sidebarBg: '#F2F2F2' } },
  { name: 'Plum', colors: { primary: '#4B2A63', accent: '#7E57C2', heading: '#4B2A63', headerBg: '#4B2A63', sidebarBg: '#F3EEF8' } },
];

export function ColorsPanel() {
  const cv = useEditor((s) => s.cv)!;
  const updateCV = useEditor((s) => s.updateCV);
  const C = cv.colors;
  const set = (key: keyof ColorConfig) => (v: string) => updateCV((c) => (c.colors[key] = v));

  return (
    <div className="panel-scroll">
      <Panel title="Palettes" description="Apply a coordinated set, then fine-tune below.">
        <div className="palette-row">
          {PALETTES.map((p) => (
            <button key={p.name} type="button" className="palette" onClick={() => updateCV((c) => Object.assign(c.colors, p.colors))} title={p.name}>
              <span style={{ background: p.colors.primary }} />
              <span style={{ background: p.colors.accent }} />
              <span style={{ background: p.colors.sidebarBg }} />
              <em>{p.name}</em>
            </button>
          ))}
        </div>
      </Panel>
      <Panel title="Document">
        <ColorField label="Primary (name)" value={C.primary} onChange={set('primary')} />
        <ColorField label="Secondary (subtitles)" value={C.secondary} onChange={set('secondary')} />
        <ColorField label="Accent (tech, bullets)" value={C.accent} onChange={set('accent')} />
        <ColorField label="Body text" value={C.text} onChange={set('text')} />
        <ColorField label="Section headings" value={C.heading} onChange={set('heading')} />
      </Panel>
      <Panel title="Header banner">
        <ColorField label="Banner background" value={C.headerBg} onChange={set('headerBg')} />
        <ColorField label="Banner text" value={C.headerText} onChange={set('headerText')} />
      </Panel>
      <Panel title="Sidebar" description={cv.layout.columns === 2 && cv.layout.sidebarFilled ? undefined : 'Used when the layout has a colored sidebar.'}>
        <ColorField label="Sidebar background" value={C.sidebarBg} onChange={set('sidebarBg')} />
        <ColorField label="Sidebar text" value={C.sidebarText} onChange={set('sidebarText')} />
      </Panel>
    </div>
  );
}
