import { b, e, f, m, p } from './builders';
import type { Library } from './components';

// Parts from brands sold mainly through AliExpress and Banggood. Figures were collected from
// retailer listings and forum measurements (see docs/library-sources.md). Values marked "est."
// were not published and are estimated from similar parts.

const EST = 'some values est.';

export const ALIEXPRESS: Library = {
  motor: [
    { ...m('emax-eco2-2207-1900', 'Emax', 'ECO II 2207 1900KV', 1900, 33.6, 59, 1.4, 45, 1130) },
    { ...m('emax-e3-2207-1900', 'Emax', 'E3 2207 1900KV', 1900, 31.6, 64, 1.5, 45, 1000), note: 'max current/power est.' },
    { ...m('geprc-sx2-2207e-1960', 'GEPRC', 'SpeedX2 2207E 1960KV', 1960, 34.5, 69.85, 1.5, 44.6, 1105), note: 'I₀ est.' },
    { ...m('geprc-sx2-21075-1960', 'GEPRC', 'SpeedX2 2107.5 1960KV', 1960, 29.5, 55, 1.3, 40, 900), note: 'I₀ and max ratings est.' },
    { ...m('fh-k22075-1950', 'Flash Hobby', 'King K2207.5 1950KV', 1950, 35.5, 60, 1.5, 45, 1050), note: 'Rm, I₀ and max ratings est.' },
    { ...m('vci-spark-2207-1950', 'VCI', 'Spark 2207 Pro 1950KV', 1950, 33.3, 56, 1.4, 45, 1050), note: 'I₀ and max ratings est.' },
    { ...m('ffrc-flash-2207-1950', 'FlyFishRC', 'Flash 2207 1950KV', 1950, 34.2, 60, 1.4, 45, 1050), note: 'Rm, I₀ and max ratings est.' },
    { ...m('rs-br2205s-2300', 'Racerstar', 'BR2205S 2300KV', 2300, 29, 80, 1.2, 30, 500), note: 'Rm, I₀ and max ratings est.' },
    { ...m('rs-br2207s-2200', 'Racerstar', 'BR2207S Fire 2200KV', 2200, 35, 65, 1.5, 40, 900), note: 'Rm, I₀ and max ratings est.' },
    { ...m('hm-ex1103-7000', 'Happymodel', 'EX1103 7000KV', 7000, 3.7, 250, 0.4, 6, 45, 7.4), note: 'Rm, I₀ and max ratings est.' },
    { ...m('xxd-a2212-1000', 'XXD', 'A2212 1000KV (13T)', 1000, 47, 90, 0.5, 12, 160) },
    { ...m('rts-2312-920', 'Readytosky', '2312 920KV', 920, 55, 117, 0.45, 14, 210), note: 'weight est.' },
    { ...m('rts-2212-920', 'Readytosky', '2212 920KV', 920, 56, 120, 0.4, 15, 200), note: EST },
  ],
  prop: [
    p('dal-t5045c', 'DALProp', 'Cyclone T5045C Pro', 5, 4.5, 3, 5.4),
    p('dal-t51465', 'DALProp', 'Cyclone T5146.5 V2', 5.1, 4.65, 3, 4.5),
    { ...p('gen-9450', 'Generic', '9450 self-tightening (DJI style)', 9.4, 5, 2, 13), note: 'weight est.' },
    { ...p('gen-1045-nylon', 'Generic', '1045 nylon', 10, 4.5, 2, 10), note: 'weight est.' },
  ],
  battery: [
    { ...b('cnhl-6s-1300-100', 'CNHL', 'Black Series 6S 1300mAh 100C', 'lipo', 'pack', 6, 1300, 100, 200, 3.5, 230), note: 'resistance est.' },
    { ...b('cnhl-6s-1300-130', 'CNHL', 'Black Series V2 6S 1300mAh 130C', 'lipo', 'pack', 6, 1300, 130, 260, 3.2, 223), note: 'resistance est.' },
    { ...b('cnhl-6s-1500-130', 'CNHL', 'Black Series V2 6S 1500mAh 130C', 'lipo', 'pack', 6, 1500, 130, 260, 2.8, 246), note: 'resistance est.' },
    { ...b('gnb-4s-850-hv', 'GNB (Gaoneng)', '4S 850mAh HV 120C', 'lihv', 'pack', 4, 850, 60, 120, 5, 88), note: 'listed 88 g, forum-measured ~68 g; resistance est.' },
  ],
  esc: [
    { ...e('sb-bls-50a', 'SpeedyBee', 'BLS 50A 4in1', '4in1', 50, 55, 4, 3.45), note: 'resistance est.' },
    { ...e('dia-mamba-f50pro', 'Diatone', 'Mamba F50 Pro 50A 4in1', '4in1', 50, 60, 4, 3), note: 'burst and resistance est.' },
    { ...e('emax-bullet-30a', 'Emax', 'Bullet 30A', 'single', 30, 35, 5, 3.9), note: 'burst and resistance est.' },
    { ...e('gen-simonk-30a', 'Generic', 'SimonK 30A', 'single', 30, 40, 8, 25), note: EST },
  ],
  frame: [
    { ...f('fr-f450', 'Generic', 'F450 (with FC, receiver, wiring)', 'quadX', 360, 10), note: 'bare frame 282 g + ~80 g electronics' },
    { ...f('fr-s500', 'Generic', 'S500 (with FC, receiver, wiring)', 'quadX', 485, 11), note: 'bare frame 405 g + ~80 g electronics' },
  ],
};
