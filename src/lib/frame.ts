import { t } from '../i18n';
import { LAYOUTS } from '../engine/physics';
import type { Layout } from '../engine/types';

const IN = 25.4;
// Gap between neighbouring max-size props as a fraction of prop radius.
const CLEARANCE = 1.12;

function armsFor(layout: Layout) {
  return layout === 'x8coax' ? 4 : LAYOUTS[layout].motors;
}

/** Motor-to-motor diagonal (mm) of a frame whose largest props just clear each other. */
export function wheelbaseMm(maxPropIn: number, layout: Layout): number {
  const r = (maxPropIn * IN) / 2;
  const arm = Math.max((r * CLEARANCE) / Math.sin(Math.PI / armsFor(layout)), r * 1.25);
  return arm * 2;
}

/** Inverse of wheelbaseMm: largest prop (in) a frame of the given wheelbase fits. */
export function maxPropForWheelbase(mm: number, layout: Layout): number {
  const arms = armsFor(layout);
  const fromClearance = (mm / 2) * Math.sin(Math.PI / arms) / CLEARANCE;
  const fromArm = mm / 2 / 1.25;
  return (Math.min(fromClearance, fromArm) * 2) / IN;
}

/** Common size-class name, e.g. 5" class, 450 class. */
export function frameClass(maxPropIn: number, layout: Layout): string {
  const wb = wheelbaseMm(maxPropIn, layout);
  return maxPropIn <= 8 ? t('{n}″ class', { n: +maxPropIn.toFixed(1) }) : t('{n} mm class', { n: Math.round(wb / 10) * 10 });
}
