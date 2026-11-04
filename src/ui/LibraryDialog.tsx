import { useEffect, useRef, useState } from 'react';
import type { ComponentKind, Library } from '../data/components';
import { CHEMISTRIES, LAYOUTS } from '../engine/physics';
import type { Config } from '../engine/types';
import { download } from '../lib/exporters';
import { fuzzyFilter } from '../lib/fuzzy';
import { parseLibraryJson } from '../lib/storage';
import type { AnyPart } from './applyPart';
import { Icon } from './Icons';
import { t as tr, useT } from '../i18n';

interface Props {
  library: Library; // merged (custom first)
  custom: Library;
  config: Config;
  onChangeCustom: (l: Library) => void;
  onClose: () => void;
  /** Kind to open on, and whether to start a new part prefilled from the current build. */
  initialKind?: ComponentKind;
  initialModel?: string | null;
  onUse?: (kind: ComponentKind, part: AnyPart) => void;
}

const KINDS: { key: ComponentKind; label: string }[] = [
  { key: 'motor', label: 'Motors' },
  { key: 'prop', label: 'Propellers' },
  { key: 'battery', label: 'Batteries' },
  { key: 'esc', label: 'ESCs' },
  { key: 'frame', label: 'Frames' },
];

type FieldDef = { key: string; label: string; type?: 'text' | 'select'; options?: { value: string; label: string }[] };

const FIELDS: Record<ComponentKind, FieldDef[]> = {
  motor: [
    { key: 'kv', label: 'Kv (RPM/V)' }, { key: 'rm', label: 'Rm (mΩ)' }, { key: 'i0', label: 'I₀ (A)' }, { key: 'v0', label: 'I₀ test V' },
    { key: 'maxCurrent', label: 'Max current (A)' }, { key: 'maxPower', label: 'Max power (W)' }, { key: 'weight', label: 'Weight (g)' },
  ],
  prop: [
    { key: 'diameter', label: 'Diameter (in)' }, { key: 'pitch', label: 'Pitch (in)' }, { key: 'blades', label: 'Blades' }, { key: 'weight', label: 'Weight (g)' },
    { key: 'ct', label: 'Ct (optional)' }, { key: 'cp', label: 'Cp (optional)' },
  ],
  battery: [
    { key: 'chemistry', label: 'Chemistry', type: 'select', options: Object.entries(CHEMISTRIES).map(([k, v]) => ({ value: k, label: v.label })) },
    { key: 'form', label: 'Type', type: 'select', options: [{ value: 'pack', label: 'Pack' }, { value: 'cell', label: 'Single cell' }] },
    { key: 's', label: 'Cells in series' }, { key: 'capacity', label: 'Capacity (mAh)' }, { key: 'cRating', label: 'Continuous C' }, { key: 'cBurst', label: 'Burst C' },
    { key: 'resistance', label: 'Resistance per cell (mΩ)' }, { key: 'weight', label: 'Weight (g)' },
  ],
  esc: [
    { key: 'format', label: 'Format', type: 'select', options: [{ value: 'single', label: 'Single' }, { value: '4in1', label: '4-in-1' }] },
    { key: 'maxCurrent', label: 'Continuous (A)' }, { key: 'burstCurrent', label: 'Burst (A)' }, { key: 'resistance', label: 'Rds(on) (mΩ)' }, { key: 'weight', label: 'Weight per motor (g)' },
  ],
  frame: [
    { key: 'layout', label: 'Layout', type: 'select', options: Object.entries(LAYOUTS).map(([k, v]) => ({ value: k, label: v.label })) },
    { key: 'weight', label: 'Weight incl. electronics (g)' }, { key: 'maxPropIn', label: 'Max prop (in)' }, { key: 'dragArea', label: 'Cd·A m² (optional)' },
  ],
};

const OPTIONAL = new Set(['ct', 'cp', 'dragArea']);

function fromConfig(kind: ComponentKind, c: Config): Record<string, string> {
  const s = (o: object) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v == null ? '' : String(v)]));
  switch (kind) {
    case 'motor': return s({ ...c.motor, model: c.motor.name ?? 'My motor' });
    case 'prop': return s({ ...c.prop, model: c.prop.name ?? 'My prop' });
    case 'esc': return s({ ...c.esc, format: 'single', model: c.esc.name ?? 'My ESC' });
    case 'battery': return s({ ...c.battery, form: 'pack', weight: c.battery.weight ?? '', model: c.battery.name ?? 'My battery' });
    case 'frame': return s({ ...c.frame, model: 'My frame' });
  }
}

