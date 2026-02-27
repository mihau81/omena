'use client';

import { useState } from 'react';
import ConfirmDialog from './ConfirmDialog';

interface MediaItem {
  id: string;
  mediaType: string;
  url: string;
  thumbnailUrl: string | null;
  originalFilename: string | null;
  isPrimary: boolean;
  sortOrder: number;
}

interface MediaGridProps {
  items: MediaItem[];
  onDelete: (id: string) => void;
  onSetPrimary: (id: string) => void;
  onReorder: (items: { id: string; sortOrder: number }[]) => void;
}

export default function MediaGrid({
  items,
  onDelete,
  onSetPrimary,
  onReorder,
}: MediaGridProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const moveItem = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= items.length) return;

    const reordered = items.map((item, i) => {
      if (i === index) return { id: item.id, sortOrder: newIndex };
      if (i === newIndex) return { id: item.id, sortOrder: index };
      return { id: item.id, sortOrder: i };
    });

    onReorder(reordered);
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-taupe text-sm">
        No media yet. Upload images or add YouTube videos.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {items.map((item, index) => (
          <div
            key={item.id}
            className={`relative group rounded-xl border overflow-hidden ${
              item.isPrimary ? 'border-gold ring-2 ring-gold/30' : 'border-beige'
            }`}
          >
            {/* Thumbnail */}
            <div className="aspect-square bg-cream relative">
              {item.mediaType === 'youtube' ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-900 relative">
                  {item.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumbnailUrl}
                      alt="YouTube video"
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-10 h-10 text-white/80" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.thumbnailUrl || item.url}
                  alt={item.originalFilename || 'Lot image'}
                  className="w-full h-full object-cover"
                />
              )}

              {/* Primary badge */}
              {item.isPrimary && (
                <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-gold text-white text-[10px] font-medium rounded">
                  Primary
                </span>
              )}
            </div>

            {/* Actions overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end justify-center opacity-0 group-hover:opacity-100">
              <div className="flex gap-1 p-2 w-full justify-center">
                {/* Move left */}
                {index > 0 && (
                  <button
                    onClick={() => moveItem(index, -1)}
                    className="p-1.5 bg-white/90 rounded-lg hover:bg-white transition-colors"
                    title="Move left"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                    </svg>
                  </button>
                )}
                {/* Move right */}
                {index < items.length - 1 && (
                  <button
                    onClick={() => moveItem(index, 1)}
                    className="p-1.5 bg-white/90 rounded-lg hover:bg-white transition-colors"
                    title="Move right"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                )}
                {/* Set primary */}
                {!item.isPrimary && item.mediaType === 'image' && (
                  <button
                    onClick={() => onSetPrimary(item.id)}
                    className="p-1.5 bg-white/90 rounded-lg hover:bg-gold hover:text-white transition-colors"
                    title="Set as primary"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                    </svg>
                  </button>
                )}
                {/* Delete */}
                <button
                  onClick={() => setDeleteId(item.id)}
                  className="p-1.5 bg-white/90 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
                  title="Delete"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Filename */}
            <div className="px-2 py-1.5 text-[10px] text-taupe truncate bg-white border-t border-beige">
              {item.mediaType === 'youtube' ? 'YouTube video' : (item.originalFilename || 'Image')}
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Media"
        message="Are you sure you want to delete this media item?"
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (deleteId) onDelete(deleteId);
          setDeleteId(null);
        }}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}
