import Link from "next/link";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Nawigacja okruszkowa">
      <ol className="flex flex-wrap gap-2 text-sm">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2">
            {i > 0 && <span className="text-gold">/</span>}
            {item.href && i < items.length - 1 ? (
              <Link
                href={item.href}
                className="text-taupe transition-colors duration-200 hover:text-gold"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-dark-brown">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
