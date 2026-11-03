import { useEffect, useState, type ReactNode } from 'react';
import { fmtNum, unit, type Quantity } from '../lib/units';
import { useUnits } from './context';

interface NumberFieldProps {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  quantity?: Quantity;
  unitLabel?: string;
  step?: number;
  min?: number;
  max?: number;
  integer?: boolean;
  /** Allows an empty value meaning "estimate automatically"; the estimate is shown as placeholder. */
  auto?: number;
  hint?: string;
  slider?: boolean;
}

export function NumberField({ label, value, onChange, quantity, unitLabel, step, min, max, integer, auto, hint, slider }: NumberFieldProps) {
  const system = useUnits();
  const u = quantity ? unit(system, quantity) : null;
  const toDisp = (v: number) => (u ? u.toDisplay(v) : v);
  const fromDisp = (v: number) => (u ? u.fromDisplay(v) : v);
  const round = (v: number) => +v.toFixed(u ? Math.max(u.digits, 1) : 4);
  const shown = value == null ? '' : String(round(toDisp(value)));
  const [text, setText] = useState(shown);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(shown);
  }, [shown, focused]);

  const commit = (t: string) => {
    setText(t);
    if (t.trim() === '') {
      if (auto !== undefined) onChange(null);
      return;
    }
    let v = Number(t.replace(',', '.'));
    if (!Number.isFinite(v)) return;
    if (integer) v = Math.round(v);
    onChange(fromDisp(v));
  };

  const invalid = text.trim() !== '' && !Number.isFinite(Number(text.replace(',', '.')));
  return (
    <label className={`field${invalid ? ' invalid' : ''}`} title={hint}>
      <span className="field-label">{label}</span>
      <span className="field-input">
        <input
          type="text"
          inputMode="decimal"
          value={text}
          placeholder={auto !== undefined ? `auto ≈ ${fmtNum(toDisp(auto), u ? u.digits : 2)}` : undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            setText(shown);
          }}
          onChange={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
            e.preventDefault();
            const cur = value ?? auto ?? 0;
            const st = (step ?? 1) * (e.shiftKey ? 10 : 1);
            let next = round(toDisp(cur)) + (e.key === 'ArrowUp' ? st : -st);
            if (min !== undefined) next = Math.max(min, next);
            if (max !== undefined) next = Math.min(max, next);
            commit(String(+next.toFixed(6)));
          }}
        />
        {(u || unitLabel) && <span className="field-unit">{u ? u.label : unitLabel}</span>}
      </span>
      {slider && min !== undefined && max !== undefined && (
        <input
          className="field-slider"
          type="range"
          min={min}
          max={max}
          step={step ?? 1}
          value={toDisp(value ?? auto ?? min)}
          onChange={(e) => onChange(fromDisp(Number(e.target.value)))}
          aria-label={label}
        />
      )}
    </label>
  );
}

interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}

export function SelectField<T extends string>({ label, value, options, onChange }: SelectFieldProps<T>) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Section({ title, summary, children, defaultOpen = true }: { title: string; summary?: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="section" open={defaultOpen}>
      <summary>
        <span className="section-title">{title}</span>
        {summary && <span className="section-summary">{summary}</span>}
      </summary>
      <div className="section-body">{children}</div>
    </details>
  );
}
