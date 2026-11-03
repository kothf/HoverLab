import type { BatteryItem, ComponentKind, EscItem, FrameItem, MotorItem, PropItem } from '../data/components';
import type { Config } from '../engine/types';

export type AnyPart = MotorItem | PropItem | BatteryItem | EscItem | FrameItem;

/** Copies a library part into the configuration, replacing that section's values. */
export function applyPart(c: Config, kind: ComponentKind, part: AnyPart): Config {
  const name = `${part.brand} ${part.model}`;
  switch (kind) {
    case 'frame': {
      const f = part as FrameItem;
      return { ...c, frame: { ...c.frame, name, layout: f.layout, weight: f.weight, maxPropIn: f.maxPropIn, dragArea: f.dragArea ?? null } };
    }
    case 'battery': {
      const it = part as BatteryItem;
      const common = { name, chemistry: it.chemistry, capacity: it.capacity, cRating: it.cRating, cBurst: it.cBurst, resistance: it.resistance };
      return {
        ...c,
        battery:
          it.form === 'pack'
            ? { ...c.battery, ...common, s: it.s, p: 1, weight: it.weight, cellWeight: null }
            : { ...c.battery, ...common, weight: null, cellWeight: it.weight },
      };
    }
    case 'esc': {
      const e = part as EscItem;
      return { ...c, esc: { name, maxCurrent: e.maxCurrent, burstCurrent: e.burstCurrent, resistance: e.resistance, weight: e.weight } };
    }
    case 'motor': {
      const m = part as MotorItem;
      return { ...c, motor: { name, kv: m.kv, i0: m.i0, v0: m.v0 || 10, rm: m.rm, maxPower: m.maxPower, maxCurrent: m.maxCurrent, weight: m.weight } };
    }
    case 'prop': {
      const p = part as PropItem;
      return { ...c, prop: { name, diameter: p.diameter, pitch: p.pitch, blades: p.blades, ct: p.ct ?? null, cp: p.cp ?? null, weight: p.weight ?? null } };
    }
  }
}
