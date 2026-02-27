import type { NextRequest } from 'next/server';
import { subscribeBids, unsubscribeBids } from '@/lib/bid-events';
import type { BidEvent } from '@/lib/bid-events';

// Prevent static optimization — this is a streaming endpoint
export const dynamic = 'force-dynamic';

// ─── GET: SSE stream for live bid updates ────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ auctionId: string }> },
) {
  const { auctionId } = await params;
  const encoder = new TextEncoder();

  function sseChunk(event: string, data: unknown): Uint8Array {
    return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  const stream = new ReadableStream({
    start(controller) {
      // Confirm connection
      controller.enqueue(sseChunk('connected', { auctionId }));

      // Push new bids to the stream
      const onBid = (data: BidEvent) => {
        try {
          controller.enqueue(sseChunk('bid', data));
        } catch {
          // Stream already closed — subscriber will be cleaned up on abort
        }
      };

      subscribeBids(auctionId, onBid);

      // Keep-alive heartbeat every 15 seconds
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(':heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15_000);

      // Cleanup on client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        unsubscribeBids(auctionId, onBid);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering for SSE
    },
  });
}
