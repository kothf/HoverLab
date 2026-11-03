import { ALIEXPRESS } from './aliexpress';
import { b, e, f, m, p } from './builders';
import { EXTENDED } from './extended';
import type { Chemistry, EscConfig, Layout, MotorConfig, PropConfig } from '../engine/types';

// Built-in library. Values are typical figures from manufacturer listings and public test data,
// rounded; always check the datasheet of the exact part before relying on a result.

export type ComponentKind = 'motor' | 'prop' | 'battery' | 'esc' | 'frame';

interface Base {
  id: string;
  brand: string;
  model: string;
  custom?: boolean;
  /** Where the figures come from when they are partly estimated, shown next to the part. */
  note?: string;
}

export interface MotorItem extends Base, Required<Omit<MotorConfig, 'name'>> {}
export interface PropItem extends Base, Omit<PropConfig, 'name'> {}
export interface EscItem extends Base, Omit<EscConfig, 'name'> {
  format: '4in1' | 'single';
}
export interface BatteryItem extends Base {
  chemistry: Chemistry;
  form: 'pack' | 'cell';
  s: number; // 1 for loose cells
  capacity: number; // mAh
  cRating: number;
  cBurst: number;
  resistance: number; // mΩ per cell
  weight: number; // g for the pack, or per cell
}
export interface FrameItem extends Base {
  layout: Layout;
  weight: number;
  maxPropIn: number;
  dragArea: number | null;
}

export interface Library {
  motor: MotorItem[];
  prop: PropItem[];
  battery: BatteryItem[];
  esc: EscItem[];
  frame: FrameItem[];
}

