import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentKind, Library } from './data/components';
import { DEFAULT_CONFIG } from './data/presets';
import type { Config, Results } from './engine/types';
import { download, reportCsv, slug } from './lib/exporters';
import { configFromHash, decodeConfig, shareUrl } from './lib/share';
import {
  loadCurrent,
  emptyLibrary,
  loadCustomLibrary,
  loadPrefs,
  loadSavedConfigs,
  mergedLibrary,
  storeCurrent,
  storeCustomLibrary,
  storePrefs,
  storeSavedConfigs,
  type Prefs,
} from './lib/storage';
import type { Snapshot } from './ui/Charts';
import { applyPart } from './ui/applyPart';
import { ConfigPanel } from './ui/ConfigPanel';
import { UnitsContext } from './ui/context';
import { HelpDialog, type HelpTab } from './ui/HelpDialog';
import { LibraryDialog } from './ui/LibraryDialog';
import { OptimizerPanel } from './ui/OptimizerPanel';
import { ResultsPanel } from './ui/ResultsPanel';
import { TopBar, type FileAction, type View } from './ui/TopBar';
import { makeBackup, openTextFile, parseHoverLabFile, saveTextFile, type FileHandle } from './lib/files';
import { simEngine } from './worker/engineClient';
import { LangContext, detectLang, dirOf, isLang, setLang, t, tName, type Lang } from './i18n';
import type { Msg } from './engine/types';

const SNAPSHOT_COLORS = ['var(--series-2)', 'var(--series-3)', 'var(--series-4)'];

function initialConfig(): Config {
  return configFromHash(location.hash) ?? loadCurrent() ?? DEFAULT_CONFIG;
}

