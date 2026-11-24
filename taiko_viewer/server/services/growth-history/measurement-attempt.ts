import { randomUUID } from 'node:crypto';
import { GROWTH_ALGORITHM_VERSION, GROWTH_MEASUREMENT_VERSION } from './constants.ts';

type Trace = { userId: number; bindingId: number; scoreRevision: string; capturedAt: string;
  catalogRevision: string | null; policyVersion: string | null; sampleCount: number };

/** Observability only: archive rejection never enters the SQL writer or retries. */
export async function measurementAttempt<T extends { created: boolean }>(trace: Trace,
  readArchive: () => Promise<unknown[]>, writeMeasurement: (beginPersistence: (modelRevision: string, writerPayloadHash?: string) => void) => Promise<T>,
  log: (event: Record<string, unknown>) => void = event => console.info('[growth-history] measurement attempt', event)) {
  const attemptId = randomUUID();
  trace = { ...trace, algorithmVersion: GROWTH_ALGORITHM_VERSION, measurementVersion: GROWTH_MEASUREMENT_VERSION } as Trace;
  let stage = 'reader-validation', writerExecuted = false, modelRevision: string | null = null, writerPayloadHash: string | null = null;
  try {
    const archive = await readArchive();
    if (archive.length) { log({ ...trace, attemptId, stage, outcome: 'existing-archive', writerExecuted, retry: false }); return { created: false }; }
    stage = 'writer-payload';
    const result = await writeMeasurement((revision,payloadHash) => { modelRevision = revision; writerPayloadHash = payloadHash || null; stage = 'persistence'; writerExecuted = true; });
    log({ ...trace, modelRevision, writerPayloadHash, attemptId, stage, writerExecuted, outcome: result.created ? 'created' : 'not-created', retry: false });
    return result;
  } catch (error) {
    log({ ...trace, modelRevision, writerPayloadHash, attemptId, stage, writerExecuted, retry: false,
      outcome: writerExecuted ? 'persistence-failure' : stage === 'reader-validation' ? 'reader-rejection' : 'writer-not-executed',
      errorCode: error instanceof Error ? error.message : 'UNKNOWN_ERROR' });
    return undefined;
  }
}
