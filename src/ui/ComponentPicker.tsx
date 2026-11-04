import { useMemo, useRef, useState } from 'react';
import { fuzzyFilter } from '../lib/fuzzy';
import { Icon, type IconName } from './Icons';
import { tName, useT } from '../i18n';

interface Props<T extends { id: string; brand: string; model: string; custom?: boolean; note?: string }> {
  items: T[];
  current?: string;
  detail: (item: T) => string;
  onPick: (item: T) => void;
  placeholder: string;
  /** Opens the custom-part editor; offered at the bottom of every result list. */
  onDefine?: (query: string) => void;
  kindLabel?: string;
  icon?: IconName;
}

/** Fuzzy-search dropdown over library parts (FRS 2.2.3), e.g. "tmotor 2207" or "gem 5". */
export function ComponentPicker<T extends { id: string; brand: string; model: string; custom?: boolean; note?: string }>({ items, current, detail, onPick, placeholder, onDefine, kindLabel = 'parts', icon }: Props<T>) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const results = useMemo(() => fuzzyFilter(items, query, (i) => `${i.brand} ${i.model} ${detail(i)}`, 40), [items, query, detail]);

  const pick = (it: T) => {
    onPick(it);
    setQuery('');
    setOpen(false);
  };

  return (
    <div
      className="picker"
      ref={ref}
      onBlur={(e) => {
        if (!ref.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <input
        type="search"
        value={query}
        placeholder={current ? t('{name} — search to replace', { name: tName(current) }) : placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, results.length - 1));
          else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
          else if (e.key === 'Enter' && results[active]) pick(results[active]);
          else if (e.key === 'Escape') setOpen(false);
          else return;
          e.preventDefault();
        }}
        aria-label={placeholder}
      />
      {open && (
        <ul className="picker-list" role="listbox">
          {results.length === 0 && <li className="picker-empty">{t('No matching {kind} in the library.', { kind: kindLabel })}</li>}
          {results.map((it, i) => (
            <li key={it.id}>
              <button
                type="button"
                className={i === active ? 'active' : ''}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(it)}
              >
                <span className="picker-name">
                  {icon && <Icon name={icon} size={15} className="picker-icon" />}
                  {it.brand} {it.model}
                  {it.custom && <span className="tag">{t('custom')}</span>}
                </span>
                <span className="picker-detail">
                  {detail(it)}
                  {it.note && <em> · {t(it.note)}</em>}
                </span>
              </button>
            </li>
          ))}
          {onDefine && (
            <li className="picker-define">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setOpen(false);
                  onDefine(query);
                  setQuery('');
                }}
              >
                ＋ {t("Can't find it? Define a custom part")}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
