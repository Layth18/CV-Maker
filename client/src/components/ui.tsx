import { useEffect, useId, useState, type ReactNode } from 'react';
import type { Lang, Localized } from '../../../shared/types';
import { Icon } from './Icon';

export function Field({ label, hint, children, inline }: { label: string; hint?: ReactNode; children: ReactNode; inline?: boolean }) {
  return (
    <label className={`field${inline ? ' field-inline' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function TextInput(props: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; 'aria-label'?: string }) {
  return (
    <input
      className="input"
      type={props.type ?? 'text'}
      value={props.value}
      placeholder={props.placeholder}
      aria-label={props['aria-label']}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}

export function TextArea(props: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; 'aria-label'?: string; mono?: boolean }) {
  return (
    <textarea
      className={`input textarea${props.mono ? ' mono' : ''}`}
      rows={props.rows ?? 3}
      value={props.value}
      placeholder={props.placeholder}
      aria-label={props['aria-label']}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}

/**
 * A bilingual field: the CV's language first, the other language beside it.
 * A dot marks a missing translation.
 */
export function LocalizedField({
  label,
  value,
  onChange,
  lang,
  multiline,
  rows,
  placeholder,
}: {
  label: string;
  value: Localized;
  onChange: (v: Localized) => void;
  lang: Lang;
  multiline?: boolean;
  rows?: number;
  placeholder?: Partial<Localized>;
}) {
  const order: Lang[] = lang === 'en' ? ['en', 'fr'] : ['fr', 'en'];
  const id = useId();
  return (
    <div className="field" role="group" aria-labelledby={id}>
      <span className="field-label" id={id}>
        {label}
      </span>
      <div className={`loc-grid${multiline ? ' loc-multi' : ''}`}>
        {order.map((l) => {
          const missing = !value[l].trim() && Boolean(value[l === 'en' ? 'fr' : 'en'].trim());
          const common = {
            className: `input${multiline ? ' textarea' : ''}`,
            value: value[l],
            placeholder: placeholder?.[l],
            'aria-label': `${label} (${l.toUpperCase()})`,
            // Spell-check each side in its own language.
            lang: l,
            spellCheck: true,
          };
          return (
            <div key={l} className={`loc-cell${l === lang ? ' is-primary' : ''}`}>
              <span className={`lang-tag${missing ? ' missing' : ''}`} title={missing ? 'Translation missing' : undefined}>
                {l.toUpperCase()}
              </span>
              {multiline ? (
                <textarea {...common} rows={rows ?? 3} onChange={(e) => onChange({ ...value, [l]: e.target.value })} />
              ) : (
                <input {...common} onChange={(e) => onChange({ ...value, [l]: e.target.value })} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  'aria-label': ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; group?: string; disabled?: boolean }[];
  'aria-label'?: string;
}) {
  const groups = [...new Set(options.map((o) => o.group ?? ''))];
  return (
    <select className="input select" value={value} aria-label={ariaLabel} onChange={(e) => onChange(e.target.value as T)}>
      {groups.map((g) =>
        g ? (
          <optgroup key={g} label={g}>
            {options.filter((o) => o.group === g).map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
            ))}
          </optgroup>
        ) : (
          options.filter((o) => !o.group).map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
          ))
        ),
      )}
    </select>
  );
}

export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  'aria-label': ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; disabled?: boolean; title?: string }[];
  'aria-label'?: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'active' : ''}
          disabled={o.disabled}
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit = '',
  format,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
  format?: (v: number) => string;
}) {
  return (
    <label className="field slider-field">
      <span className="field-label">
        {label}
        <span className="slider-value">{format ? format(value) : `${value}${unit}`}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function Toggle({ label, checked, onChange, hint, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string; disabled?: boolean }) {
  return (
    <label className={`toggle${disabled ? ' disabled' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-thumb" />
      </span>
      <span className="toggle-text">
        {label}
        {hint && <span className="field-hint">{hint}</span>}
      </span>
    </label>
  );
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <label className="color-field">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} aria-label={label} />
      <span className="color-label">{label}</span>
      <input
        className="input hex-input"
        value={draft}
        aria-label={`${label} hex value`}
        spellCheck={false}
        onChange={(e) => {
          const v = e.target.value.trim();
          setDraft(v);
          if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v.toUpperCase());
        }}
        onBlur={() => setDraft(value)}
      />
    </label>
  );
}

export function Panel({ title, description, children, actions }: { title: string; description?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="panel-block">
      <header className="panel-block-head">
        <div>
          <h3>{title}</h3>
          {description && <p className="muted">{description}</p>}
        </div>
        {actions}
      </header>
      <div className="panel-block-body">{children}</div>
    </section>
  );
}

export function IconButton({ icon, label, onClick, disabled, danger }: { icon: string; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" className={`icon-btn${danger ? ' danger' : ''}`} title={label} aria-label={label} onClick={onClick} disabled={disabled}>
      <Icon name={icon} />
    </button>
  );
}

export function move<T>(list: T[], from: number, to: number): void {
  if (to < 0 || to >= list.length) return;
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
}