export default function App() {
  const [config, setConfig] = useState<Config>(initialConfig);
  const [results, setResults] = useState<Results | null>(null);
  const [errors, setErrors] = useState<Msg[]>([]);
  const [prefs, setPrefs] = useState<Prefs>(() => {
    const p = loadPrefs();
    const q = new URLSearchParams(location.search).get('lang');
    return { ...p, lang: isLang(q) ? q : (p.lang ?? detectLang()) };
  });
  const lang: Lang = prefs.lang ?? 'en';
  // Set before children render so plain functions (insights, units) translate too.
  setLang(lang);
  const [saved, setSaved] = useState<Config[]>(loadSavedConfigs);
  const [custom, setCustom] = useState<Library>(loadCustomLibrary);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [libraryOpen, setLibraryOpen] = useState<{ kind: ComponentKind; model: string | null } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const reqRef = useRef(0);
  const [helpTab, setHelpTab] = useState<HelpTab | null>(null);
  const [view, setView] = useState<View>(() => (location.hash === '#optimizer' ? 'optimizer' : 'calc'));

  const library = useMemo(() => mergedLibrary(custom), [custom]);

  // Live recalculation in the worker; only the newest request is applied.
  useEffect(() => {
    const id = ++reqRef.current;
    simEngine.simulate(config).then((out) => {
      if (id !== reqRef.current) return;
      if (out.ok) {
        setResults(out.results);
        setErrors([]);
      } else {
        setResults(null);
        setErrors(out.errorMsgs);
      }
    });
    storeCurrent(config);
  }, [config]);

  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme;
    document.documentElement.lang = lang;
    document.documentElement.dir = dirOf(lang);
    document.title = t('HoverLab — quadcopter calculator');
    storePrefs(prefs);
  }, [prefs]);

  useEffect(() => {
    if (location.hash.includes('cfg=')) history.replaceState(null, '', location.pathname + location.search);
  }, []);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }, []);

  const load = (c: Config) => setConfig(structuredClone(c));

  const save = () => {
    const name = window.prompt(t('Save configuration as'), config.name)?.trim();
    if (!name) return;
    const next = [{ ...config, name }, ...saved.filter((s) => s.name !== name)];
    setSaved(next);
    storeSavedConfigs(next);
    setConfig({ ...config, name });
    notify(t('Saved “{name}”', { name }));
  };

  const deleteSaved = (name: string) => {
    const next = saved.filter((s) => s.name !== name);
    setSaved(next);
    storeSavedConfigs(next);
  };

  // Design files on the user's computer. The handle lets plain Save overwrite the same file.
  const [fileHandle, setFileHandle] = useState<FileHandle | null>(null);

  const saveToPc = async (asNew: boolean) => {
    try {
      const h = await saveTextFile(JSON.stringify(config, null, 2), `${slug(config.name)}.hoverlab.json`, asNew ? null : fileHandle);
      if (h === undefined) return;
      if (h) setFileHandle(h);
      notify(h ? t('Saved to {name}', { name: h.name }) : t('Downloaded {name}', { name: `${slug(config.name)}.hoverlab.json` }));
    } catch (e) {
      notify(t('Could not save the file: {error}', { error: String(e) }));
    }
  };

  const backupToPc = async () => {
    const stamp = new Date().toISOString().slice(0, 10);
    try {
      const h = await saveTextFile(JSON.stringify(makeBackup(config, saved, custom), null, 2), `hoverlab-backup-${stamp}.json`);
      if (h !== undefined) notify(t('Backup saved: {n} designs, {m} custom parts', { n: saved.length, m: Object.values(custom).flat().length }));
    } catch (e) {
      notify(t('Could not save the file: {error}', { error: String(e) }));
    }
  };

  const importText = (text: string, name: string, handle: FileHandle | null) => {
    const parsed = parseHoverLabFile(text);
    if (parsed?.kind === 'design') {
      load(parsed.config);
      setFileHandle(handle);
      notify(t('Loaded {name}', { name }));
    } else if (parsed?.kind === 'backup') {
      const b = parsed.backup;
      const names = new Set(b.saved.map((x) => x.name));
      const nextSaved = [...b.saved, ...saved.filter((x) => !names.has(x.name))];
      setSaved(nextSaved);
      storeSavedConfigs(nextSaved);
      const merged = emptyLibrary();
      for (const k of Object.keys(merged) as (keyof Library)[]) {
        const ids = new Set(b.custom[k].map((x) => x.id));
        (merged[k] as unknown[]) = [...b.custom[k], ...custom[k].filter((x) => !ids.has(x.id))];
      }
      updateCustom(merged);
      load(b.current);
      setFileHandle(null);
      notify(t('Restored {n} designs and {m} custom parts', { n: b.saved.length, m: Object.values(b.custom).flat().length }));
    } else {
      const shared = decodeConfig(text.trim());
      if (shared) {
        load(shared);
        notify(t('Loaded {name}', { name }));
      } else notify(t('That file is not a HoverLab configuration'));
    }
  };

  const openFromPc = async () => {
    try {
      const f = await openTextFile();
      if (f) importText(f.text, f.name, f.handle);
    } catch (e) {
      notify(t('Could not open the file: {error}', { error: String(e) }));
    }
  };

  const onFile = (action: FileAction) => {
    if (action === 'save') void saveToPc(false);
    else if (action === 'saveAs') void saveToPc(true);
    else if (action === 'open' || action === 'restore') void openFromPc();
    else if (action === 'backup') void backupToPc();
    else if (action === 'browser') save();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 's') {
        e.preventDefault();
        void saveToPc(e.shiftKey);
      } else if (k === 'o') {
        e.preventDefault();
        void openFromPc();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const exportAs = async (kind: 'csv' | 'pdf' | 'json' | 'link') => {
    if (kind === 'json') download(`${slug(config.name)}.hoverlab.json`, JSON.stringify(config, null, 2), 'application/json');
    else if (kind === 'csv' && results) download(`${slug(config.name)}-report.csv`, reportCsv(config, results), 'text/csv');
    else if (kind === 'pdf') window.print();
    else if (kind === 'link') {
      const url = shareUrl(config);
      try {
        await navigator.clipboard.writeText(url);
        notify(t('Share link copied to clipboard'));
      } catch {
        window.prompt(t('Copy this link'), url);
      }
    }
  };

  const snapshot = () => {
    if (!results || snapshots.length >= 3) return;
    const used = new Set(snapshots.map((s) => s.color));
    const color = SNAPSHOT_COLORS.find((c) => !used.has(c)) ?? SNAPSHOT_COLORS[0];
    setSnapshots([...snapshots, { id: `s${Date.now()}`, name: config.name ? tName(config.name) : t('Config {n}', { n: snapshots.length + 1 }), color, results }]);
  };

  const updateCustom = (l: Library) => {
    setCustom(l);
    storeCustomLibrary(l);
  };

  return (
    <LangContext.Provider value={lang}>
    <UnitsContext.Provider value={prefs.units}>
      <div className="app">
        <TopBar
          view={view}
          onView={(v) => {
            setView(v);
            history.replaceState(null, '', v === 'optimizer' ? '#optimizer' : location.pathname + location.search);
            window.scrollTo(0, 0);
          }}
          config={config}
          saved={saved}
          prefs={prefs}
          canExport={!!results}
          onLoad={load}
          onDeleteSaved={deleteSaved}
          onFile={onFile}
          fileName={fileHandle?.name ?? null}
          onExport={exportAs}
          onLibrary={() => setLibraryOpen({ kind: 'motor', model: null })}
          onHelp={setHelpTab}
          onPrefs={setPrefs}
        />
        <main className="optimizer-view" hidden={view !== 'optimizer'}>
          <OptimizerPanel
            config={config}
            results={results}
            onApply={(c) => {
              load(c);
              setView('calc');
              history.replaceState(null, '', location.pathname + location.search);
              notify(t('Applied {name}', { name: tName(c.name) }));
            }}
          />
        </main>
        <main className="workspace" hidden={view !== 'calc'}>
          <aside className="left">
            <ConfigPanel config={config} library={library} auw={results?.auw ?? null} onChange={setConfig} onDefine={(kind, query) => setLibraryOpen({ kind, model: query })} />
          </aside>
          <section className="right">
            <div className="print-only print-header">
              <h1>{t('HoverLab report — {name}', { name: tName(config.name) })}</h1>
              <p>{t('Generated {date}', { date: new Date().toLocaleString(lang === 'en' ? undefined : lang) })}</p>
            </div>
            <ResultsPanel
              config={config}
              results={results}
              errors={errors}
              snapshots={snapshots}
              onSnapshot={snapshot}
              onRemoveSnapshot={(id) => setSnapshots(snapshots.filter((s) => s.id !== id))}
            />
          </section>
        </main>
        <footer className="footer muted small">
          {t('Estimates within typical ±10–15 % of bench data when motor and prop constants are accurate. Always verify against manufacturer data before flight.')}
        </footer>
        {libraryOpen && (
          <LibraryDialog
            library={library}
            custom={custom}
            config={config}
            initialKind={libraryOpen.kind}
            initialModel={libraryOpen.model}
            onChangeCustom={updateCustom}
            onUse={(kind, part) => {
              setConfig((c) => applyPart(c, kind, part));
              notify(t('Using {name}', { name: `${part.brand} ${part.model}` }));
            }}
            onClose={() => setLibraryOpen(null)}
          />
        )}
        {helpTab && <HelpDialog initial={helpTab} onClose={() => setHelpTab(null)} />}
        {toast && <div className="toast" role="status">{toast}</div>}
      </div>
    </UnitsContext.Provider>
    </LangContext.Provider>
  );
}
