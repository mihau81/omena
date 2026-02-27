"use client";

interface FilterBarProps {
  categories: string[];
  statuses: string[];
  onCategoryChange: (category: string) => void;
  onStatusChange: (status: string) => void;
  activeCategory: string;
  activeStatus: string;
}

export default function FilterBar({
  categories,
  statuses,
  onCategoryChange,
  onStatusChange,
  activeCategory,
  activeStatus,
}: FilterBarProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs text-taupe">Kategoria:</p>
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => onCategoryChange(cat)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm transition-colors duration-200 ${
                activeCategory === cat
                  ? "border-gold bg-gold text-white"
                  : "border-beige-dark bg-white text-taupe hover:border-gold"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs text-taupe">Status:</p>
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5">
          {statuses.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => onStatusChange(status)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm transition-colors duration-200 ${
                activeStatus === status
                  ? "border-gold bg-gold text-white"
                  : "border-beige-dark bg-white text-taupe hover:border-gold"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
