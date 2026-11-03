import type { Config } from '../engine/types';

const env = { elevation: 0, temperature: 20 };

export const PRESETS: Config[] = [
  {
    name: '5" freestyle 6S',
    env,
    frame: { layout: 'quadX', weight: 180, payload: 0, maxPropIn: 5.1, accessoryCurrent: 1, dragArea: null },
    battery: { name: 'Tattu R-Line 6S 1300mAh 120C', chemistry: 'lipo', s: 6, p: 1, capacity: 1300, cRating: 120, cBurst: 240, resistance: 4, weight: 215, maxDischarge: 0.8 },
    esc: { name: 'Hobbywing XRotor Micro 60A 4in1', maxCurrent: 60, burstCurrent: 70, resistance: 3, weight: 4.5 },
    motor: { name: 'T-Motor F60 Pro IV 2207 1950KV', kv: 1950, i0: 1.4, v0: 10, rm: 60, maxPower: 1000, maxCurrent: 45, weight: 33 },
    prop: { name: 'Gemfan Hurricane 51466', diameter: 5.1, pitch: 4.66, blades: 3, ct: null, cp: null, weight: 4.5 },
  },
  {
    name: '3" cinewhoop 4S',
    env,
    frame: { layout: 'quadX', weight: 140, payload: 0, maxPropIn: 3, accessoryCurrent: 0.8, dragArea: 0.012 },
    battery: { name: 'Tattu R-Line 4S 850mAh 95C', chemistry: 'lipo', s: 4, p: 1, capacity: 850, cRating: 95, cBurst: 190, resistance: 6, weight: 105, maxDischarge: 0.8 },
    esc: { name: 'Holybro Tekko32 F4 50A 4in1', maxCurrent: 50, burstCurrent: 60, resistance: 4, weight: 4.5 },
    motor: { name: 'BrotherHobby Avenger 1507 3800KV', kv: 3800, i0: 1.0, v0: 10, rm: 85, maxPower: 390, maxCurrent: 26, weight: 18.5 },
    prop: { name: 'HQProp T3x3x3', diameter: 3, pitch: 3, blades: 3, ct: null, cp: null, weight: 1.6 },
  },
  {
    name: '7" long range 6S Li-ion',
    env,
    frame: { layout: 'quadX', weight: 230, payload: 0, maxPropIn: 7.5, accessoryCurrent: 1.2, dragArea: null },
    battery: { name: 'Samsung INR21700-40T 4000mAh', chemistry: 'liion', s: 6, p: 2, capacity: 4000, cRating: 8.75, cBurst: 8.75, resistance: 12, weight: null, cellWeight: 67, maxDischarge: 0.8 },
    esc: { name: 'Holybro Tekko32 F4 50A 4in1', maxCurrent: 50, burstCurrent: 60, resistance: 4, weight: 4.5 },
    motor: { name: 'iFlight XING 2806.5 1300KV', kv: 1300, i0: 1.1, v0: 10, rm: 65, maxPower: 950, maxCurrent: 40, weight: 49 },
    prop: { name: 'Gemfan 7040', diameter: 7, pitch: 4, blades: 3, ct: null, cp: null, weight: 9 },
  },
  {
    name: '450 camera quad 4S',
    env,
    frame: { layout: 'quadX', weight: 450, payload: 200, maxPropIn: 10, accessoryCurrent: 0.6, dragArea: null },
    battery: { name: 'Ovonic 4S 5000mAh 50C', chemistry: 'lipo', s: 4, p: 1, capacity: 5000, cRating: 50, cBurst: 100, resistance: 2, weight: 495, maxDischarge: 0.8 },
    esc: { name: 'Hobbywing XRotor 20A', maxCurrent: 20, burstCurrent: 30, resistance: 7, weight: 15 },
    motor: { name: 'Sunnysky X2212 980KV', kv: 980, i0: 0.4, v0: 10, rm: 133, maxPower: 260, maxCurrent: 18, weight: 56 },
    prop: { name: 'APC 10x4.7SF', diameter: 10, pitch: 4.7, blades: 2, ct: 0.11, cp: 0.046, weight: 20 },
  },
  {
    name: '15" endurance 6S',
    env,
    frame: { layout: 'quadX', weight: 700, payload: 300, maxPropIn: 15, accessoryCurrent: 1, dragArea: null },
    battery: { name: 'Tattu 6S 10000mAh 25C', chemistry: 'lipo', s: 6, p: 1, capacity: 10000, cRating: 25, cBurst: 50, resistance: 1.6, weight: 1350, maxDischarge: 0.8 },
    esc: { name: 'Hobbywing XRotor 40A', maxCurrent: 40, burstCurrent: 60, resistance: 4, weight: 26 },
    motor: { name: 'T-Motor MN4014 400KV', kv: 400, i0: 0.5, v0: 10, rm: 115, maxPower: 550, maxCurrent: 25, weight: 150 },
    prop: { name: 'T-Motor P15x5 carbon', diameter: 15, pitch: 5, blades: 2, ct: null, cp: null, weight: 30 },
  },
  {
    name: 'X8 heavy lift 12S',
    env,
    frame: { layout: 'x8coax', weight: 3200, payload: 3000, maxPropIn: 22, accessoryCurrent: 2, dragArea: 0.12 },
    battery: { name: '2× Tattu 6S 16000mAh in series', chemistry: 'lipo', s: 12, p: 1, capacity: 16000, cRating: 15, cBurst: 30, resistance: 1.2, weight: 3860, maxDischarge: 0.8 },
    esc: { name: 'Hobbywing XRotor Pro 80A HV', maxCurrent: 80, burstCurrent: 100, resistance: 1.5, weight: 85 },
    motor: { name: 'T-Motor MN6007 160KV', kv: 160, i0: 0.4, v0: 10, rm: 140, maxPower: 1100, maxCurrent: 25, weight: 220 },
    prop: { name: 'T-Motor G22x6.6 carbon', diameter: 22, pitch: 6.6, blades: 2, ct: null, cp: null, weight: 60 },
  },
];

export const DEFAULT_CONFIG: Config = PRESETS[0];
