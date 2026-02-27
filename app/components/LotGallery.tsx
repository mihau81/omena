"use client";

import Image from "next/image";
import { useState } from "react";

interface LotGalleryProps {
  images: string[];
  title: string;
}

export default function LotGallery({ images, title }: LotGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div>
      {/* Main image */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-beige" role="img" aria-label={title}>
        <Image
          src={images[activeIndex]}
          alt={title}
          width={800}
          height={600}
          className="h-full w-full object-cover"
        />

        {/* Image index */}
        <span className="absolute bottom-3 right-3 rounded bg-dark-brown/60 px-2 py-1 text-xs text-white">
          {activeIndex + 1} / {images.length}
        </span>
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {images.map((src, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition md:h-20 md:w-20 ${
                activeIndex === index
                  ? "border-gold"
                  : "border-transparent hover:border-beige-dark"
              }`}
              aria-label={`Obraz ${index + 1}`}
            >
              <Image src={src} alt={`${title} ${index + 1}`} width={80} height={80} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
