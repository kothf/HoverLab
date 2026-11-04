import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentKind, Library } from './data/components';
import { DEFAULT_CONFIG } from './data/presets';
import type { Config, Results } from './engine/types';
import { download, reportCsv, slug } from './lib/exporters';
import { configFromHash, decodeConfig, shareUrl } from './lib/share';
import {
  loadCurrent,
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
import { TopBar, type View } from './ui/TopBar';
import { simEngine } from './worker/engineClient';

const SNAPSHOT_COLORS = ['var(--series-2)', 'var(--series-3)', 'var(--series-4)'];

function initialConfig(): Config {
  return configFromHash(location.hash) ?? loadCurrent() ?? DEFAULT_CONFIG;
}

export default function App() {
  const [config, setConfig] = useState<Config>(initialConfig);
  const [results, setResults] = useState<Results | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
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
        setErrors(out.errors);
      }
    });
    storeCurrent(config);
  }, [config]);

  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme;
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
    const name = window.prompt('Save configuration as', config.name)?.trim();
    if (!name) return;
    const next = [{ ...config, name }, ...saved.filter((s) => s.name !== name)];
    setSaved(next);
    storeSavedConfigs(next);
    setConfig({ ...config, name });
    notify(`Saved “${name}”`);
  };

  const deleteSaved = (name: string) => {
    const next = saved.filter((s) => s.name !== name);
    setSaved(next);
    storeSavedConfigs(next);
  };

  const importConfig = async (file: File) => {
    const text = await file.text();
    let c: Config | null = null;
    try {
      c = JSON.parse(text) as Config;
    } catch {
      c = decodeConfig(text.trim());
    }
    if (c && c.motor && c.prop && c.battery) {
      load(c);
      notify(`Loaded ${file.name}`);
    } else notify('That file is not a HoverLab configuration');
  };

  const exportAs = async (kind: 'csv' | 'pdf' | 'json' | 'link') => {
    if (kind === 'json') download(`${slug(config.name)}.hoverlab.json`, JSON.stringify(config, null, 2), 'application/json');
    else if (kind === 'csv' && results) download(`${slug(config.name)}-report.csv`, reportCsv(config, results), 'text/csv');
    else if (kind === 'pdf') window.print();
    else if (kind === 'link') {
      const url = shareUrl(config);
      try {
        await navigator.clipboard.writeText(url);
        notify('Share link copied to clipboard');
      } catch {
        window.prompt('Copy this link', url);
      }
    }
  };

  const snapshot = () => {
    if (!results || snapshots.length >= 3) return;
    const used = new Set(snapshots.map((s) => s.color));
    const color = SNAPSHOT_COLORS.find((c) => !used.has(c)) ?? SNAPSHOT_COLORS[0];
    setSnapshots([...snapshots, { id: `s${Date.now()}`, name: config.name || `Config ${snapshots.length + 1}`, color, results }]);
  };

  const updateCustom = (l: Library) => {
    setCustom(l);
    storeCustomLibrary(l);
  };

  return (
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
          onSave={save}
          onDeleteSaved={deleteSaved}
          onImportConfig={importConfig}
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
              notify(`Applied ${c.name}`);
            }}
          />
        </main>
        <main className="workspace" hidden={view !== 'calc'}>
          <aside className="left">
            <ConfigPanel config={config} library={library} auw={results?.auw ?? null} onChange={setConfig} onDefine={(kind, query) => setLibraryOpen({ kind, model: query })} />
          </aside>
          <section className="right">
            <div className="print-only print-header">
              <h1>HoverLab report — {config.name}</h1>
              <p>Generated {new Date().toLocaleString()}</p>
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
          Estimates within typical ±10–15 % of bench data when motor and prop constants are accurate. Always verify against manufacturer data before flight.
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
              notify(`Using ${part.brand} ${part.model}`);
            }}
            onClose={() => setLibraryOpen(null)}
          />
        )}
        {helpTab && <HelpDialog initial={helpTab} onClose={() => setHelpTab(null)} />}
        {toast && <div className="toast" role="status">{toast}</div>}
      </div>
    </UnitsContext.Provider>
  );
}
