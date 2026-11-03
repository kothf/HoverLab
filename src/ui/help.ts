// Help text for every input, result and table row, keyed by the label shown in the UI.
// Each entry says what the value means, how it is used and what is typical.

export const HELP: Record<string, string> = {
  // Environment
  'Field elevation':
    'Height of the flying site above sea level. Thinner air at altitude means less thrust and less power for the same RPM. Air density follows the ISA model: about −10 % at 1000 m.',
  'Air temperature':
    'Ambient temperature. Hot air is less dense (lower thrust) and gives motors less cooling headroom; cold air also reduces battery output in practice.',

  // Frame
  'Rotor configuration':
    'Number and arrangement of motors. Quad X and Quad + fly the same in this model. X8 coaxial has 8 motors on 4 arms; lower props work in the upper wake, modelled as ~10 % lower thrust coefficient on average.',
  'Max prop size':
    'Largest propeller the frame can swing without the blades hitting each other or the frame. Used for the "prop too large" warning and as the optimizer limit.',
  'Frame + electronics':
    'Everything except motors, props, ESCs and battery: frame, flight controller, receiver, VTX, camera, GPS, wiring, straps. Typical: 5" freestyle 150–200 g, 450 class 400–500 g.',
  Payload:
    'Extra mass you carry: action camera, gimbal, sensors, delivery load. Added to the all-up weight.',
  'Accessory current':
    'Current drawn from the battery by everything except the motors: FC, VTX, camera, receiver, lights, payload electronics. Typical 0.5–1.5 A; an HD VTX can draw 1–2 A alone.',
  'Frontal drag area Cd·A':
    'Drag coefficient × frontal area in m². Sets top speed and best-range speed. Leave empty to estimate from weight (5" quad ≈ 0.01–0.015 m², 10 kg lifter ≈ 0.1 m²).',

  // Battery
  'Cell chemistry':
    'LiPo: light and high-current, 3.7 V nominal. LiHV: charged to 4.35 V, a bit more energy. Li-ion (18650/21700): about 30 % more energy per gram but low current, ideal for slow long-range flights. LiFePO4: heavy but very safe and long-lived.',
  'Series S': 'Number of cells in series. Pack voltage = S × cell voltage (6S LiPo ≈ 22.2 V nominal, 25.2 V full). Higher voltage means less current for the same power.',
  'Parallel P': 'Number of cells in parallel. Multiplies capacity and current capability, divides pack resistance. Typical for Li-ion packs (e.g. 6S2P).',
  'Capacity per cell':
    'Capacity of one cell (one parallel string) in mAh. Total capacity = capacity × P. Flight time scales with it, but so does battery weight.',
  'Cell resistance':
    'Internal resistance of one cell in mΩ. Causes voltage sag and heat under load. Good LiPo: 2–6 mΩ for 1300–5000 mAh; Li-ion 21700: 10–20 mΩ. Measured by most smart chargers.',
  'Continuous C':
    'Rated continuous discharge as a multiple of capacity: 1300 mAh at 100C = 130 A. Labels are often optimistic; real sustainable values are typically 30–50 % of the printed number.',
  'Burst C': 'Short (a few seconds) discharge rating. Exceeding it triggers a danger warning.',
  'Pack weight':
    'Complete pack weight including wires and connector. Leave empty to estimate from energy density (LiPo ≈ 150 Wh/kg, Li-ion ≈ 200 Wh/kg packs).',
  'Usable capacity':
    'Share of the capacity you actually fly with before landing. 80 % is the usual LiPo rule to protect the cells (the FRS flight-time formula uses 80 %).',

  // ESC
  'Continuous current':
    'Current per motor the ESC can carry continuously. Full-throttle motor current above it gives a warning; aim for 20–30 % margin.',
  'Burst current': 'Current per motor allowed for a few seconds. Exceeding it is an ESC overload (danger).',
  'Rds(on) resistance':
    'Resistance of the ESC power path (MOSFETs + traces) in mΩ. Adds small losses; typical 2–8 mΩ.',
  'Weight per motor': 'ESC weight per motor. For a 4-in-1 board, divide its weight by 4.',

  // Motor
  'Motor Kv':
    'No-load RPM per volt. Higher Kv spins faster on the same battery and suits smaller props; lower Kv suits big props and high voltage. Rule of thumb on 6S: 5" ≈ 1700–2000 KV, 7" ≈ 1300 KV, 15" ≈ 300–400 KV.',
  'Phase resistance Rm':
    'Winding resistance between two motor leads in mΩ. Causes copper losses (I²R) and heat. Lower is better; it scales roughly with 1/Kv² for the same motor size.',
  'No-load current I₀':
    'Current the motor draws spinning without a prop, at the test voltage below. Represents iron and bearing losses; typical 0.3–1.5 A.',
  'I₀ test voltage': 'Voltage at which the no-load current was measured, usually 10 V.',
  'Max current (15 s)': 'Manufacturer limit for about 15 s. Full-throttle current above it is a danger warning.',
  'Max power (15 s)': 'Manufacturer power limit for about 15 s, in watts.',
  'Motor weight': 'Weight of one motor including wires. Also sets the thermal model: heavier motors heat up more slowly.',

  // Propeller
  Diameter: 'Propeller diameter in inches. Thrust grows with D⁴ and power with D⁵ at the same RPM; larger props are more efficient but slower to respond.',
  Pitch:
    'Distance the prop would advance in one revolution, in inches. Higher pitch gives more thrust and speed per RPM but needs more power. Pitch/diameter 0.4–0.6 is efficient for hovering.',
  Blades: 'Blade count. More blades give more thrust for the same diameter but lower efficiency. FPV usually 3, larger multirotors 2.',
  Weight: 'Weight of one propeller. Leave empty to estimate from size.',
  'Thrust const. Ct':
    'Static thrust coefficient: T = Ct·ρ·n²·D⁴ (n in rev/s, D in m). Leave empty to estimate from pitch, diameter and blades (±15 %). Enter a measured value (UIUC database, manufacturer test data) for accurate results.',
  'Power const. Cp':
    'Static power coefficient: P = Cp·ρ·n³·D⁵. Sets how hard the prop is to turn and therefore current and RPM. Leave empty to estimate; measured values greatly improve accuracy.',

  // Optimizer
  Objective:
    'Maximum flight endurance: longest hover time for your payload. Maximum payload: most spare lift while still meeting the target endurance.',
  'Battery chemistry': 'Chemistry the optimizer sizes the battery with. Li-ion usually wins endurance; LiPo wins payload and punch.',
  'Target payload': 'Payload the design must carry.',
  'Target endurance': 'Hover time to reach. In payload mode designs below it are rejected; in endurance mode results that reach it are shown in green.',
  'Min thrust/weight': 'Required ratio of full-throttle thrust to all-up weight. 2:1 is the minimum for safe control; FPV freestyle uses 5–10:1.',
  'Max hover throttle': 'Highest acceptable hover throttle. Lower leaves more control authority; 50–60 % is typical.',
  'Min cells': 'Smallest cell count to consider.',
  'Max cells': 'Largest cell count to consider.',
  'New cell count': 'Cell count you want to switch to. The matcher gives the Kv that keeps the same prop speed and thrust.',

  // Results
  'Hover time':
    'Time hovering until the usable capacity is used: usable mAh ÷ hover current × 60. "Mixed" assumes 70 % hovering and 30 % at half-way between hover and full throttle.',
  'Thrust / weight': 'Full-throttle thrust divided by all-up weight. Below 2:1 the craft is hard to control in wind or descents.',
  'All-up weight': 'Total take-off weight. "Drive" is motors, props, ESCs and battery; "frame" is frame, electronics and payload.',
  'Hover throttle': 'Throttle needed to hover, with battery current and power. 35–55 % is a healthy range.',
  'Specific thrust': 'Grams of thrust per watt of battery power at hover. Higher means more efficient; 8–12 g/W is good for camera and endurance builds.',
  'Peak power': 'Electrical power at full throttle, with battery current and C-rate.',
  'Max speed': 'Level top speed and vertical climb rate where full throttle can no longer supply the power that momentum theory asks for (lift, drag and climb work). The static prop map ignores prop unloading at speed, so both are capped below pitch speed.',
  'Best range': 'Longest distance on one battery and the speed that gives it, from a sweep of cruise speeds.',
  'Thrust/Weight': 'Full-throttle thrust ÷ all-up weight. Warning below 2:1, danger below 1.6:1.',
  'Motor thermal': 'Motor temperature after 15 s at full throttle, starting from hover temperature. Danger above 80 °C.',
  'Motor load': 'Full-throttle motor current as a share of its rated max current.',
  'ESC load': 'Full-throttle current per motor as a share of the ESC continuous rating.',
  'Battery C': 'Full-throttle C-rate against the continuous rating.',

  // Table rows
  Throttle: 'ESC throttle (PWM duty) for this operating point.',
  RPM: 'Propeller speed in revolutions per minute.',
  'Thrust per motor': 'Static thrust of one motor and prop.',
  'Current per motor': 'Motor phase current (average). Battery current per motor is this × throttle.',
  'Battery current': 'Total current from the battery, including accessories.',
  'Battery voltage': 'Voltage at the battery terminals under this load (nominal minus sag).',
  'Electric power': 'Power drawn from the battery.',
  'Shaft power per motor': 'Mechanical power delivered to one propeller.',
  'Motor efficiency': 'Shaft power ÷ electrical power into the motor. Peaks at medium load; 75–88 % is typical.',
  'ESC efficiency': 'Power out to the motor ÷ power in, from resistive losses only.',
  'Battery C-rate': 'Battery current ÷ capacity.',
  'Prop tip Mach': 'Blade tip speed as a fraction of the speed of sound. Above 0.7 efficiency drops and noise rises sharply.',
  'Motor temp, hover': 'Steady motor temperature while hovering.',
  'Max extra payload': 'Extra payload you could add before hover throttle reaches 80 %.',
  'Air density': 'Air density at your elevation and temperature (sea level, 15 °C: 1.225 kg/m³).',
  Pack: 'Nominal and fully charged pack voltage.',
  Energy: 'Pack energy and usable capacity.',
  'Pack resistance': 'Total internal resistance of the pack: S × cell resistance ÷ P.',
  'Prop Ct / Cp': 'Thrust and power coefficients used (estimated from geometry unless entered).',
};
