"use client";

import { useState } from "react";

interface LotGalleryProps {
  images: string[];
  title: string;
}

const placeholderColors = [
  "bg-beige",
  "bg-beige-dark",
  "bg-gold/10",
  "bg-taupe/10",
];

export default function LotGallery({ images, title }: LotGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div>
      {/* Main image */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-beige">
        <div
          className={`flex h-full w-full items-center justify-center ${placeholderColors[activeIndex % placeholderColors.length]}`}
        >
          <span className="font-serif text-xl text-taupe/50">{title}</span>
        </div>

        {/* Image index */}
        <span className="absolute bottom-3 right-3 rounded bg-dark-brown/60 px-2 py-1 text-xs text-white">
          {activeIndex + 1} / {images.length}
        </span>
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {images.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`h-16 w-16 shrink-0 rounded-lg border-2 transition md:h-20 md:w-20 ${
                activeIndex === index
                  ? "border-gold"
                  : "border-transparent hover:border-beige-dark"
              } ${placeholderColors[index % placeholderColors.length]}`}
              aria-label={`Obraz ${index + 1}`}
            >
              <span className="text-xs text-taupe/50">{index + 1}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
