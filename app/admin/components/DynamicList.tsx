'use client';

interface DynamicListProps {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}

export default function DynamicList({
  label,
  items,
  onChange,
  placeholder = 'Add entry...',
}: DynamicListProps) {
  const handleAdd = () => {
    onChange([...items, '']);
  };

  const handleChange = (index: number, value: string) => {
    const updated = [...items];
    updated[index] = value;
    onChange(updated);
  };

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-dark-brown">{label}</label>
        <button
          type="button"
          onClick={handleAdd}
          className="text-xs text-gold hover:text-gold-dark font-medium"
        >
          + Add
        </button>
      </div>
      {items.length === 0 && (
        <p className="text-xs text-taupe italic">No entries yet</p>
      )}
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex gap-2">
            <input
              type="text"
              value={item}
              onChange={(e) => handleChange(index, e.target.value)}
              placeholder={placeholder}
              className="flex-1 px-3 py-1.5 text-sm border border-beige rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold"
            />
            <button
              type="button"
              onClick={() => handleRemove(index)}
              className="px-2 py-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              title="Remove"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
