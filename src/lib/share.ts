import type { Config } from '../engine/types';

// Shareable links carry the whole configuration in the URL hash, base64url-encoded,
// so nothing is sent to a server.

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodeConfig(c: Config): string {
  return toBase64Url(JSON.stringify(c));
}

export function decodeConfig(s: string): Config | null {
  try {
    const c = JSON.parse(fromBase64Url(s)) as Config;
    return c && c.motor && c.prop && c.battery && c.frame && c.esc && c.env ? c : null;
  } catch {
    return null;
  }
}

export function shareUrl(c: Config): string {
  const base = location.href.split('#')[0];
  return `${base}#cfg=${encodeConfig(c)}`;
}

export function configFromHash(hash: string): Config | null {
  const m = /cfg=([A-Za-z0-9_-]+)/.exec(hash);
  return m ? decodeConfig(m[1]) : null;
}