const CORE: Library = {
  motor: [
    m('tm-1404-3800', 'T-Motor', 'F1404 3800KV', 3800, 9.5, 135, 0.6, 15, 220),
    m('bh-1507-3800', 'BrotherHobby', 'Avenger 1507 3800KV', 3800, 18.5, 85, 1.0, 26, 390),
    m('tm-2207-1950', 'T-Motor', 'F60 Pro IV 2207 1950KV', 1950, 33, 60, 1.4, 45, 1000),
    m('tm-2306-2400', 'T-Motor', 'F40 Pro IV 2306 2400KV', 2400, 31, 55, 1.6, 42, 650),
    m('if-2207-1855', 'iFlight', 'XING2 2207 1855KV', 1855, 32, 62, 1.3, 46, 1050),
    m('bh-2507-1800', 'BrotherHobby', 'Avenger 2507 1800KV', 1800, 40, 52, 1.5, 52, 1200),
    m('if-2806-1300', 'iFlight', 'XING 2806.5 1300KV', 1300, 49, 65, 1.1, 40, 950),
    m('ss-2212-980', 'Sunnysky', 'X2212 980KV', 980, 56, 133, 0.4, 18, 260),
    m('ss-2216-880', 'Sunnysky', 'X2216 880KV', 880, 72, 90, 0.5, 20, 330),
    m('tm-3110-700', 'T-Motor', 'MN3110 700KV', 700, 78, 115, 0.5, 26, 480),
    m('ss-4108-380', 'Sunnysky', 'X4108S 380KV', 380, 108, 158, 0.4, 20, 445),
    m('tm-4014-400', 'T-Motor', 'MN4014 400KV', 400, 150, 115, 0.5, 25, 550),
    m('tm-5212-340', 'T-Motor', 'MN5212 340KV', 340, 250, 75, 0.9, 40, 1300),
    m('tm-6007-160', 'T-Motor', 'MN6007 160KV', 160, 220, 140, 0.4, 25, 1100),
    m('if-8520-120', 'iFlight', 'XING 8520 120KV (heavy lift)', 120, 520, 75, 0.7, 60, 3200, 20),
  ],
  prop: [
    p('hq-3x3x3', 'HQProp', 'T3x3x3', 3, 3, 3, 1.6),
    p('gf-3018', 'Gemfan', 'Hurricane 3018 (3x1.8x3)', 3, 1.8, 3, 1.4),
    p('hq-5x43x3', 'HQProp', '5x4.3x3 V1S', 5, 4.3, 3, 4.3),
    p('gf-51466', 'Gemfan', 'Hurricane 51466 (5.1x4.66x3)', 5.1, 4.66, 3, 4.5),
    p('hq-6x4x3', 'HQProp', '6x4x3', 6, 4, 3, 6),
    p('gf-7040', 'Gemfan', '7040 (7x4x3)', 7, 4, 3, 9),
    p('apc-8x45', 'APC', '8x4.5MR', 8, 4.5, 2, 9),
    p('gf-1045', 'Gemfan', '1045 (10x4.5)', 10, 4.5, 2, 13),
    p('apc-10x47', 'APC', '10x4.7SF', 10, 4.7, 2, 20, 0.11, 0.046),
    p('apc-12x38', 'APC', '12x3.8SF', 12, 3.8, 2, 27, 0.096, 0.035),
    p('ma-13x55', 'MasterAir', '13x5.5 MR', 13, 5.5, 2, 30),
    p('apc-15x55', 'APC', '15x5.5MR', 15, 5.5, 2, 46),
    p('tm-15x5', 'T-Motor', 'P15x5 carbon', 15, 5, 2, 30),
    p('tm-18x61', 'T-Motor', 'P18x6.1 carbon', 18, 6.1, 2, 42),
    p('tm-22x66', 'T-Motor', 'G22x6.6 carbon', 22, 6.6, 2, 60),
    p('tm-30x10', 'T-Motor', 'G30x10.5 carbon', 30, 10.5, 2, 145),
  ],
  battery: [
    b('tt-4s-450', 'Tattu', 'R-Line 4S 450mAh 95C', 'lipo', 'pack', 4, 450, 95, 190, 9, 60),
    b('tt-4s-850', 'Tattu', 'R-Line 4S 850mAh 95C', 'lipo', 'pack', 4, 850, 95, 190, 6, 105),
    b('tt-6s-1300', 'Tattu', 'R-Line 6S 1300mAh 120C', 'lipo', 'pack', 6, 1300, 120, 240, 4, 215),
    b('ov-6s-1100', 'Ovonic', '6S 1100mAh 100C', 'lipo', 'pack', 6, 1100, 100, 200, 5, 175),
    b('ov-4s-1550', 'Ovonic', '4S 1550mAh 100C', 'lipo', 'pack', 4, 1550, 100, 200, 3.5, 175),
    b('tt-3s-2300', 'Tattu', '3S 2300mAh 45C', 'lipo', 'pack', 3, 2300, 45, 90, 4, 190),
    b('ov-4s-5000', 'Ovonic', '4S 5000mAh 50C', 'lipo', 'pack', 4, 5000, 50, 100, 2, 495),
    b('tt-6s-10000', 'Tattu', '6S 10000mAh 25C', 'lipo', 'pack', 6, 10000, 25, 50, 1.6, 1350),
    b('tt-6s-16000', 'Tattu', 'Plus 6S 16000mAh 15C', 'lipo', 'pack', 6, 16000, 15, 30, 1.2, 1930),
    b('tt-hv-6s-22000', 'Tattu', '6S 22000mAh 25C LiHV', 'lihv', 'pack', 6, 22000, 25, 50, 0.9, 2650),
    b('sony-vtc6', 'Sony', 'VTC6 18650 3000mAh', 'liion', 'cell', 1, 3000, 10, 10, 18, 46.6),
    b('sam-40t', 'Samsung', 'INR21700-40T 4000mAh', 'liion', 'cell', 1, 4000, 8.75, 8.75, 12, 67),
    b('sam-50s', 'Samsung', 'INR21700-50S 5000mAh', 'liion', 'cell', 1, 5000, 5, 5, 13, 72),
    b('a123-26650', 'A123', 'ANR26650 2500mAh', 'lifepo4', 'cell', 1, 2500, 20, 48, 6, 76),
  ],
  esc: [
    e('bf-12a-aio', 'BetaFPV', 'Toothpick 12A AIO', '4in1', 12, 15, 9, 1.5),
    e('hw-60a-4in1', 'Hobbywing', 'XRotor Micro 60A 4in1', '4in1', 60, 70, 3, 4.5),
    e('hb-tekko-50', 'Holybro', 'Tekko32 F4 50A 4in1', '4in1', 50, 60, 4, 4.5),
    e('sp-gs35', 'Spedix', 'GS35 35A', 'single', 35, 45, 4, 6),
    e('hw-40a', 'Hobbywing', 'XRotor 40A', 'single', 40, 60, 4, 26),
    e('hw-20a', 'Hobbywing', 'XRotor 20A', 'single', 20, 30, 7, 15),
    e('hw-80a', 'Hobbywing', 'XRotor Pro 80A HV', 'single', 80, 100, 1.5, 85),
    e('hw-x6-plus', 'Hobbywing', 'X6 Plus integrated ESC 60A', 'single', 60, 80, 2, 0),
  ],
  frame: [
    f('fr-3-whoop', 'Generic', '3" cinewhoop (ducted)', 'quadX', 140, 3),
    f('fr-5-free', 'Generic', '5" freestyle (incl. FC/VTX/cam)', 'quadX', 180, 5.1),
    f('fr-7-lr', 'Generic', '7" long-range (incl. GPS)', 'quadX', 230, 7.5),
    f('fr-450', 'Generic', '450 class camera quad', 'quadX', 450, 10),
    f('fr-650', 'Generic', '650 class carbon', 'quadX', 700, 15),
    f('fr-hex-960', 'Generic', '960 hexacopter', 'hexa', 1900, 18),
    f('fr-x8-1200', 'Generic', 'X8 coaxial heavy lift', 'x8coax', 3200, 22),
  ],
};

export const BUILTIN: Library = {
  motor: [...CORE.motor, ...ALIEXPRESS.motor, ...EXTENDED.motor],
  prop: [...CORE.prop, ...ALIEXPRESS.prop, ...EXTENDED.prop],
  battery: [...CORE.battery, ...ALIEXPRESS.battery, ...EXTENDED.battery],
  esc: [...CORE.esc, ...ALIEXPRESS.esc, ...EXTENDED.esc],
  frame: [...CORE.frame, ...ALIEXPRESS.frame, ...EXTENDED.frame],
};
