/**
 * GET /api/admin/jobs
 * Returns queue stats for the BullMQ job dashboard.
 * Requires admin authentication.
 *
 * Returns counts for: waiting, active, completed, failed, delayed per queue.
 * Returns null for each queue when Redis is not configured.
 */

import { NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { getEmailQueue, getPdfQueue, getImageQueue, getPushQueue, QUEUE_NAMES } from '@/lib/queue';

export async function GET() {
  try {
    await requireAdmin('reports:read');
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const queues = [
    { name: 'email', label: 'Email', queue: getEmailQueue() },
    { name: 'pdf',   label: 'PDF Generation', queue: getPdfQueue() },
    { name: 'image', label: 'Image Processing', queue: getImageQueue() },
    { name: 'push',  label: 'Push Notifications', queue: getPushQueue() },
  ];

  const stats = await Promise.all(
    queues.map(async ({ name, label, queue }) => {
      if (!queue) {
        return { name, label, available: false };
      }
      try {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
          queue.getDelayedCount(),
        ]);
        return { name, label, available: true, waiting, active, completed, failed, delayed };
      } catch (err) {
        return { name, label, available: false, error: (err as Error).message };
      }
    }),
  );

  const redisConfigured = !!process.env.REDIS_URL;

  return NextResponse.json({ redisConfigured, queues: stats });
}

/**
 * POST /api/admin/jobs
 * Manually enqueue a job. Body: { queue: string, job: string, data: object }
 * Only available when Redis is configured.
 */
export async function POST(request: Request) {
  try {
    await requireAdmin('admins:manage');
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.REDIS_URL) {
    return NextResponse.json({ error: 'Redis not configured' }, { status: 503 });
  }

  const body = await request.json() as { queue?: string; job?: string; data?: unknown };
  const { queue: queueName, job, data } = body;

  if (!queueName || !job) {
    return NextResponse.json({ error: 'Missing queue or job name' }, { status: 400 });
  }

  const queueMap: Record<string, ReturnType<typeof getEmailQueue>> = {
    email: getEmailQueue(),
    pdf: getPdfQueue(),
    image: getImageQueue(),
    push: getPushQueue(),
  };

  const queue = queueMap[queueName];
  if (!queue) {
    return NextResponse.json({ error: `Unknown queue: ${queueName}` }, { status: 400 });
  }

  const added = await queue.add(job, data ?? {});
  return NextResponse.json({ jobId: added.id }, { status: 201 });
}
