import { useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MOTOR_TEMP_LIMIT } from '../engine/simulate';
import type { Results } from '../engine/types';
import { unit } from '../lib/units';
import { useUnits } from './context';
import { useT } from '../i18n';

export interface Snapshot {
  id: string;
  name: string;
  color: string;
  results: Results;
}

type Tab = 'thrust' | 'power' | 'eff' | 'thermal' | 'payload';
const TABS: { key: Tab; label: string }[] = [
  { key: 'thrust', label: 'Thrust' },
  { key: 'power', label: 'Current & power' },
  { key: 'eff', label: 'Efficiency' },
  { key: 'thermal', label: 'Motor thermal' },
  { key: 'payload', label: 'Payload envelope' },
];

const C = {
  a: 'var(--series-1)',
  b: 'var(--series-2)',
  c: 'var(--series-3)',
  d: 'var(--series-4)',
};

/** Short, readable tick text: whole numbers stay whole, fractions keep at most 3 significant digits. */
export function tickText(v: number, suffix = ''): string {
  if (!Number.isFinite(v)) return '';
  const n = Math.abs(v) >= 100 || Number.isInteger(v) ? Math.round(v) : +v.toPrecision(Math.abs(v) >= 10 ? 3 : 2);
  return `${n.toLocaleString('en-US')}${suffix}`;
}

