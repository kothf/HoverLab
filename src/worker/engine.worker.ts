import { optimize, type OptimizerTargets } from '../engine/optimizer';
import { simulate } from '../engine/simulate';
import type { Config } from '../engine/types';

export type EngineRequest =
  | { id: number; type: 'simulate'; payload: Config }
  | { id: number; type: 'optimize'; payload: OptimizerTargets };

self.onmessage = (e: MessageEvent<EngineRequest>) => {
  const req = e.data;
  try {
    const result = req.type === 'simulate' ? simulate(req.payload) : optimize(req.payload);
    self.postMessage({ id: req.id, result });
  } catch (err) {
    self.postMessage({ id: req.id, error: String(err) });
  }
};
