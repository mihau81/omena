'use client';

import Image from 'next/image';
import { useState } from 'react';
import { isYouTubeUrl, getYouTubeVideoId, getYouTubeThumbnail } from '../lib/utils';
import { useLocale } from '../lib/LocaleContext';

interface LotMediaGalleryProps {
  media: string[];
  title: string;
}

export default function LotMediaGallery({ media, title }: LotMediaGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const { t } = useLocale();

  const current = media[activeIndex];
  const isVideo = isYouTubeUrl(current);
  const videoId = isVideo ? getYouTubeVideoId(current) : null;

  return (
    <div>
      {/* Main viewer — 16:9 */}
      <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-beige">
        {isVideo && videoId ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        ) : (
          <Image
            src={current}
            alt={title}
            width={1280}
            height={720}
            className="h-full w-full object-cover"
            priority
          />
        )}

        {/* Index badge */}
        <span className="absolute bottom-3 right-3 rounded bg-dark-brown/60 px-2 py-1 text-xs text-white">
          {activeIndex + 1} / {media.length}
        </span>
      </div>

      {/* Thumbnail carousel */}
      {media.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {media.map((src, index) => {
            const isYt = isYouTubeUrl(src);
            const ytId = isYt ? getYouTubeVideoId(src) : null;

            return (
              <button
                key={index}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition md:h-20 md:w-28 ${
                  activeIndex === index
                    ? 'border-gold'
                    : 'border-transparent hover:border-beige-dark'
                }`}
                aria-label={isYt ? t.playVideo : `${title} ${index + 1}`}
              >
                {isYt && ytId ? (
                  <>
                    <Image
                      src={getYouTubeThumbnail(ytId)}
                      alt={t.playVideo}
                      width={168}
                      height={120}
                      className="h-full w-full object-cover"
                    />
                    {/* Play overlay */}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  </>
                ) : (
                  <Image
                    src={src}
                    alt={`${title} ${index + 1}`}
                    width={168}
                    height={120}
                    className="h-full w-full object-cover"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
