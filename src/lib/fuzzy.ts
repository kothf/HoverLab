/**
 * Small fuzzy matcher for component search: every query token must appear in the haystack,
 * either as a substring or as an in-order subsequence. Substring and word-start hits score higher.
 */
export function fuzzyScore(haystack: string, query: string): number {
  const h = haystack.toLowerCase();
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return 1;
  let score = 0;
  for (const t of tokens) {
    const idx = h.indexOf(t);
    if (idx >= 0) {
      score += 10 + (idx === 0 || /[\s\-x(]/.test(h[idx - 1]) ? 5 : 0);
      continue;
    }
    let pos = 0;
    for (const ch of t) {
      pos = h.indexOf(ch, pos);
      if (pos < 0) return 0;
      pos++;
    }
    score += 2;
  }
  return score;
}

export function fuzzyFilter<T>(items: T[], query: string, text: (t: T) => string, limit = 50): T[] {
  if (!query.trim()) return items.slice(0, limit);
  return items
    .map((it) => ({ it, s: fuzzyScore(text(it), query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.it);
}
