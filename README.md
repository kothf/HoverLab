# HoverLab

Professional multirotor powertrain calculator and inverse design optimizer. It runs entirely in the browser (installable as an offline PWA) and implements the [Functional Requirements Specification](docs/FRS.md).

## Features

- **Live calculator**: air density from elevation and temperature, motor/ESC/battery electrical balance, propeller thrust and power, hover / max-efficiency / full-throttle operating points, recalculated in a Web Worker on every edit.
- **Results**: KPI cards (hover and mixed flight time, thrust-to-weight, AUW, specific thrust, peak power, max speed, climb rate, best range), status indicators and warnings (ESC overload, motor over 80 °C, C-rate, voltage sag, tip Mach, prop too large for frame, low T/W).
- **Charts**: throttle vs thrust, current and power, motor/ESC efficiency and g/W, motor temperature over time at full throttle, payload vs flight time. Up to 3 configurations can be pinned and overlaid.
- **Inverse optimizer**: maximum endurance or maximum payload modes sweep prop diameter and pitch, cell count, motor size, Kv and battery energy (10k+ permutations in well under 1.5 s) and return the top 5 configurations. A Kv and cell-count matcher keeps thrust identical when changing S.
- **Component library**: motors, props, batteries/cells, ESCs and frames with fuzzy search, custom parts saved in the browser, JSON import/export.
- **Quality of life**: presets, metric/imperial units, dark/light theme, save/load configurations, CSV report, PDF report via print, shareable link that carries the whole configuration in the URL.

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engine, optimizer and utility tests
npm run build    # type-check and production build into dist/
```

## Model notes

- Propeller: `T = Ct·ρ·n²·D⁴`, `P = Cp·ρ·n³·D⁵` (n in rev/s, D in m). When measured Ct/Cp are not given they are estimated from pitch/diameter and blade count, which is the largest source of error (±15 %).
- Motor: `I = I0 + Q·Kv/9.5488`, `V = RPM/Kv + I·Rm`, with I0 scaled by √(speed).
- ESC and battery: averaged PWM, `τ·V_bat = V_motor + I·R_esc`, `V_bat = V_nominal − I_bat·R_bat`.
- Flight time follows the FRS: `usable capacity / hover current × 60`, with 80 % usable by default. Mixed flight assumes 70 % hover and 30 % at half-way between hover and full throttle.
- Motor temperature uses a first-order thermal model whose resistance and heat capacity scale with motor mass. "Max" temperature is after 15 s at full throttle starting from hover.
- Optimizer parts are generic: motor resistance and no-load current are scaled from mass and Kv.

Library values are typical figures rounded from public data. Check the datasheet for the exact part before relying on a result.
