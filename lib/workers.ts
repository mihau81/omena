import { Worker, type Job } from 'bullmq';
import {
  QUEUE_NAMES,
  runEmailJob, runInvoicePdfJob, runCatalogPdfJob, runImageJob, runPushJob,
  type SendEmailJob, type GenerateInvoicePdfJob, type GenerateCatalogPdfJob,
  type ProcessImageJob, type SendPushNotificationJob,
} from './queue';

// ─── Worker startup ───────────────────────────────────────────────────────────
// Import this module (via instrumentation.ts) to auto-start all workers.
// When Redis is not configured, this is a no-op — jobs run inline.

function getRedisConnection() {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || 'localhost',
      port: parsed.port ? parseInt(parsed.port, 10) : 6379,
      password: parsed.password || undefined,
      db: parsed.pathname ? parseInt(parsed.pathname.slice(1), 10) || 0 : 0,
      maxRetriesPerRequest: null as null,
    };
  } catch {
    return null;
  }
}

export function startWorkers(): void {
  const conn = getRedisConnection();
  if (!conn) {
    console.log('[workers] Redis not configured — workers disabled, jobs run inline');
    return;
  }

  const baseOpts = { connection: conn };

  // ── Email worker ─────────────────────────────────────────────────────────
  const emailWorker = new Worker(
    QUEUE_NAMES.EMAIL,
    async (job: Job) => runEmailJob(job.data as SendEmailJob),
    { ...baseOpts, concurrency: 5 },
  );

  // ── PDF worker (invoice + catalog) ──────────────────────────────────────
  const pdfWorker = new Worker(
    QUEUE_NAMES.PDF,
    async (job: Job) => {
      if (job.name === 'generate-invoice-pdf') {
        await runInvoicePdfJob(job.data as GenerateInvoicePdfJob);
      } else if (job.name === 'generate-catalog-pdf') {
        await runCatalogPdfJob(job.data as GenerateCatalogPdfJob);
      } else {
        console.warn('[workers] Unknown PDF job:', job.name);
      }
    },
    { ...baseOpts, concurrency: 2 },  // CPU-bound — keep concurrency low
  );

  // ── Image processing worker ──────────────────────────────────────────────
  const imageWorker = new Worker(
    QUEUE_NAMES.IMAGE,
    async (job: Job) => runImageJob(job.data as ProcessImageJob),
    { ...baseOpts, concurrency: 3 },
  );

  // ── Push notification worker ─────────────────────────────────────────────
  const pushWorker = new Worker(
    QUEUE_NAMES.PUSH,
    async (job: Job) => runPushJob(job.data as SendPushNotificationJob),
    { ...baseOpts, concurrency: 5 },
  );

  // Log failures across all workers
  for (const worker of [emailWorker, pdfWorker, imageWorker, pushWorker]) {
    worker.on('failed', (job, err) => {
      console.error(`[workers] Job ${job?.id} "${job?.name}" failed:`, err.message);
    });
    worker.on('error', (err) => {
      console.error(`[workers] Worker error:`, err.message);
    });
  }

  console.log('[workers] Started: email(5), pdf(2), image(3), push(5)');
}
