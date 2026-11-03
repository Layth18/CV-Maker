import { useState } from 'react';
import type { SectionConfig } from '../../../shared/types';
import { uid, useEditor } from '../store';
import { Icon } from './Icon';
import { DESIGN_TOOLS, displayLabel, iconFor, itemCounts } from './sectionMeta';
import { move } from './ui';

/**
 * The document outline: header, then the CV's sections in document order,
 * then the design tools. Selecting a row shows only that toolbox.
 */
export function Outline() {
  const cv = useEditor((s) => s.cv)!;
  const profile = useEditor((s) => s.profile)!;
  const selected = useEditor((s) => s.selected);
  const select = useEditor((s) => s.select);
  const updateCV = useEditor((s) => s.updateCV);
  const updateProfile = useEditor((s) => s.updateProfile);
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const twoCols = cv.layout.columns === 2;

  const row = (s: SectionConfig) => {
    const i = cv.sections.indexOf(s);
    const counts = itemCounts(cv, profile, s);
    const active = selected === s.key;
    return (
      <li
        key={s.key}
        className={`ol-item${active ? ' active' : ''}${s.visible ? '' : ' muted-row'}${over === i && drag !== i ? ' drop' : ''}${drag === i ? ' dragging' : ''}`}
        draggable
        onDragStart={(e) => {
          setDrag(i);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(i);
        }}
        onDragLeave={() => setOver((o) => (o === i ? null : o))}
        onDragEnd={() => {
          setDrag(null);
          setOver(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (drag !== null && drag !== i) {
            updateCV((c) => {
              // Dropping onto the other column moves the section there.
              c.sections[drag].column = c.sections[i].column;
              move(c.sections, drag, i);
            });
          }
          setDrag(null);
          setOver(null);
        }}
      >
        <button type="button" className="ol-main" onClick={() => select(s.key)} aria-current={active ? 'true' : undefined}>
          <span className="ol-grip" aria-hidden="true"><Icon name="grip" size={14} /></span>
          <span className="ol-icon"><Icon name={iconFor(s.key)} size={15} /></span>
          <span className="ol-label">{displayLabel(cv, profile, s)}</span>
          {counts && <span className="ol-count">{counts.shown}/{counts.total}</span>}
        </button>
        <button
          type="button"
          className="ol-eye"
          title={s.visible ? 'Hide this section in the CV' : 'Show this section in the CV'}
          aria-label={s.visible ? 'Hide section' : 'Show section'}
          onClick={() => updateCV((c) => (c.sections[i].visible = !c.sections[i].visible))}
        >
          <Icon name={s.visible ? 'eye' : 'eye-off'} size={14} />
        </button>
      </li>
    );
  };

  const sidebar = cv.sections.filter((s) => twoCols && s.column === 'sidebar');
  const main = cv.sections.filter((s) => !twoCols || s.column === 'main');
  const sidebarFirst = cv.layout.sidebarPosition === 'left';
  const columns = twoCols
    ? (sidebarFirst ? [['Sidebar', sidebar], ['Main column', main]] : [['Main column', main], ['Sidebar', sidebar]]) as [string, SectionConfig[]][]
    : ([['', main]] as [string, SectionConfig[]][]);

  return (
    <nav className="outline" aria-label="CV outline">
      <div className="ol-group-label">Document</div>
      <ul className="ol-list">
        <li className={`ol-item${selected === 'personal' ? ' active' : ''}`}>
          <button type="button" className="ol-main" onClick={() => select('personal')}>
            <span className="ol-grip" />
            <span className="ol-icon"><Icon name="user" size={15} /></span>
            <span className="ol-label">Header & contact</span>
          </button>
        </li>
      </ul>
      {columns.map(([label, list]) => (
        <div key={label || 'all'}>
          {label && <div className="ol-col-label">{label}</div>}
          <ul className="ol-list">{list.map(row)}</ul>
        </div>
      ))}
      <button
        type="button"
        className="ol-add"
        onClick={() => {
          const id = uid('cs');
          updateProfile((p) => p.customSections.push({ id, title: { en: 'New section', fr: 'Nouvelle section' }, entries: [] }));
          updateCV((c) => c.sections.push({ key: `custom:${id}`, visible: true, column: 'main', title: { en: '', fr: '' }, itemIds: null, detail: 'both', hiddenSubItems: [] }));
          select(`custom:${id}`);
        }}
      >
        <Icon name="plus" size={14} /> Custom section
      </button>

      <div className="ol-group-label">Design</div>
      <ul className="ol-list">
        {DESIGN_TOOLS.map((d) => (
          <li key={d.id} className={`ol-item${selected === d.id ? ' active' : ''}`}>
            <button type="button" className="ol-main" onClick={() => select(d.id)}>
              <span className="ol-grip" />
              <span className="ol-icon"><Icon name={d.icon} size={15} /></span>
              <span className="ol-label">{d.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
