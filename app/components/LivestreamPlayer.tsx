'use client';

interface LivestreamPlayerProps {
  url: string;
  auctionStatus: string;
}

function parseEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);

    // YouTube: youtube.com/watch?v=ID
    if (parsed.hostname === 'www.youtube.com' || parsed.hostname === 'youtube.com') {
      const v = parsed.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}?autoplay=0`;

      // youtube.com/live/ID
      const liveMatch = parsed.pathname.match(/^\/live\/([a-zA-Z0-9_-]+)/);
      if (liveMatch) return `https://www.youtube.com/embed/${liveMatch[1]}?autoplay=0`;
    }

    // YouTube short: youtu.be/ID
    if (parsed.hostname === 'youtu.be') {
      const id = parsed.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${id}?autoplay=0`;
    }

    // Vimeo: vimeo.com/ID
    if (parsed.hostname === 'vimeo.com' || parsed.hostname === 'www.vimeo.com') {
      const vimeoMatch = parsed.pathname.match(/^\/(\d+)/);
      if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }

    return null;
  } catch {
    return null;
  }
}

export default function LivestreamPlayer({ url, auctionStatus }: LivestreamPlayerProps) {
  if (auctionStatus !== 'live' || !url) return null;

  const embedUrl = parseEmbedUrl(url);
  if (!embedUrl) return null;

  return (
    <div className="rounded-2xl overflow-hidden bg-black">
      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
        <iframe
          src={embedUrl}
          title="Auction Livestream"
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}
