import { MetricEvent } from '../shared/metricTypes';

/**
 * Stable prefix for structured metric lines. Railway (or any log drain) can
 * filter on it, e.g. `"[metric]"` or `@event:game_finished` after JSON parsing.
 */
export const METRIC_PREFIX = '[metric]';

/**
 * Emit one structured metric event as a single JSON line on stdout.
 *
 * Never throws: metrics must not be able to break the game loop.
 * Callers are responsible for keeping payloads free of PII (see metricTypes.ts).
 */
export function emitMetric(metric: MetricEvent): void {
  try {
    console.log(`${METRIC_PREFIX} ${JSON.stringify({ ts: new Date().toISOString(), ...metric })}`);
  } catch {
    // Swallow serialization/logging failures — metrics are best-effort.
  }
}
