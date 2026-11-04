// Internal units follow hobby datasheets and are always metric:
// mass g, propeller size in, altitude m, temperature °C, current A, resistance mΩ.
// Unit conversion for display lives in src/lib/units.ts.

export type Layout = 'quadX' | 'quadP' | 'hexa' | 'octo' | 'x8coax';
export type Chemistry = 'lipo' | 'lihv' | 'lifepo4' | 'liion';

export interface EnvConfig {
  elevation: number; // m ASL
  temperature: number; // °C
}

export interface FrameConfig {
  name?: string;
  layout: Layout;
  weight: number; // bare frame incl. FC/VTX/camera etc, g
  payload: number; // g
  maxPropIn: number; // inches
  accessoryCurrent: number; // A drawn by FC, VTX, receiver, payload electronics
  dragArea: number | null; // frontal Cd·A in m², null = estimate from AUW
}

export interface BatteryConfig {
  name?: string;
  chemistry: Chemistry;
  s: number;
  p: number;
  capacity: number; // mAh per parallel string (one cell)
  cRating: number; // continuous C
  cBurst: number; // burst C
  resistance: number; // mΩ per cell
  weight: number | null; // whole pack g, null = derive from cellWeight or energy density
  cellWeight?: number | null; // g per cell when built from loose cells (adds 8 % for wiring/wrap)
  maxDischarge: number; // usable fraction, 0..1 (FRS uses 0.8)
}

export interface EscConfig {
  name?: string;
  maxCurrent: number; // continuous A per motor
  burstCurrent: number; // A per motor
  resistance: number; // mΩ
  weight: number; // g per motor
}

export interface MotorConfig {
  name?: string;
  kv: number; // RPM/V
  i0: number; // A no-load current
  v0: number; // V at which i0 was measured
  rm: number; // mΩ phase resistance
  maxPower: number; // W (15 s rating)
  maxCurrent: number; // A (15 s rating)
  weight: number; // g
}

export interface PropConfig {
  name?: string;
  diameter: number; // in
  pitch: number; // in
  blades: number;
  ct: number | null; // static thrust coefficient, null = estimate from geometry
  cp: number | null; // static power coefficient, null = estimate from geometry
  weight: number | null; // g, null = estimate
}

export interface Config {
  name: string;
  env: EnvConfig;
  frame: FrameConfig;
  battery: BatteryConfig;
  esc: EscConfig;
  motor: MotorConfig;
  prop: PropConfig;
}

export interface OperatingPoint {
  throttle: number; // 0..1
  rpm: number;
  thrustPerMotor: number; // g
  totalThrust: number; // g
  torque: number; // N·m per motor
  motorCurrent: number; // A per motor
  batteryCurrent: number; // A total incl. accessories
  batteryVoltage: number; // V under load at battery terminals
  motorVoltage: number; // V effective at motor
  electricPower: number; // W total drawn from battery terminals
  mechPowerPerMotor: number; // W shaft power
  motorLoss: number; // W per motor
  motorEfficiency: number; // 0..1
  escEfficiency: number; // 0..1
  specificThrust: number; // g/W (drive power only)
  cRate: number;
  tipMach: number;
}

export type Severity = 'ok' | 'warn' | 'danger';

export interface Warning {
  code: string;
  severity: Exclude<Severity, 'ok'>;
  message: string;
}

export interface StatusIndicator {
  key: 'thrust' | 'throttle' | 'thermal' | 'climit' | 'esc' | 'motor';
  label: string;
  severity: Severity;
  value: string;
}

export interface CurvePoint extends OperatingPoint {
  throttlePct: number;
}

export interface ThermalPoint {
  t: number; // s
  temp: number; // °C
}

export interface PayloadPoint {
  payload: number; // extra g
  hoverTime: number; // min
  hoverThrottle: number;
}

export interface WeightBreakdown {
  frame: number;
  payload: number;
  motors: number;
  props: number;
  escs: number;
  battery: number;
}

export interface Results {
  airDensity: number; // kg/m³
  motors: number;
  auw: number; // g
  weights: WeightBreakdown;
  driveRatio: number; // drive mass / AUW
  propCt: number;
  propCp: number;
  battery: {
    nominalVoltage: number;
    fullVoltage: number;
    capacity: number; // mAh total
    energy: number; // Wh
    usable: number; // mAh
    resistance: number; // Ω pack
  };
  hover: OperatingPoint | null;
  max: OperatingPoint;
  optimum: OperatingPoint; // max motor efficiency point
  thrustToWeight: number;
  hoverTime: number; // min
  mixedTime: number; // min
  motorTempHover: number; // °C steady state
  motorTempMax: number; // °C after 15 s at full throttle starting from hover
  thermal: ThermalPoint[];
  climbRate: number; // m/s
  maxSpeed: number; // m/s
  range: { speed: number; distance: number; time: number } | null; // m/s, km, min
  maxPayload: number; // extra payload g at which hover throttle hits the limit
  practicalPayload: number; // extra payload g that keeps thrust/weight ≥ 2 and hover throttle ≤ 60 %
  payloadCost: number; // min of hover time lost per extra 100 g
  sagEnd: number; // V per cell at full throttle with the pack at the end of its usable capacity
  curves: CurvePoint[];
  payloadEnvelope: PayloadPoint[];
  warnings: Warning[];
  status: StatusIndicator[];
}

export type SimulationOutcome = { ok: true; results: Results } | { ok: false; errors: string[] };
