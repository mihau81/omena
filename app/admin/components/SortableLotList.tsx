'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import StatusBadge from './StatusBadge';

interface LotRow {
  id: string;
  lotNumber: number;
  title: string;
  artist: string;
  status: string;
  sortOrder: number;
  primaryThumbnailUrl: string | null;
}

interface SortableLotItemProps {
  lot: LotRow;
  auctionId: string;
}

function SortableLotItem({ lot, auctionId }: SortableLotItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lot.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 bg-white border rounded-lg ${
        isDragging ? 'shadow-lg border-gold/50' : 'border-cream hover:border-taupe/30'
      } transition-colors`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 text-taupe/40 hover:text-taupe cursor-grab active:cursor-grabbing touch-none"
        aria-label="Drag to reorder"
        type="button"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
        </svg>
      </button>

      {/* Lot number */}
      <span className="flex-shrink-0 w-8 text-center font-mono text-xs font-medium text-taupe">
        {lot.lotNumber}
      </span>

      {/* Thumbnail */}
      <div className="flex-shrink-0 w-10 h-10 rounded overflow-hidden bg-cream">
        {lot.primaryThumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={lot.primaryThumbnailUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-5 h-5 text-taupe/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
            </svg>
          </div>
        )}
      </div>

      {/* Title + artist */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/admin/auctions/${auctionId}/lots/${lot.id}`}
          className="block text-sm font-medium text-dark-brown hover:text-gold transition-colors truncate"
        >
          {lot.title}
        </Link>
        {lot.artist && (
          <span className="text-xs text-taupe truncate block">{lot.artist}</span>
        )}
      </div>

      {/* Status */}
      <div className="flex-shrink-0">
        <StatusBadge status={lot.status} />
      </div>

      {/* Edit link */}
      <Link
        href={`/admin/auctions/${auctionId}/lots/${lot.id}`}
        className="flex-shrink-0 text-xs text-gold hover:text-gold-dark font-medium transition-colors"
      >
        Edit
      </Link>
    </div>
  );
}

interface SortableLotListProps {
  initialLots: LotRow[];
  auctionId: string;
}

export default function SortableLotList({ initialLots, auctionId }: SortableLotListProps) {
  const [lots, setLots] = useState<LotRow[]>(initialLots);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setLots((prev) => {
      const oldIndex = prev.findIndex((l) => l.id === active.id);
      const newIndex = prev.findIndex((l) => l.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
    setIsDirty(true);
    setSaveError(null);
    setSaveSuccess(false);
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const items = lots.map((lot, index) => ({ id: lot.id, sortOrder: index }));
    const snapshot = lots; // for rollback

    try {
      const res = await fetch(`/api/admin/auctions/${auctionId}/lots/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to save order');
      }

      setIsDirty(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save order');
      setLots(snapshot); // rollback
    } finally {
      setIsSaving(false);
    }
  }, [lots, auctionId]);

  return (
    <div className="space-y-3">
      {/* Save bar */}
      {(isDirty || saveSuccess || saveError) && (
        <div className={`flex items-center justify-between px-4 py-3 rounded-lg border ${
          saveError
            ? 'bg-red-50 border-red-200 text-red-700'
            : saveSuccess
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-gold/10 border-gold/30 text-dark-brown'
        }`}>
          <span className="text-sm">
            {saveError
              ? saveError
              : saveSuccess
              ? 'Order saved successfully.'
              : 'Drag lots to reorder, then save.'}
          </span>
          {isDirty && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-1.5 bg-gold text-white text-sm font-medium rounded-md hover:bg-gold-dark disabled:opacity-60 transition-colors"
            >
              {isSaving ? 'Saving…' : 'Save Order'}
            </button>
          )}
        </div>
      )}

      {/* Sortable list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={lots.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {lots.map((lot) => (
              <SortableLotItem key={lot.id} lot={lot} auctionId={auctionId} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {lots.length === 0 && (
        <p className="text-center text-taupe py-8 text-sm">
          No lots yet. Click &apos;Add Lot&apos; to create one.
        </p>
      )}
    </div>
  );
}
