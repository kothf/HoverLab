import { optimize, type OptimizerResult, type OptimizerTargets } from '../engine/optimizer';
import { simulate } from '../engine/simulate';
import type { Config, SimulationOutcome } from '../engine/types';
import type { EngineRequest } from './engine.worker';

type Pending = { resolve: (v: never) => void; reject: (e: unknown) => void };

/**
 * Runs the calculation engine in a Web Worker so typing and dragging never block the UI
 * (FRS 2.2). Falls back to the main thread where workers are unavailable.
 */
class EngineClient {
  private worker: Worker | null = null;
  private seq = 0;
  private pending = new Map<number, Pending>();

  constructor() {
    try {
      this.worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<{ id: number; result?: unknown; error?: string }>) => {
        const p = this.pending.get(e.data.id);
        if (!p) return;
        this.pending.delete(e.data.id);
        if (e.data.error) p.reject(new Error(e.data.error));
        else p.resolve(e.data.result as never);
      };
    } catch {
      this.worker = null;
    }
  }

  private send<T>(req: Omit<EngineRequest, 'id'>, inline: () => T): Promise<T> {
    if (!this.worker) return Promise.resolve().then(inline);
    const id = ++this.seq;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: never) => void, reject });
      this.worker!.postMessage({ ...req, id });
    });
  }

  simulate(c: Config): Promise<SimulationOutcome> {
    return this.send({ type: 'simulate', payload: c } as Omit<EngineRequest, 'id'>, () => simulate(c));
  }

  optimize(t: OptimizerTargets): Promise<OptimizerResult> {
    return this.send({ type: 'optimize', payload: t } as Omit<EngineRequest, 'id'>, () => optimize(t));
  }
}

// Separate workers so a running optimizer sweep never delays live recalculation.
export const simEngine = new EngineClient();
export const optEngine = new EngineClient();
