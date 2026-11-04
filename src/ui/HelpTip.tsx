import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { helpText, useT } from '../i18n';

const WIDTH = 280;
const GAP = 6;

/**
 * Small "?" button that explains a parameter on hover, keyboard focus or tap. The bubble is
 * fixed-positioned and clamped to the viewport so scrolling panels never clip it.
 */
export function HelpTip({ topic, text }: { topic?: string; text?: string }) {
  const t = useT();
  const body = text ?? (topic ? helpText(topic) : undefined);
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  const ref = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();
  const open = pinned || hover;

  useEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const width = Math.min(WIDTH, window.innerWidth - 16);
    const left = Math.max(8, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 8));
    const below = r.bottom + GAP;
    const placeAbove = below + 160 > window.innerHeight && r.top > 200;
    setStyle(placeAbove ? { left, width, bottom: window.innerHeight - r.top + GAP } : { left, width, top: below });
  }, [open]);

  useEffect(() => {
    if (!pinned) return;
    const close = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) setPinned(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setPinned(false);
    const hide = () => setPinned(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    window.addEventListener('scroll', hide, true);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', hide, true);
    };
  }, [pinned]);

  if (!body) return null;
  return (
    <span className="help" ref={ref} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button
        ref={btn}
        type="button"
        className="help-btn"
        aria-label={t('Help: {topic}', { topic: topic ?? 'details' })}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setPinned((p) => !p);
        }}
      >
        ?
      </button>
      {open && (
        <span role="tooltip" id={id} className="help-bubble" style={style}>
          {body}
        </span>
      )}
    </span>
  );
}