const axisProps = { stroke: 'var(--muted)', tick: { fill: 'var(--muted)', fontSize: 12 }, tickLine: false };
const legendProps = { verticalAlign: 'top' as const, wrapperStyle: { paddingBottom: 8, lineHeight: '20px' } };
const PCT_TICKS = [0, 20, 40, 60, 80, 100];
const tooltipStyle = { background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' };

export function Charts({ results: r, snapshots }: { results: Results; snapshots: Snapshot[] }) {
  const [tab, setTab] = useState<Tab>('thrust');
  const system = useUnits();
  const t = useT();
  const th = unit(system, 'thrust');
  const thrustDisp = (g: number) => (system === 'metric' ? g / 1000 : th.toDisplay(g));
  const thrustLabel = system === 'metric' ? t('kg') : th.label;
  const tu = unit(system, 'temp');
  const mu = unit(system, 'mass');

  const thrustData = r.curves.map((p, i) => {
    const row: Record<string, number> = { throttle: p.throttlePct, current: +thrustDisp(p.totalThrust).toFixed(3) };
    snapshots.forEach((s) => {
      const q = s.results.curves[i];
      if (q) row[s.id] = +thrustDisp(q.totalThrust).toFixed(3);
    });
    return row;
  });
  const hoverLine = thrustDisp(r.auw);

  return (
    <div className="card charts">
      <div className="tabs" role="tablist">
        {TABS.map((x) => (
          <button key={x.key} role="tab" aria-selected={tab === x.key} className={tab === x.key ? 'active' : ''} onClick={() => setTab(x.key)}>
            {t(x.label)}
          </button>
        ))}
      </div>
      <div className="chart-area" dir="ltr">
        <ResponsiveContainer width="100%" height={300}>
          {tab === 'thrust' ? (
            <LineChart data={thrustData} margin={{ top: 10, right: 16, bottom: 18, left: 0 }}>
              <CartesianGrid stroke="var(--grid)" />
              <XAxis dataKey="throttle" {...axisProps} unit="%" label={{ value: t('Throttle'), position: 'insideBottom', offset: -10, fill: 'var(--muted)' }} />
              <YAxis {...axisProps} tickFormatter={(v: number) => tickText(v, ` ${thrustLabel}`)} width={70} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v.toFixed(2)} ${thrustLabel}`} labelFormatter={(l) => t('Throttle {v}%', { v: l })} />
              <Legend {...legendProps} />
              <ReferenceLine y={hoverLine} stroke="var(--warn)" strokeDasharray="4 4" label={{ value: t('AUW'), fill: 'var(--warn)', fontSize: 12, position: 'insideTopLeft' }} />
              <Line type="monotone" dataKey="current" name={t('Current config')} stroke={C.a} strokeWidth={2.5} dot={false} />
              {snapshots.map((s) => (
                <Line key={s.id} type="monotone" dataKey={s.id} name={s.name} stroke={s.color} strokeWidth={2} strokeDasharray="6 3" dot={false} />
              ))}
            </LineChart>
          ) : tab === 'power' ? (
            <LineChart data={r.curves} margin={{ top: 10, right: 0, bottom: 18, left: 0 }}>
              <CartesianGrid stroke="var(--grid)" />
              <XAxis dataKey="throttlePct" {...axisProps} unit="%" label={{ value: t('Throttle'), position: 'insideBottom', offset: -10, fill: 'var(--muted)' }} />
              <YAxis yAxisId="a" {...axisProps} tickFormatter={(v: number) => tickText(v, ` ${t('A')}`)} width={60} />
              <YAxis yAxisId="w" orientation="right" {...axisProps} tickFormatter={(v: number) => tickText(v, ` ${t('W')}`)} width={70} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n) => (n === t('Power') ? `${v.toFixed(0)} ${t('W')}` : `${v.toFixed(1)} ${t('A')}`)} labelFormatter={(l) => t('Throttle {v}%', { v: l })} />
              <Legend {...legendProps} />
              <Line yAxisId="a" type="monotone" dataKey="batteryCurrent" name={t('Battery current')} stroke={C.a} strokeWidth={2.5} dot={false} />
              <Line yAxisId="a" type="monotone" dataKey="motorCurrent" name={t('Current per motor')} stroke={C.c} strokeWidth={2} dot={false} />
              <Line yAxisId="w" type="monotone" dataKey="electricPower" name={t('Power')} stroke={C.b} strokeWidth={2} dot={false} />
            </LineChart>
          ) : tab === 'eff' ? (
            <LineChart
              data={r.curves.map((p) => ({ t: p.throttlePct, motor: p.motorEfficiency * 100, esc: p.escEfficiency * 100, total: p.motorEfficiency * p.escEfficiency * 100, gw: p.specificThrust }))}
              margin={{ top: 10, right: 0, bottom: 18, left: 0 }}
            >
              <CartesianGrid stroke="var(--grid)" />
              <XAxis dataKey="t" {...axisProps} unit="%" label={{ value: t('Throttle'), position: 'insideBottom', offset: -10, fill: 'var(--muted)' }} />
              <YAxis yAxisId="e" {...axisProps} domain={[0, 100]} ticks={PCT_TICKS} allowDataOverflow tickFormatter={(v: number) => tickText(v, '%')} width={55} />
              <YAxis yAxisId="g" orientation="right" {...axisProps} domain={[0, 'auto']} tickFormatter={(v: number) => tickText(v, ` ${t('g/W')}`)} width={70} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n) => (n === t('Specific thrust') ? `${v.toFixed(2)} ${t('g/W')}` : `${v.toFixed(1)} %`)} labelFormatter={(l) => t('Throttle {v}%', { v: l })} />
              <Legend {...legendProps} />
              <Line yAxisId="e" type="monotone" dataKey="motor" name={t('Motor')} stroke={C.a} strokeWidth={2.5} dot={false} />
              <Line yAxisId="e" type="monotone" dataKey="esc" name={t('ESC')} stroke={C.c} strokeWidth={2} dot={false} />
              <Line yAxisId="e" type="monotone" dataKey="total" name={t('Drive')} stroke={C.d} strokeWidth={2} dot={false} />
              <Line yAxisId="g" type="monotone" dataKey="gw" name={t('Specific thrust')} stroke={C.b} strokeWidth={2} strokeDasharray="5 3" dot={false} />
            </LineChart>
          ) : tab === 'thermal' ? (
            <LineChart data={r.thermal.map((p) => ({ t: p.t, temp: +tu.toDisplay(p.temp).toFixed(1) }))} margin={{ top: 10, right: 16, bottom: 18, left: 0 }}>
              <CartesianGrid stroke="var(--grid)" />
              <XAxis dataKey="t" {...axisProps} unit={` ${t('s')}`} label={{ value: t('Time at full throttle'), position: 'insideBottom', offset: -10, fill: 'var(--muted)' }} />
              <YAxis {...axisProps} tickFormatter={(v: number) => tickText(v, tu.label)} width={60} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v} ${tu.label}`} labelFormatter={(l) => t('{v} s at full throttle', { v: l })} />
              <ReferenceLine y={+tu.toDisplay(MOTOR_TEMP_LIMIT).toFixed(0)} stroke="var(--danger)" strokeDasharray="4 4" label={{ value: t('Limit'), fill: 'var(--danger)', fontSize: 12, position: 'insideTopLeft' }} />
              <Line type="monotone" dataKey="temp" name={t('Motor temperature')} stroke={C.b} strokeWidth={2.5} dot={false} />
            </LineChart>
          ) : (
            <LineChart data={r.payloadEnvelope.map((p) => ({ p: +mu.toDisplay(p.payload).toFixed(mu.digits), time: +p.hoverTime.toFixed(1) }))} margin={{ top: 10, right: 16, bottom: 18, left: 0 }}>
              <CartesianGrid stroke="var(--grid)" />
              <XAxis dataKey="p" type="number" domain={[0, 'auto']} tickCount={6} {...axisProps} tickFormatter={(v: number) => tickText(v, ` ${mu.label}`)} label={{ value: t('Extra payload'), position: 'insideBottom', offset: -10, fill: 'var(--muted)' }} />
              <YAxis {...axisProps} domain={[0, 'auto']} tickFormatter={(v: number) => tickText(v, ` ${t('min')}`)} width={60} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v} ${t('min')}`} labelFormatter={(l) => t('+{v} {u} payload', { v: l, u: mu.label })} />
              <Line type="monotone" dataKey="time" name={t('Hover time')} stroke={C.a} strokeWidth={2.5} dot />
            </LineChart>
          )}
        </ResponsiveContainer>
        {tab === 'payload' && r.payloadEnvelope.length === 0 && <p className="muted center">{t('Craft cannot hover, so there is no payload envelope.')}</p>}
      </div>
    </div>
  );
}
