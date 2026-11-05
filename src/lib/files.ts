import type { Library } from '../data/components';
import type { Config } from '../engine/types';
import { download } from './exporters';

// Saving designs as files on the user's computer. Chromium browsers get the File System Access API
// (real Save / Save as with a remembered file); others fall back to a download and a file input.

interface PickerType {
  description: string;
  accept: Record<string, string[]>;
}
interface WritableFile {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}
export interface FileHandle {
  name: string;
  createWritable(): Promise<WritableFile>;
  getFile(): Promise<File>;
}
interface FsWindow {
  showSaveFilePicker?: (o: { suggestedName?: string; types?: PickerType[] }) => Promise<FileHandle>;
  showOpenFilePicker?: (o: { multiple?: boolean; types?: PickerType[] }) => Promise<FileHandle[]>;
}

const TYPES: PickerType[] = [{ description: 'HoverLab design', accept: { 'application/json': ['.json'] } }];
const fsw = () => window as unknown as FsWindow;

export const canPickFiles = () => typeof window !== 'undefined' && !!fsw().showSaveFilePicker;

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

/**
 * Writes text to a file. Reuses `handle` when given (plain Save), otherwise asks where to save.
 * Returns the handle to remember, null when the browser fell back to a download, or undefined if
 * the user cancelled.
 */
export async function saveTextFile(text: string, suggestedName: string, handle?: FileHandle | null): Promise<FileHandle | null | undefined> {
  const picker = fsw().showSaveFilePicker;
  if (!picker) {
    download(suggestedName, text, 'application/json');
    return null;
  }
  try {
    const h = handle ?? (await picker({ suggestedName, types: TYPES }));
    const w = await h.createWritable();
    await w.write(text);
    await w.close();
    return h;
  } catch (e) {
    if (isAbort(e)) return undefined;
    throw e;
  }
}

/** Asks for a file to open. Returns its text, name and (where supported) a handle for later saves. */
export async function openTextFile(): Promise<{ text: string; name: string; handle: FileHandle | null } | undefined> {
  const picker = fsw().showOpenFilePicker;
  if (picker) {
    try {
      const [h] = await picker({ types: TYPES });
      const f = await h.getFile();
      return { text: await f.text(), name: f.name, handle: h };
    } catch (e) {
      if (isAbort(e)) return undefined;
      throw e;
    }
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const f = input.files?.[0];
      resolve(f ? { text: await f.text(), name: f.name, handle: null } : undefined);
    };
    input.click();
  });
}

export interface Backup {
  type: 'hoverlab-backup';
  version: 1;
  savedAt: string;
  current: Config;
  saved: Config[];
  custom: Library;
}

export function makeBackup(current: Config, saved: Config[], custom: Library): Backup {
  return { type: 'hoverlab-backup', version: 1, savedAt: new Date().toISOString(), current, saved, custom };
}

const isConfig = (x: unknown): x is Config => {
  const c = x as Config;
  return !!c && typeof c === 'object' && !!c.motor && !!c.prop && !!c.battery && !!c.frame;
};

/** Reads a design file or a full backup. */
export function parseHoverLabFile(text: string): { kind: 'design'; config: Config } | { kind: 'backup'; backup: Backup } | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  const b = data as Backup;
  if (b && b.type === 'hoverlab-backup' && isConfig(b.current) && Array.isArray(b.saved)) {
    return { kind: 'backup', backup: { ...b, saved: b.saved.filter(isConfig), custom: b.custom ?? { motor: [], prop: [], battery: [], esc: [], frame: [] } } };
  }
  return isConfig(data) ? { kind: 'design', config: data } : null;
}
