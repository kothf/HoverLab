import { PRESETS } from '../data/presets';
import type { Config } from '../engine/types';
import type { Prefs } from '../lib/storage';
import { Icon } from './Icons';
import { LANGS, tName, useT, type Lang } from '../i18n';

export type View = 'calc' | 'optimizer';
export type FileAction = 'save' | 'saveAs' | 'open' | 'browser' | 'backup' | 'restore';

interface Props {
  view: View;
  onView: (v: View) => void;
  config: Config;
  saved: Config[];
  prefs: Prefs;
  canExport: boolean;
  onLoad: (c: Config) => void;
  onDeleteSaved: (name: string) => void;
  onFile: (action: FileAction) => void;
  fileName: string | null;
  onExport: (kind: 'csv' | 'pdf' | 'json' | 'link') => void;
  onLibrary: () => void;
  onHelp: (tab: 'start' | 'about') => void;
  onPrefs: (p: Prefs) => void;
}

function closeMenu(el: HTMLElement) {
  el.closest('details')?.removeAttribute('open');
}

export function TopBar({ view, onView, config, saved, prefs, canExport, onLoad, onDeleteSaved, onFile, fileName, onExport, onLibrary, onHelp, onPrefs }: Props) {
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
            <div className="menu-sep">{t('On this computer')}</div>
            <button onClick={(e) => { onFile('save'); closeMenu(e.currentTarget); }}>
              {fileName ? t('Save to {name}', { name: fileName }) : t('Save to file…')} <kbd>Ctrl+S</kbd>
            </button>
            <button onClick={(e) => { onFile('saveAs'); closeMenu(e.currentTarget); }}>{t('Save as new file…')} <kbd>Ctrl+Shift+S</kbd></button>
            <button onClick={(e) => { onFile('open'); closeMenu(e.currentTarget); }}>{t('Open file…')} <kbd>Ctrl+O</kbd></button>
            <button onClick={(e) => { onFile('backup'); closeMenu(e.currentTarget); }}>{t('Back up everything to a file…')}</button>
            <button onClick={(e) => { onFile('restore'); closeMenu(e.currentTarget); }}>{t('Restore from backup file…')}</button>
            <div className="menu-sep">{t('In this browser')}</div>
            <button onClick={(e) => { onFile('browser'); closeMenu(e.currentTarget); }}>{t('Save in browser…')}</button>
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
      </nav>
    </header>
  );
}
