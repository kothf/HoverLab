import { MOTOR_TEMP_LIMIT, PRACTICAL_HOVER_THROTTLE, PRACTICAL_TW } from '../engine/simulate';
import type { Config, Results } from '../engine/types';
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
    { label: 'battery', load: r.max.cRate / c.battery.cRating, detail: `${fmtNum(r.max.cRate, 1)}C of ${c.battery.cRating}C` },
    { label: 'motors', load: r.max.motorCurrent / c.motor.maxCurrent, detail: `${fmtNum(r.max.motorCurrent, 1)} A of ${c.motor.maxCurrent} A` },
    { label: 'ESCs', load: r.max.motorCurrent / c.esc.maxCurrent, detail: `${fmtNum(r.max.motorCurrent, 1)} A of ${c.esc.maxCurrent} A` },
    {
      label: 'motor cooling',
      load: (r.motorTempMax - c.env.temperature) / Math.max(MOTOR_TEMP_LIMIT - c.env.temperature, 1),
      detail: `${Math.round(r.motorTempMax)} °C of ${MOTOR_TEMP_LIMIT} °C`,
    },
  ];
  if (r.hover) out.push({ label: 'hover throttle', load: r.hover.throttle / PRACTICAL_HOVER_THROTTLE, detail: `${pct(r.hover.throttle)} of ${pct(PRACTICAL_HOVER_THROTTLE)}` });
  return out.sort((a, b) => b.load - a.load);
}

/** Plain-language conclusions drawn from one simulation: what the build is for, what limits it, what to change. */
export function deriveInsights(c: Config, r: Results, system: UnitSystem): Insight[] {
  const out: Insight[] = [];
  const h = r.hover;
  const mass = (g: number) => fmt(system, 'mass', g);

  // 1. Verdict: what the build is good for and which part limits it.
  if (!h) {
    out.push({ code: 'verdict', tone: 'caution', title: 'Verdict', text: 'The craft cannot hover. Add thrust (larger props, higher Kv or more cells) or cut weight.' });
  } else {
    let role: string;
    const payloadShare = c.frame.payload / r.auw;
    if (r.thrustToWeight >= PRACTICAL_TW && payloadShare >= 0.2)
      role = `Payload carrier: ${mass(c.frame.payload)} on board (${pct(payloadShare)} of take-off weight), ${fmtNum(r.hoverTime, 1)} min hover, ${fmtNum(r.mixedTime, 1)} min mixed.`;
    else if (r.thrustToWeight >= 5) role = `Agile build with a large power reserve (freestyle, racing, cinewhoop). Plan on the mixed flight time (${fmtNum(r.mixedTime, 1)} min), not the hover time.`;
    else if (r.thrustToWeight >= PRACTICAL_TW && r.hoverTime >= 20) role = `Endurance build: ${fmtNum(r.hoverTime, 1)} min hover, ${fmtNum(r.mixedTime, 1)} min mixed.`;
    else if (r.thrustToWeight >= PRACTICAL_TW) role = `General-purpose build for camera work and steady cruising: ${fmtNum(r.hoverTime, 1)} min hover, ${fmtNum(r.mixedTime, 1)} min mixed.`;
    else role = 'Marginal thrust: fly only in calm air and avoid fast descents.';
    const top = loads(c, r)[0];
    const limit = top.load >= 0.6 ? ` The tightest margin is the ${top.label} (${top.detail}).` : ` Nothing runs near its limit; the tightest margin is the ${top.label} (${top.detail}).`;
    const tone: InsightTone = r.warnings.length ? 'caution' : r.thrustToWeight >= PRACTICAL_TW ? 'good' : 'caution';
    out.push({ code: 'verdict', tone, title: 'Verdict', text: role + limit });
  }

  // 2. Payload: what can really be carried, and what each gram costs.
  if (h) {
    const cost = r.payloadCost * 60;
    const costText = cost > 0 ? ` Every extra ${mass(100)} costs about ${fmtNum(cost)} s of hover time.` : '';
    out.push(
      r.practicalPayload > 0
        ? {
            code: 'payload',
            tone: 'info',
            title: 'Payload',
            text: `You can add about ${mass(r.practicalPayload)} and keep thrust/weight ≥ ${PRACTICAL_TW} and hover throttle ≤ ${pct(PRACTICAL_HOVER_THROTTLE)}. The max extra payload (${mass(r.maxPayload)}) only just lifts off at 80 % throttle.${costText}`,
          }
        : { code: 'payload', tone: 'caution', title: 'Payload', text: `No room for extra payload without losing control margin.${costText}` },
    );
  }

  // 3. Matching: motor vs prop, ESC sizing, battery share.
  if (h && r.optimum.motorEfficiency - h.motorEfficiency >= 0.08) {
    out.push({
      code: 'motor-match',
      tone: 'tip',
      title: 'Motor match',
      text: `Motors are sized for punch: ${pct(h.motorEfficiency)} efficient in hover against a ${pct(r.optimum.motorEfficiency)} peak at ${Math.round(r.optimum.throttle * 100)} % throttle. Fine for freestyle; for longer flights pick a lower Kv or a larger prop so hover moves toward the peak.`,
    });
  }
  const escLoad = r.max.motorCurrent / c.esc.maxCurrent;
  if (escLoad < 0.35) {
    out.push({
      code: 'esc-oversized',
      tone: 'tip',
      title: 'ESC sizing',
      text: `ESCs are rated ${c.esc.maxCurrent} A but see at most ${fmtNum(r.max.motorCurrent, 1)} A (${pct(escLoad)}). ESCs rated about ${Math.ceil((r.max.motorCurrent * 1.3) / 5) * 5} A would do and save weight (now ${mass(r.weights.escs)} in total).`,
    });
  }
  const batShare = r.weights.battery / r.auw;
  if (batShare > 0.65) {
    out.push({
      code: 'battery-share',
      tone: 'tip',
      title: 'Battery share',
      text: `The battery is ${pct(batShare)} of take-off weight. Past about 65 % more capacity buys less and less time, and the craft gets sluggish.`,
    });
  }

  // 4. Model limits worth knowing for this build.
  if (r.range && r.range.speed >= 0.98 * r.maxSpeed) {
    out.push({
      code: 'range-cap',
      tone: 'caution',
      title: 'Range estimate',
      text: `Best range came out at top speed (${fmt(system, 'speed', r.maxSpeed)}), which the model caps below pitch speed. Treat the range as a rough figure.`,
    });
  }
  return out;
}
