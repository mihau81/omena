'use client';

import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ParsedLot {
  rowIndex: number;
  lotNumber: number;
  title: string;
  artist: string;
  description: string;
  medium: string;
  dimensions: string;
  year: number | null;
  estimateMin: number;
  estimateMax: number;
  reservePrice: number | null;
  startingBid: number | null;
  provenance: string[];
  exhibitions: string[];
}

interface ImportError {
  rowIndex: number;
  field: string;
  message: string;
}

interface PreviewResult {
  valid: ParsedLot[];
  errors: ImportError[];
  totalRows: number;
  validCount: number;
  errorCount: number;
}

interface ImportResult {
  imported: number;
  skipped: number;
  importErrors: string[];
  totalRows: number;
  parseErrors: ImportError[];
}

interface LotImportProps {
  auctionId: string;
  onImported?: (count: number) => void;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LotImport({ auctionId, onImported, onClose }: LotImportProps) {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setImportResult(null);
    setError(null);
    setDragOver(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processFile = useCallback(async (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setError('Only CSV files are accepted (.csv extension required)');
      return;
    }

    setFile(selectedFile);
    setPreview(null);
    setImportResult(null);
    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch(`/omena/api/admin/auctions/${auctionId}/lots/import`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Failed to parse CSV');
        setFile(null);
        return;
      }

      setPreview(data as PreviewResult);
    } catch {
      setError('Network error. Please try again.');
      setFile(null);
    } finally {
      setLoading(false);
    }
  }, [auctionId]);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) processFile(dropped);
  }, [processFile]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) processFile(selected);
  };

  const handleConfirmImport = async () => {
    if (!file || !preview || preview.validCount === 0) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/omena/api/admin/auctions/${auctionId}/lots/import?confirm=true`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Import failed');
        return;
      }

      setImportResult(data as ImportResult);
      if (onImported) onImported(data.imported);
    } catch {
      setError('Network error during import. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    window.location.href = '/omena/api/admin/lots/import-template';
  };

  // ─── Header Errors (row 0) ─────────────────────────────────────────────────
  const headerErrors = preview?.errors.filter((e) => e.rowIndex === 0) ?? [];
  // ─── Row Errors (row > 0) ──────────────────────────────────────────────────
  const rowErrors = preview?.errors.filter((e) => e.rowIndex > 0) ?? [];
  const errorsByRow = rowErrors.reduce<Record<number, ImportError[]>>((acc, e) => {
    if (!acc[e.rowIndex]) acc[e.rowIndex] = [];
    acc[e.rowIndex].push(e);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 pb-8 px-4 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-beige">
          <h2 className="text-lg font-serif font-semibold text-dark-brown">Import Lots from CSV</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-taupe border border-beige rounded-lg hover:bg-beige/50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Download Template
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-taupe hover:text-dark-brown hover:bg-beige/50 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Success state */}
          {importResult && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-green-800">Import complete</p>
                  <p className="text-sm text-green-700 mt-0.5">
                    {importResult.imported} lot{importResult.imported !== 1 ? 's' : ''} imported successfully.
                    {importResult.skipped > 0 && ` ${importResult.skipped} row${importResult.skipped !== 1 ? 's' : ''} skipped.`}
                  </p>
                </div>
              </div>

              {importResult.importErrors.length > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium text-red-800 mb-2">Import errors ({importResult.importErrors.length})</p>
                  <ul className="space-y-1">
                    {importResult.importErrors.map((e, i) => (
                      <li key={i} className="text-xs text-red-700 font-mono">{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={reset}
                  className="px-4 py-2 text-sm font-medium text-taupe bg-beige/50 hover:bg-beige rounded-lg transition-colors"
                >
                  Import another file
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-white bg-gold hover:bg-gold-dark rounded-lg transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Upload / Preview state */}
          {!importResult && (
            <>
              {/* File dropzone */}
              {!preview && (
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center gap-3 p-10 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                    dragOver
                      ? 'border-gold bg-gold/5'
                      : 'border-beige hover:border-gold/50 hover:bg-beige/20'
                  }`}
                >
                  {loading ? (
                    <div className="flex flex-col items-center gap-3">
                      <svg className="animate-spin w-8 h-8 text-gold" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <p className="text-sm text-taupe">Parsing CSV...</p>
                    </div>
                  ) : (
                    <>
                      <svg className="w-10 h-10 text-taupe" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                      </svg>
                      <div className="text-center">
                        <p className="text-sm font-medium text-dark-brown">
                          {dragOver ? 'Drop CSV file here' : 'Drag & drop a CSV file here, or click to browse'}
                        </p>
                        <p className="text-xs text-taupe mt-1">Only .csv files accepted</p>
                      </div>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="sr-only"
                    onChange={handleFileChange}
                    tabIndex={-1}
                  />
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <svg className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Preview */}
              {preview && (
                <div className="space-y-4">
                  {/* File info + stats */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-taupe" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                      </svg>
                      <span className="text-sm font-medium text-dark-brown">{file?.name}</span>
                    </div>
                    <button
                      onClick={reset}
                      className="text-xs text-taupe hover:text-dark-brown underline"
                    >
                      Change file
                    </button>
                  </div>

                  {/* Stats bar */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-beige/30 rounded-lg text-center">
                      <p className="text-xl font-bold text-dark-brown">{preview.totalRows}</p>
                      <p className="text-xs text-taupe mt-0.5">Total rows</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg text-center">
                      <p className="text-xl font-bold text-green-700">{preview.validCount}</p>
                      <p className="text-xs text-taupe mt-0.5">Valid</p>
                    </div>
                    <div className={`p-3 rounded-lg text-center ${preview.errorCount > 0 ? 'bg-red-50' : 'bg-beige/30'}`}>
                      <p className={`text-xl font-bold ${preview.errorCount > 0 ? 'text-red-700' : 'text-dark-brown'}`}>{preview.errorCount}</p>
                      <p className="text-xs text-taupe mt-0.5">Rows with errors</p>
                    </div>
                  </div>

                  {/* Header/global errors */}
                  {headerErrors.length > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
                      <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">File warnings</p>
                      {headerErrors.map((e, i) => (
                        <p key={i} className="text-xs text-amber-700">
                          <span className="font-medium">[{e.field}]</span> {e.message}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Preview table */}
                  {preview.valid.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-taupe uppercase tracking-wide mb-2">Valid lots preview</p>
                      <div className="overflow-x-auto border border-beige rounded-lg">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-beige/40">
                              <th className="px-3 py-2 text-left font-semibold text-dark-brown">#</th>
                              <th className="px-3 py-2 text-left font-semibold text-dark-brown">Lot</th>
                              <th className="px-3 py-2 text-left font-semibold text-dark-brown">Title</th>
                              <th className="px-3 py-2 text-left font-semibold text-dark-brown">Artist</th>
                              <th className="px-3 py-2 text-left font-semibold text-dark-brown">Medium</th>
                              <th className="px-3 py-2 text-right font-semibold text-dark-brown">Est. Min</th>
                              <th className="px-3 py-2 text-right font-semibold text-dark-brown">Est. Max</th>
                              <th className="px-3 py-2 text-left font-semibold text-dark-brown">Year</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-beige/50">
                            {preview.valid.map((lot) => (
                              <tr key={lot.rowIndex} className="hover:bg-beige/10">
                                <td className="px-3 py-2 text-taupe">{lot.rowIndex}</td>
                                <td className="px-3 py-2 font-medium text-dark-brown">{lot.lotNumber}</td>
                                <td className="px-3 py-2 text-dark-brown max-w-48 truncate" title={lot.title}>{lot.title}</td>
                                <td className="px-3 py-2 text-taupe max-w-32 truncate" title={lot.artist}>{lot.artist || '—'}</td>
                                <td className="px-3 py-2 text-taupe max-w-32 truncate" title={lot.medium}>{lot.medium || '—'}</td>
                                <td className="px-3 py-2 text-right text-taupe">{lot.estimateMin.toLocaleString()}</td>
                                <td className="px-3 py-2 text-right text-taupe">{lot.estimateMax.toLocaleString()}</td>
                                <td className="px-3 py-2 text-taupe">{lot.year ?? '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Row errors table */}
                  {rowErrors.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">
                        Row errors ({rowErrors.length})
                      </p>
                      <div className="overflow-x-auto border border-red-200 rounded-lg">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-red-50">
                              <th className="px-3 py-2 text-left font-semibold text-red-800">Row</th>
                              <th className="px-3 py-2 text-left font-semibold text-red-800">Field</th>
                              <th className="px-3 py-2 text-left font-semibold text-red-800">Error</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-red-100">
                            {Object.entries(errorsByRow).map(([rowNum, errs]) =>
                              errs.map((e, i) => (
                                <tr key={`${rowNum}-${i}`} className="bg-red-50/30 hover:bg-red-50/60">
                                  {i === 0 && (
                                    <td
                                      className="px-3 py-2 font-medium text-red-800"
                                      rowSpan={errs.length}
                                    >
                                      Row {rowNum}
                                    </td>
                                  )}
                                  <td className="px-3 py-2 font-mono text-red-700">{e.field}</td>
                                  <td className="px-3 py-2 text-red-700">{e.message}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center justify-between pt-2 border-t border-beige">
                    <p className="text-xs text-taupe">
                      {preview.errorCount > 0 && (
                        <>
                          {preview.errorCount} row{preview.errorCount !== 1 ? 's' : ''} with errors will be skipped.{' '}
                        </>
                      )}
                      {preview.validCount === 0 ? 'No valid rows to import.' : ''}
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-taupe bg-beige/50 hover:bg-beige rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirmImport}
                        disabled={loading || preview.validCount === 0}
                        className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-gold hover:bg-gold-dark rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading && (
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        )}
                        Import {preview.validCount} valid lot{preview.validCount !== 1 ? 's' : ''}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
