import { useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MOTOR_TEMP_LIMIT } from '../engine/simulate';
import type { Results } from '../engine/types';
import { unit } from '../lib/units';
import { useUnits } from './context';

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

const axisProps = { stroke: 'var(--muted)', tick: { fill: 'var(--muted)', fontSize: 12 }, tickLine: false };
const tooltipStyle = { background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' };

export function Charts({ results: r, snapshots }: { results: Results; snapshots: Snapshot[] }) {
  const [tab, setTab] = useState<Tab>('thrust');
  const system = useUnits();
  const th = unit(system, 'thrust');
  const thrustDisp = (g: number) => (system === 'metric' ? g / 1000 : th.toDisplay(g));
  const thrustLabel = system === 'metric' ? 'kg' : th.label;
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
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="chart-area">
        <ResponsiveContainer width="100%" height={300}>
          {tab === 'thrust' ? (
            <LineChart data={thrustData} margin={{ top: 10, right: 16, bottom: 18, left: 0 }}>
              <CartesianGrid stroke="var(--grid)" />
              <XAxis dataKey="throttle" {...axisProps} unit="%" label={{ value: 'Throttle', position: 'insideBottom', offset: -10, fill: 'var(--muted)' }} />
              <YAxis {...axisProps} unit={` ${thrustLabel}`} width={70} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v.toFixed(2)} ${thrustLabel}`} labelFormatter={(l) => `Throttle ${l}%`} />
              <Legend verticalAlign="top" height={28} />
              <ReferenceLine y={hoverLine} stroke="var(--warn)" strokeDasharray="4 4" label={{ value: 'AUW', fill: 'var(--warn)', fontSize: 12, position: 'insideTopLeft' }} />
              <Line type="monotone" dataKey="current" name="Current config" stroke={C.a} strokeWidth={2.5} dot={false} />
              {snapshots.map((s) => (
                <Line key={s.id} type="monotone" dataKey={s.id} name={s.name} stroke={s.color} strokeWidth={2} strokeDasharray="6 3" dot={false} />
              ))}
            </LineChart>
          ) : tab === 'power' ? (
            <LineChart data={r.curves} margin={{ top: 10, right: 0, bottom: 18, left: 0 }}>
              <CartesianGrid stroke="var(--grid)" />
              <XAxis dataKey="throttlePct" {...axisProps} unit="%" label={{ value: 'Throttle', position: 'insideBottom', offset: -10, fill: 'var(--muted)' }} />
              <YAxis yAxisId="a" {...axisProps} unit=" A" width={60} />
              <YAxis yAxisId="w" orientation="right" {...axisProps} unit=" W" width={70} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n) => (n === 'Power' ? `${v.toFixed(0)} W` : `${v.toFixed(1)} A`)} labelFormatter={(l) => `Throttle ${l}%`} />
              <Legend verticalAlign="top" height={28} />
              <Line yAxisId="a" type="monotone" dataKey="batteryCurrent" name="Battery current" stroke={C.a} strokeWidth={2.5} dot={false} />
              <Line yAxisId="a" type="monotone" dataKey="motorCurrent" name="Current per motor" stroke={C.c} strokeWidth={2} dot={false} />
              <Line yAxisId="w" type="monotone" dataKey="electricPower" name="Power" stroke={C.b} strokeWidth={2} dot={false} />
            </LineChart>
          ) : tab === 'eff' ? (
            <LineChart
              data={r.curves.map((p) => ({ t: p.throttlePct, motor: p.motorEfficiency * 100, esc: p.escEfficiency * 100, total: p.motorEfficiency * p.escEfficiency * 100, gw: p.specificThrust }))}
              margin={{ top: 10, right: 0, bottom: 18, left: 0 }}
            >
              <CartesianGrid stroke="var(--grid)" />
              <XAxis dataKey="t" {...axisProps} unit="%" label={{ value: 'Throttle', position: 'insideBottom', offset: -10, fill: 'var(--muted)' }} />
              <YAxis yAxisId="e" {...axisProps} unit="%" domain={[40, 100]} width={55} />
              <YAxis yAxisId="g" orientation="right" {...axisProps} unit=" g/W" width={70} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n) => (n === 'Specific thrust' ? `${v.toFixed(2)} g/W` : `${v.toFixed(1)} %`)} labelFormatter={(l) => `Throttle ${l}%`} />
              <Legend verticalAlign="top" height={28} />
              <Line yAxisId="e" type="monotone" dataKey="motor" name="Motor" stroke={C.a} strokeWidth={2.5} dot={false} />
              <Line yAxisId="e" type="monotone" dataKey="esc" name="ESC" stroke={C.c} strokeWidth={2} dot={false} />
              <Line yAxisId="e" type="monotone" dataKey="total" name="Drive" stroke={C.d} strokeWidth={2} dot={false} />
              <Line yAxisId="g" type="monotone" dataKey="gw" name="Specific thrust" stroke={C.b} strokeWidth={2} strokeDasharray="5 3" dot={false} />
            </LineChart>
          ) : tab === 'thermal' ? (
            <LineChart data={r.thermal.map((p) => ({ t: p.t, temp: +tu.toDisplay(p.temp).toFixed(1) }))} margin={{ top: 10, right: 16, bottom: 18, left: 0 }}>
              <CartesianGrid stroke="var(--grid)" />
              <XAxis dataKey="t" {...axisProps} unit=" s" label={{ value: 'Time at full throttle', position: 'insideBottom', offset: -10, fill: 'var(--muted)' }} />
              <YAxis {...axisProps} unit={tu.label} width={60} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v} ${tu.label}`} labelFormatter={(l) => `${l} s at full throttle`} />
              <ReferenceLine y={+tu.toDisplay(MOTOR_TEMP_LIMIT).toFixed(0)} stroke="var(--danger)" strokeDasharray="4 4" label={{ value: 'Limit', fill: 'var(--danger)', fontSize: 12, position: 'insideTopLeft' }} />
              <Line type="monotone" dataKey="temp" name="Motor temperature" stroke={C.b} strokeWidth={2.5} dot={false} />
            </LineChart>
          ) : (
            <LineChart data={r.payloadEnvelope.map((p) => ({ p: +mu.toDisplay(p.payload).toFixed(mu.digits), time: +p.hoverTime.toFixed(1) }))} margin={{ top: 10, right: 16, bottom: 18, left: 0 }}>
              <CartesianGrid stroke="var(--grid)" />
              <XAxis dataKey="p" {...axisProps} unit={` ${mu.label}`} label={{ value: 'Extra payload', position: 'insideBottom', offset: -10, fill: 'var(--muted)' }} />
              <YAxis {...axisProps} unit=" min" width={60} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v} min`} labelFormatter={(l) => `+${l} ${mu.label} payload`} />
              <Line type="monotone" dataKey="time" name="Hover time" stroke={C.a} strokeWidth={2.5} dot />
            </LineChart>
          )}
        </ResponsiveContainer>
        {tab === 'payload' && r.payloadEnvelope.length === 0 && <p className="muted center">Craft cannot hover, so there is no payload envelope.</p>}
      </div>
    </div>
  );
}
