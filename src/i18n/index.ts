import { createContext, useContext } from 'react';
import { HELP } from '../ui/help';
import { HE, HELP_HE } from './he';
import { RU, HELP_RU } from './ru';

export type Lang = 'en' | 'ru' | 'he';
export type Vars = Record<string, string | number>;
/** A message that is translated where it is shown: an English template plus its values. */
export interface Msg {
  tpl: string;
  vars?: Vars;
}

export const LANGS: { code: Lang; label: string; dir: 'ltr' | 'rtl' }[] = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'ru', label: 'Русский', dir: 'ltr' },
  { code: 'he', label: 'עברית', dir: 'rtl' },
];

const DICTS: Record<Lang, Record<string, string>> = { en: {}, ru: RU, he: HE };
const HELPS: Record<Lang, Record<string, string>> = { en: HELP, ru: HELP_RU, he: HELP_HE };

let current: Lang = 'en';

export const isLang = (x: unknown): x is Lang => x === 'en' || x === 'ru' || x === 'he';

/** Language from ?lang=, else the browser language, else English. */
export function detectLang(): Lang {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (isLang(q)) return q;
    const nav = (navigator.languages?.[0] ?? navigator.language ?? '').slice(0, 2).toLowerCase();
    if (nav === 'iw') return 'he';
    if (isLang(nav)) return nav;
  } catch {
    /* not in a browser */
  }
  return 'en';
}

export function setLang(l: Lang) {
  current = l;
}
export const getLang = () => current;
export const dirOf = (l: Lang) => LANGS.find((x) => x.code === l)?.dir ?? 'ltr';

/** Fills {name} placeholders; string values are translated too, so labels inside messages follow the language. */
export function format(s: string, vars?: Vars, lang: Lang = current): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => {
    const v = vars[k];
    if (v === undefined) return m;
    return typeof v === 'string' ? (DICTS[lang][v] ?? v) : String(v);
  });
}

/** Translates an English UI string (the key) into the current language; unknown keys stay English. */
export function t(en: string, vars?: Vars, lang: Lang = current): string {
  return format(DICTS[lang][en] ?? en, vars, lang);
}

/** Display name of a preset or part: translated when it is a built-in name, with "(edited)" kept translated. */
export function tName(n?: string | null, lang: Lang = current): string {
  if (!n) return '';
  const edited = n.endsWith(' (edited)');
  const base = edited ? n.slice(0, -' (edited)'.length) : n;
  return t(base, undefined, lang) + (edited ? ` ${t('(edited)', undefined, lang)}` : '');
}

export const tm = (m: Msg, lang: Lang = current) => t(m.tpl, m.vars, lang);

/** Help bubble text for a topic (the English label) in the current language. */
export function helpText(topic: string, lang: Lang = current): string | undefined {
  return HELPS[lang][topic] ?? HELP[topic];
}

export const LangContext = createContext<Lang>('en');
/** Subscribes a component to language changes; returns the translator. */
export function useT() {
  useContext(LangContext);
  return t;
}

/** For tests: every key of each dictionary. */
export const DICTIONARIES = DICTS;
export const HELP_DICTIONARIES = HELPS;
