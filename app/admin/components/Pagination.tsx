'use client';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (p: number) => void;
}

export default function Pagination({ page, totalPages, total, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-6 py-3 border-t border-beige">
      <p className="text-xs text-taupe">{total} total</p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1 text-xs font-medium rounded border border-beige text-taupe hover:text-dark-brown disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        <span className="text-xs text-taupe">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1 text-xs font-medium rounded border border-beige text-taupe hover:text-dark-brown disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
