import { useRef } from 'react';
import { PRESETS } from '../data/presets';
import type { Config } from '../engine/types';
import type { Prefs } from '../lib/storage';
import { Icon } from './Icons';
import { LANGS, tName, useT, type Lang } from '../i18n';

export type View = 'calc' | 'optimizer';

interface Props {
  view: View;
  onView: (v: View) => void;
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
  onHelp: (tab: 'start' | 'about') => void;
  onPrefs: (p: Prefs) => void;
}

function closeMenu(el: HTMLElement) {
  el.closest('details')?.removeAttribute('open');
}

export function TopBar({ view, onView, config, saved, prefs, canExport, onLoad, onSave, onDeleteSaved, onImportConfig, onExport, onLibrary, onHelp, onPrefs }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const t = useT();
  return (
    <header className="topbar">
      <div className="brand">
        <img src="./icon.svg" alt="" width={28} height={28} />
        <span>HoverLab</span>
        <span className="app-version" title={t('HoverLab version')}>v{__APP_VERSION__}</span>
        <span className="config-name" title={t('Current configuration')}>{tName(config.name)}</span>
      </div>
      <div className="view-tabs" role="tablist" aria-label={t('Mode')}>
        <button role="tab" aria-selected={view === 'calc'} className={view === 'calc' ? 'active' : ''} onClick={() => onView('calc')}>
          <Icon name="frame" size={16} /> {t('Calculator')}
        </button>
        <button role="tab" aria-selected={view === 'optimizer'} className={view === 'optimizer' ? 'active' : ''} onClick={() => onView('optimizer')}>
          <Icon name="optimizer" size={16} /> {t('Design optimizer')}
        </button>
      </div>
      <nav className="actions">
        <details className="menu">
          <summary className="btn">{t('Presets')}</summary>
          <div className="menu-list">
            {PRESETS.map((p) => (
              <button key={p.name} onClick={(e) => { onLoad(p); closeMenu(e.currentTarget); }}>{t(p.name)}</button>
            ))}
          </div>
        </details>
        <details className="menu">
          <summary className="btn">{t('Load / Save')}</summary>
          <div className="menu-list">
            <button onClick={(e) => { onSave(); closeMenu(e.currentTarget); }}>{t('Save current…')}</button>
            <button onClick={(e) => { fileRef.current?.click(); closeMenu(e.currentTarget); }}>{t('Open config file…')}</button>
            {saved.length > 0 && <div className="menu-sep">{t('Saved configurations')}</div>}
            {saved.map((s) => (
              <div key={s.name} className="menu-row">
                <button onClick={(e) => { onLoad(s); closeMenu(e.currentTarget); }}>{tName(s.name)}</button>
                <button className="icon" aria-label={t('Delete {name}', { name: s.name })} onClick={() => onDeleteSaved(s.name)}>×</button>
              </div>
            ))}
          </div>
        </details>
        <details className="menu">
          <summary className="btn">{t('Export')}</summary>
          <div className="menu-list">
            <button disabled={!canExport} onClick={(e) => { onExport('pdf'); closeMenu(e.currentTarget); }}>{t('PDF report (print)')}</button>
            <button disabled={!canExport} onClick={(e) => { onExport('csv'); closeMenu(e.currentTarget); }}>{t('CSV report')}</button>
            <button onClick={(e) => { onExport('json'); closeMenu(e.currentTarget); }}>{t('Config file (JSON)')}</button>
            <button onClick={(e) => { onExport('link'); closeMenu(e.currentTarget); }}>{t('Copy share link')}</button>
          </div>
        </details>
        <button className="btn" onClick={onLibrary}>
          <Icon name="library" size={16} /> {t('Library')}
        </button>
        <details className="menu">
          <summary className="btn" aria-label={t('Help and about')}>? {t('Help')}</summary>
          <div className="menu-list">
            <button onClick={(e) => { onHelp('start'); closeMenu(e.currentTarget); }}>{t('User guide')}</button>
            <button onClick={(e) => { onHelp('about'); closeMenu(e.currentTarget); }}>{t('About & credits')}</button>
          </div>
        </details>
        <div className="seg" role="group" aria-label={t('Units')}>
          <button className={prefs.units === 'metric' ? 'active' : ''} onClick={() => onPrefs({ ...prefs, units: 'metric' })}>{t('Metric')}</button>
          <button className={prefs.units === 'imperial' ? 'active' : ''} onClick={() => onPrefs({ ...prefs, units: 'imperial' })}>{t('Imperial')}</button>
        </div>
        <button className="btn icon-btn" aria-label={t('Toggle dark/light theme')} title={t('Toggle theme')} onClick={() => onPrefs({ ...prefs, theme: prefs.theme === 'dark' ? 'light' : 'dark' })}>
          {prefs.theme === 'dark' ? '☀' : '☾'}
        </button>
        <select className="lang-select" aria-label={t('Language')} title={t('Language')} value={prefs.lang ?? 'en'} onChange={(e) => onPrefs({ ...prefs, lang: e.target.value as Lang })}>
          {LANGS.map((l) => (
            <option key={l.code} value={l.code} lang={l.code}>
              {l.label}
            </option>
          ))}
        </select>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { if (e.target.files?.[0]) onImportConfig(e.target.files[0]); e.target.value = ''; }} />
      </nav>
    </header>
  );
}
