import { useRef } from 'react';
import { PRESETS } from '../data/presets';
import type { Config } from '../engine/types';
import type { Prefs } from '../lib/storage';

interface Props {
  config: Config;
  saved: Config[];
  prefs: Prefs;
  canExport: boolean;
  onLoad: (c: Config) => void;
  onSave: () => void;
  onDeleteSaved: (name: string) => void;
  onImportConfig: (file: File) => void;
  onExport: (kind: 'csv' | 'pdf' | 'json' | 'link') => void;
  onLibrary: () => void;
  onPrefs: (p: Prefs) => void;
}

function closeMenu(el: HTMLElement) {
  el.closest('details')?.removeAttribute('open');
}

export function TopBar({ config, saved, prefs, canExport, onLoad, onSave, onDeleteSaved, onImportConfig, onExport, onLibrary, onPrefs }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <header className="topbar">
      <div className="brand">
        <img src="./icon.svg" alt="" width={28} height={28} />
        <span>HoverLab</span>
        <span className="config-name" title="Current configuration">{config.name}</span>
      </div>
      <nav className="actions">
        <details className="menu">
          <summary className="btn">Presets</summary>
          <div className="menu-list">
            {PRESETS.map((p) => (
              <button key={p.name} onClick={(e) => { onLoad(p); closeMenu(e.currentTarget); }}>{p.name}</button>
            ))}
          </div>
        </details>
        <details className="menu">
          <summary className="btn">Load / Save</summary>
          <div className="menu-list">
            <button onClick={(e) => { onSave(); closeMenu(e.currentTarget); }}>Save current…</button>
            <button onClick={(e) => { fileRef.current?.click(); closeMenu(e.currentTarget); }}>Open config file…</button>
            {saved.length > 0 && <div className="menu-sep">Saved configurations</div>}
            {saved.map((s) => (
              <div key={s.name} className="menu-row">
                <button onClick={(e) => { onLoad(s); closeMenu(e.currentTarget); }}>{s.name}</button>
                <button className="icon" aria-label={`Delete ${s.name}`} onClick={() => onDeleteSaved(s.name)}>×</button>
              </div>
            ))}
          </div>
        </details>
        <details className="menu">
          <summary className="btn">Export</summary>
          <div className="menu-list">
            <button disabled={!canExport} onClick={(e) => { onExport('pdf'); closeMenu(e.currentTarget); }}>PDF report (print)</button>
            <button disabled={!canExport} onClick={(e) => { onExport('csv'); closeMenu(e.currentTarget); }}>CSV report</button>
            <button onClick={(e) => { onExport('json'); closeMenu(e.currentTarget); }}>Config file (JSON)</button>
            <button onClick={(e) => { onExport('link'); closeMenu(e.currentTarget); }}>Copy share link</button>
          </div>
        </details>
        <button className="btn" onClick={onLibrary}>Library</button>
        <div className="seg" role="group" aria-label="Units">
          <button className={prefs.units === 'metric' ? 'active' : ''} onClick={() => onPrefs({ ...prefs, units: 'metric' })}>Metric</button>
          <button className={prefs.units === 'imperial' ? 'active' : ''} onClick={() => onPrefs({ ...prefs, units: 'imperial' })}>Imperial</button>
        </div>
        <button className="btn icon-btn" aria-label="Toggle dark/light theme" title="Toggle theme" onClick={() => onPrefs({ ...prefs, theme: prefs.theme === 'dark' ? 'light' : 'dark' })}>
          {prefs.theme === 'dark' ? '☀' : '☾'}
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { if (e.target.files?.[0]) onImportConfig(e.target.files[0]); e.target.value = ''; }} />
      </nav>
    </header>
  );
}