export function LibraryDialog({ library, custom, config, onChangeCustom, onClose, initialKind = 'motor', initialModel = null, onUse }: Props) {
  const t = useT();
  const [kind, setKind] = useState<ComponentKind>(initialKind);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Record<string, string> | null>(() =>
    initialModel === null ? null : { ...fromConfig(initialKind, config), brand: '', model: initialModel || '' },
  );
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const items = fuzzyFilter(library[kind] as { id: string; brand: string; model: string; custom?: boolean; note?: string }[], query, (i) => `${i.brand} ${i.model}`, 500);

  const save = (use = false) => {
    if (!draft) return;
    const errors: string[] = [];
    const item: Record<string, unknown> = { id: `${kind}-${Date.now()}`, brand: draft.brand?.trim() || 'Custom', model: draft.model?.trim() || 'Unnamed' };
    for (const f of FIELDS[kind]) {
      const raw = (draft[f.key] ?? '').trim();
      if (f.type === 'select') {
        item[f.key] = raw || f.options![0].value;
        continue;
      }
      if (raw === '' && OPTIONAL.has(f.key)) {
        item[f.key] = null;
        continue;
      }
      const v = Number(raw);
      // FRS 3.4 data verification: physical quantities must be positive.
      if (!Number.isFinite(v) || v <= 0) errors.push(tr('{label} must be a positive number', { label: f.label }));
      item[f.key] = v;
    }
    if (kind === 'battery' && item.form === 'cell') item.s = 1;
    if (kind === 'motor' && !item.v0) item.v0 = 10;
    if (errors.length) {
      setMessage(errors.join('. '));
      return;
    }
    onChangeCustom({ ...custom, [kind]: [item, ...custom[kind]] });
    setDraft(null);
    if (use && onUse) {
      onUse(kind, item as unknown as AnyPart);
      onClose();
      return;
    }
    setMessage(tr('Saved {name}.', { name: `${item.brand} ${item.model}` }));
  };

  const remove = (id: string) => onChangeCustom({ ...custom, [kind]: (custom[kind] as { id: string }[]).filter((x) => x.id !== id) });

  const importFile = async (file: File) => {
    try {
      const { library: lib, count, skipped } = parseLibraryJson(await file.text());
      const merged = { ...custom };
      (Object.keys(lib) as ComponentKind[]).forEach((k) => ((merged[k] as unknown[]) = [...lib[k], ...custom[k]]));
      onChangeCustom(merged);
      setMessage(tr('Imported parts: {n}.', { n: count }) + (skipped ? ' ' + tr('Skipped invalid: {n}.', { n: skipped }) : ''));
    } catch (e) {
      setMessage(tr('Import failed: {e}', { e: String(e) }));
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={t('Component library')} onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>{t('Component library')}</h2>
          <button className="btn ghost" onClick={onClose} aria-label={t('Close')}>×</button>
        </header>
        <div className="tabs">
          {KINDS.map((k) => (
            <button key={k.key} className={kind === k.key ? 'active' : ''} onClick={() => { setKind(k.key); setDraft(null); }}>
              <Icon name={k.key} size={16} /> {t(k.label)} <span className="muted">({library[k.key].length})</span>
            </button>
          ))}
        </div>
        <div className="row wrap">
          <input type="search" placeholder={t('Filter…')} value={query} onChange={(e) => setQuery(e.target.value)} />
          <button className="btn small" onClick={() => setDraft({ brand: '', model: '' })}>{t('+ New part')}</button>
          <button className="btn small" onClick={() => setDraft(fromConfig(kind, config))}>{t('+ From current config')}</button>
          <button className="btn small ghost" onClick={() => fileRef.current?.click()}>{t('Import JSON')}</button>
          <button className="btn small ghost" onClick={() => download('hoverlab-custom-parts.json', JSON.stringify(custom, null, 2), 'application/json')}>{t('Export custom')}</button>
          <button className="btn small ghost" onClick={() => download('hoverlab-library.json', JSON.stringify(library, null, 2), 'application/json')}>{t('Export all')}</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
        </div>
        {message && <p className="muted small">{message}</p>}
        {draft && (
          <div className="card draft">
            <p className="muted small">{t('Values start from your current build; change whatever differs. Custom parts are saved in this browser and can be exported as JSON.')}</p>
            <div className="grid3">
              <label className="field"><span className="field-label">{t('Brand')}</span><input value={draft.brand ?? ''} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} /></label>
              <label className="field"><span className="field-label">{t('Model')}</span><input value={draft.model ?? ''} onChange={(e) => setDraft({ ...draft, model: e.target.value })} /></label>
              {FIELDS[kind].map((f) => (
                <label key={f.key} className="field">
                  <span className="field-label">{t(f.label)}</span>
                  {f.type === 'select' ? (
                    <select value={draft[f.key] ?? f.options![0].value} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}>
                      {f.options!.map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
                    </select>
                  ) : (
                    <input inputMode="decimal" value={draft[f.key] ?? ''} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} />
                  )}
                </label>
              ))}
            </div>
            <div className="row">
              {onUse && <button className="btn primary small" onClick={() => save(true)}>{t('Save & use in this build')}</button>}
              <button className={`btn small${onUse ? '' : ' primary'}`} onClick={() => save()}>{t('Save to library')}</button>
              <button className="btn ghost small" onClick={() => setDraft(null)}>{t('Cancel')}</button>
            </div>
          </div>
        )}
        <div className="lib-list">
          {items.map((it) => (
            <div key={it.id} className="lib-item">
              <span>
                {it.brand} {it.model} {it.custom && <span className="tag">{t('custom')}</span>}
                {it.note && <span className="muted small"> · {t(it.note)}</span>}
              </span>
              <span className="muted small">
                {FIELDS[kind].filter((f) => f.type !== 'select').slice(0, 4).map((f) => `${t(f.label).split(' (')[0]} ${(it as unknown as Record<string, unknown>)[f.key] ?? '—'}`).join(' · ')}
              </span>
              {it.custom && <button className="btn ghost small" onClick={() => remove(it.id)} aria-label={t('Delete')}>{t('Delete')}</button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
