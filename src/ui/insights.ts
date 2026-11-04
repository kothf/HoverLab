import { MOTOR_TEMP_LIMIT, PRACTICAL_HOVER_THROTTLE, PRACTICAL_TW } from '../engine/simulate';
import type { Config, Results } from '../engine/types';
import { t } from '../i18n';
import { fmt, fmtNum, type UnitSystem } from '../lib/units';

export type InsightTone = 'good' | 'info' | 'tip' | 'caution';

export interface Insight {
  code: string;
  tone: InsightTone;
  title: string;
  text: string;
}

const pct = (x: number) => `${Math.round(x * 100)} %`;

/** How close each part runs to its limit (1 = at the limit), used to name the bottleneck. */
export function loads(c: Config, r: Results): { label: string; load: number; detail: string }[] {
  const out = [
    { label: 'battery', load: r.max.cRate / c.battery.cRating, detail: t('{a} of {b}', { a: `${fmtNum(r.max.cRate, 1)}C`, b: `${c.battery.cRating}C` }) },
    { label: 'motors', load: r.max.motorCurrent / c.motor.maxCurrent, detail: t('{a} of {b}', { a: `${fmtNum(r.max.motorCurrent, 1)} ${t('A')}`, b: `${c.motor.maxCurrent} ${t('A')}` }) },
    { label: 'ESCs', load: r.max.motorCurrent / c.esc.maxCurrent, detail: t('{a} of {b}', { a: `${fmtNum(r.max.motorCurrent, 1)} ${t('A')}`, b: `${c.esc.maxCurrent} ${t('A')}` }) },
    {
      label: 'motor cooling',
      load: (r.motorTempMax - c.env.temperature) / Math.max(MOTOR_TEMP_LIMIT - c.env.temperature, 1),
      detail: t('{a} of {b}', { a: `${Math.round(r.motorTempMax)} °C`, b: `${MOTOR_TEMP_LIMIT} °C` }),
    },
  ];
  if (r.hover) out.push({ label: 'hover throttle', load: r.hover.throttle / PRACTICAL_HOVER_THROTTLE, detail: t('{a} of {b}', { a: pct(r.hover.throttle), b: pct(PRACTICAL_HOVER_THROTTLE) }) });
  return out.sort((a, b) => b.load - a.load);
}

/** Plain-language conclusions drawn from one simulation: what the build is for, what limits it, what to change. */
export function deriveInsights(c: Config, r: Results, system: UnitSystem): Insight[] {
  const out: Insight[] = [];
  const h = r.hover;
  const mass = (g: number) => fmt(system, 'mass', g);

  // 1. Verdict: what the build is good for and which part limits it.
  if (!h) {
    out.push({ code: 'verdict', tone: 'caution', title: t('Verdict'), text: t('The craft cannot hover. Add thrust (larger props, higher Kv or more cells) or cut weight.') });
  } else {
    let role: string;
    const hov = fmtNum(r.hoverTime, 1);
    const mix = fmtNum(r.mixedTime, 1);
    const payloadShare = c.frame.payload / r.auw;
    if (r.thrustToWeight >= PRACTICAL_TW && payloadShare >= 0.2)
      role = t('Payload carrier: {m} on board ({share} of take-off weight), {h} min hover, {x} min mixed.', { m: mass(c.frame.payload), share: pct(payloadShare), h: hov, x: mix });
    else if (r.thrustToWeight >= 5) role = t('Agile build with a large power reserve (freestyle, racing, cinewhoop). Plan on the mixed flight time ({x} min), not the hover time.', { x: mix });
    else if (r.thrustToWeight >= PRACTICAL_TW && r.hoverTime >= 20) role = t('Endurance build: {h} min hover, {x} min mixed.', { h: hov, x: mix });
    else if (r.thrustToWeight >= PRACTICAL_TW) role = t('General-purpose build for camera work and steady cruising: {h} min hover, {x} min mixed.', { h: hov, x: mix });
    else role = t('Marginal thrust: fly only in calm air and avoid fast descents.');
    const top = loads(c, r)[0];
    const limit = ' ' + (top.load >= 0.6 ? t('The tightest margin is the {part} ({detail}).', { part: top.label, detail: top.detail }) : t('Nothing runs near its limit; the tightest margin is the {part} ({detail}).', { part: top.label, detail: top.detail }));
    const tone: InsightTone = r.warnings.length ? 'caution' : r.thrustToWeight >= PRACTICAL_TW ? 'good' : 'caution';
    out.push({ code: 'verdict', tone, title: t('Verdict'), text: role + limit });
  }

  // 2. Payload: what can really be carried, and what each gram costs.
  if (h) {
    const cost = r.payloadCost * 60;
    const costText = cost > 0 ? ' ' + t('Every extra {m} costs about {s} s of hover time.', { m: mass(100), s: fmtNum(cost) }) : '';
    out.push(
      r.practicalPayload > 0
        ? {
            code: 'payload',
            tone: 'info',
            title: t('Payload'),
            text: t('You can add about {m} and keep thrust/weight ≥ {tw} and hover throttle ≤ {thr}. The max extra payload ({max}) only just lifts off at 80 % throttle.', { m: mass(r.practicalPayload), tw: PRACTICAL_TW, thr: pct(PRACTICAL_HOVER_THROTTLE), max: mass(r.maxPayload) }) + costText,
          }
        : { code: 'payload', tone: 'caution', title: t('Payload'), text: t('No room for extra payload without losing control margin.') + costText },
    );
  }

  // 3. Matching: motor vs prop, ESC sizing, battery share.
  if (h && r.optimum.motorEfficiency - h.motorEfficiency >= 0.08) {
    out.push({
      code: 'motor-match',
      tone: 'tip',
      title: t('Motor match'),
      text: t('Motors are sized for punch: {a} efficient in hover against a {b} peak at {c} % throttle. Fine for freestyle; for longer flights pick a lower Kv or a larger prop so hover moves toward the peak.', { a: pct(h.motorEfficiency), b: pct(r.optimum.motorEfficiency), c: Math.round(r.optimum.throttle * 100) }),
    });
  }
  const escLoad = r.max.motorCurrent / c.esc.maxCurrent;
  if (escLoad < 0.35) {
    out.push({
      code: 'esc-oversized',
      tone: 'tip',
      title: t('ESC sizing'),
      text: t('ESCs are rated {a} A but see at most {b} A ({c}). ESCs rated about {d} A would do and save weight (now {m} in total).', { a: c.esc.maxCurrent, b: fmtNum(r.max.motorCurrent, 1), c: pct(escLoad), d: Math.ceil((r.max.motorCurrent * 1.3) / 5) * 5, m: mass(r.weights.escs) }),
    });
  }
  const batShare = r.weights.battery / r.auw;
  if (batShare > 0.65) {
    out.push({
      code: 'battery-share',
      tone: 'tip',
      title: t('Battery share'),
      text: t('The battery is {a} of take-off weight. Past about 65 % more capacity buys less and less time, and the craft gets sluggish.', { a: pct(batShare) }),
    });
  }

  // 4. Model limits worth knowing for this build.
  if (r.range && r.range.speed >= 0.98 * r.maxSpeed) {
    out.push({
      code: 'range-cap',
      tone: 'caution',
      title: t('Range estimate'),
      text: t('Best range came out at top speed ({v}), which the model caps below pitch speed. Treat the range as a rough figure.', { v: fmt(system, 'speed', r.maxSpeed) }),
    });
  }
  return out;
}
