'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiUrl } from '@/app/lib/utils';

type ConditionGrade = 'mint' | 'excellent' | 'very_good' | 'good' | 'fair' | 'poor';

interface ConditionPhoto {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  originalFilename: string | null;
  sortOrder: number;
}

interface ConditionReportTabProps {
  lotId: string;
  auctionId: string;
  initialGrade: ConditionGrade | null;
  initialNotes: string;
}

const GRADE_OPTIONS: { value: ConditionGrade; label: string; color: string; description: string }[] = [
  { value: 'mint',       label: 'Mint',       color: 'bg-emerald-100 text-emerald-800 border-emerald-300',  description: 'Perfect condition, no flaws' },
  { value: 'excellent',  label: 'Excellent',  color: 'bg-green-100 text-green-800 border-green-300',        description: 'Near perfect, minor age-related wear' },
  { value: 'very_good',  label: 'Very Good',  color: 'bg-lime-100 text-lime-800 border-lime-300',           description: 'Light wear, small imperfections' },
  { value: 'good',       label: 'Good',       color: 'bg-yellow-100 text-yellow-800 border-yellow-300',     description: 'Visible wear, minor damage' },
  { value: 'fair',       label: 'Fair',       color: 'bg-orange-100 text-orange-800 border-orange-300',     description: 'Significant wear or damage' },
  { value: 'poor',       label: 'Poor',       color: 'bg-red-100 text-red-800 border-red-300',              description: 'Heavy damage, restoration may be needed' },
];

