// Next.js instrumentation hook — runs once when the server process starts.
// Boots BullMQ workers so background jobs are processed in the same process.
// See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  // Only start workers in the Node.js runtime (not Edge).
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startWorkers } = await import('./lib/workers');
    startWorkers();
  }
}