export default function ConditionReportTab({
  lotId,
  auctionId,
  initialGrade,
  initialNotes,
}: ConditionReportTabProps) {
  const [grade, setGrade] = useState<ConditionGrade | null>(initialGrade);
  const [notes, setNotes] = useState(initialNotes);
  const [photos, setPhotos] = useState<ConditionPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    if (type === 'success') setTimeout(() => setToast(null), 3000);
  };

  const fetchPhotos = useCallback(async () => {
    try {
      const res = await fetch(apiUrl(`/api/admin/lots/${lotId}/condition-photos`));
      if (res.ok) {
        const data = await res.json();
        setPhotos(data.photos ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingPhotos(false);
    }
  }, [lotId]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const handleSave = async () => {
    setSaving(true);
    setToast(null);

    try {
      const res = await fetch(apiUrl(`/api/admin/lots/${lotId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conditionGrade: grade ?? null, conditionNotes: notes }),
      });
      const data = await res.json();

      if (!res.ok) {
        showToast('error', data.error ?? 'Failed to save condition report');
      } else {
        showToast('success', 'Condition report saved.');
      }
    } catch {
      showToast('error', 'Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true);
    setToast(null);

    try {
      const fd = new FormData();
      fd.append('file', file);

      const res = await fetch(apiUrl(`/api/admin/lots/${lotId}/condition-photos`), {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();

      if (!res.ok) {
        showToast('error', data.error ?? 'Upload failed');
      } else {
        setPhotos((prev) => [...prev, data.media]);
      }
    } catch {
      showToast('error', 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [lotId]);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).reduce(
      (promise, file) => promise.then(() => uploadFile(file)),
      Promise.resolve(),
    );
  }, [uploadFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDeletePhoto = async (photoId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/admin/media/${photoId}`), { method: 'DELETE' });
      if (res.ok) {
        setPhotos((prev) => prev.filter((p) => p.id !== photoId));
        setDeleteConfirm(null);
      } else {
        showToast('error', 'Failed to delete photo');
      }
    } catch {
      showToast('error', 'Failed to delete photo');
    }
  };

  const selectedGradeOption = GRADE_OPTIONS.find((g) => g.value === grade);

  return (
    <div className="space-y-6">

      {/* ─── Condition Grade ───────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-beige p-6">
        <h2 className="text-base font-semibold text-dark-brown mb-1">Overall Condition Grade</h2>
        <p className="text-sm text-taupe mb-4">Select the condition grade that best describes this lot.</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {GRADE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setGrade(grade === opt.value ? null : opt.value)}
              className={`flex flex-col items-start gap-1 px-4 py-3 rounded-lg border-2 text-left transition-all ${
                grade === opt.value
                  ? `${opt.color} border-current shadow-sm`
                  : 'bg-white border-beige hover:border-gold/40 hover:bg-cream/30'
              }`}
            >
              <span className="text-sm font-semibold">{opt.label}</span>
              <span className="text-xs opacity-75 leading-snug">{opt.description}</span>
            </button>
          ))}
        </div>

        {grade && selectedGradeOption && (
          <div className="mt-4 flex items-center gap-2">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${selectedGradeOption.color}`}>
              {selectedGradeOption.label}
            </span>
            <span className="text-sm text-taupe">{selectedGradeOption.description}</span>
          </div>
        )}
      </div>

      {/* ─── Condition Notes ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-beige p-6">
        <h2 className="text-base font-semibold text-dark-brown mb-1">Condition Notes</h2>
        <p className="text-sm text-taupe mb-3">
          Detailed description of the condition: surface, support, frame, any damage or restoration.
        </p>
        <textarea
          rows={6}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Describe the condition in detail. Note any scratches, cracks, repairs, restoration work, etc."
          className="w-full px-3 py-2.5 text-sm border border-beige rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold resize-y"
        />
      </div>

      {/* ─── Save Button + Toast ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          {toast && (
            <span className={`text-sm ${toast.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
              {toast.message}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <a
            href={apiUrl(`/api/admin/lots/${lotId}/condition-report`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
            </svg>
            View Report
          </a>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium bg-gold text-white rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-50"
          >
            {saving && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            Save Condition Report
          </button>
        </div>
      </div>

      {/* ─── Condition Photos ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-beige p-6">
        <h2 className="text-base font-semibold text-dark-brown mb-1">Condition Photos</h2>
        <p className="text-sm text-taupe mb-4">
          Upload close-up photos documenting damage, repairs, or areas of note. These photos appear only in the condition report.
        </p>

        {/* Upload zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors mb-4 ${
            dragOver
              ? 'border-gold bg-gold/5'
              : 'border-beige hover:border-gold/50 hover:bg-cream/30'
          } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <svg className="animate-spin w-7 h-7 text-gold" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-taupe">Uploading...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <svg className="w-7 h-7 text-taupe" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-sm text-taupe">
                Drop condition photos here or <span className="text-gold font-medium">browse</span>
              </p>
              <p className="text-xs text-taupe/60">JPG, PNG, WebP up to 20MB</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
          />
        </div>

        {/* Photos grid */}
        {loadingPhotos ? (
          <div className="flex items-center justify-center h-24 text-sm text-taupe">Loading photos...</div>
        ) : photos.length === 0 ? (
          <div className="text-center py-6 text-sm text-taupe/60 border border-dashed border-beige rounded-xl">
            No condition photos uploaded yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map((photo) => (
              <div key={photo.id} className="relative group rounded-lg overflow-hidden border border-beige">
                <img
                  src={photo.thumbnailUrl ?? photo.url}
                  alt={photo.originalFilename ?? 'Condition photo'}
                  className="w-full aspect-square object-cover"
                />
                {/* Overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="flex gap-2">
                    <a
                      href={photo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 bg-white/90 rounded-lg hover:bg-white transition-colors"
                      title="View full size"
                    >
                      <svg className="w-4 h-4 text-dark-brown" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </a>
                    <button
                      onClick={() => setDeleteConfirm(photo.id)}
                      className="p-1.5 bg-red-500/90 rounded-lg hover:bg-red-500 transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
                {/* Filename */}
                {photo.originalFilename && (
                  <div className="px-2 py-1 bg-white border-t border-beige">
                    <p className="text-xs text-taupe truncate" title={photo.originalFilename}>
                      {photo.originalFilename}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Delete confirm dialog ──────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl border border-beige w-full max-w-sm shadow-xl p-6">
            <h3 className="text-base font-semibold text-dark-brown mb-2">Delete condition photo?</h3>
            <p className="text-sm text-taupe mb-5">This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDeletePhoto(deleteConfirm)}
                className="flex-1 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-taupe bg-beige/50 rounded-lg hover:bg-beige transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
