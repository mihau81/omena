import Link from "next/link";

const navLinks = [
  { href: "/", label: "Strona główna" },
  { href: "/about", label: "O nas" },
  { href: "/auctions", label: "Aukcje" },
  { href: "/events", label: "Wydarzenia" },
  { href: "/press", label: "Prasa" },
  { href: "/contact", label: "Kontakt" },
];

export default function Footer() {
  return (
    <footer className="bg-dark-brown text-beige">
      <div className="mx-auto max-w-7xl px-5 py-12 md:px-8 md:py-16">
        <div className="grid gap-10 md:grid-cols-3 md:gap-8">
          {/* Column 1: Logo & description */}
          <div>
            <p className="font-serif text-xl tracking-widest text-white">
              OMENA
            </p>
            <p className="mt-4 text-sm leading-relaxed text-beige/80">
              Omena to renomowany dom aukcyjny specjalizujący się w sztuce
              współczesnej i klasycznej. Od lat łączymy kolekcjonerów z
              wyjątkowymi dziełami najwybitniejszych artystów z Polski i świata.
            </p>
          </div>

          {/* Column 2: Navigation */}
          <div>
            <h3 className="font-serif text-sm font-bold uppercase tracking-widest text-white">
              Nawigacja
            </h3>
            <ul className="mt-4 flex flex-col gap-3">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-beige/80 transition-colors duration-200 hover:text-gold"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Contact */}
          <div>
            <h3 className="font-serif text-sm font-bold uppercase tracking-widest text-white">
              Kontakt
            </h3>
            <address className="mt-4 flex flex-col gap-3 text-sm not-italic leading-relaxed text-beige/80">
              <p>
                ul. Foksal 17
                <br />
                00-372 Warszawa
              </p>
              <a
                href="tel:+48221234567"
                className="transition-colors duration-200 hover:text-gold"
              >
                +48 22 123 45 67
              </a>
              <a
                href="mailto:kontakt@omena.art"
                className="transition-colors duration-200 hover:text-gold"
              >
                kontakt@omena.art
              </a>
            </address>
          </div>
        </div>

        {/* Bottom bar */}
        <hr className="mt-12 border-beige/20" />
        <div className="mt-6 flex flex-col items-center gap-4 md:flex-row md:justify-between">
          <p className="text-xs text-beige/60">
            &copy; 2026 Omena. Wszelkie prawa zastrzeżone.
          </p>

          {/* Social icons */}
          <div className="flex items-center gap-5">
            {/* Instagram */}
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="text-gold transition-colors duration-200 hover:text-gold-light"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="5" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
            </a>

            {/* Facebook */}
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="text-gold transition-colors duration-200 hover:text-gold-light"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
              </svg>
            </a>

            {/* LinkedIn */}
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="text-gold transition-colors duration-200 hover:text-gold-light"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
                <rect x="2" y="9" width="4" height="12" />
                <circle cx="4" cy="4" r="2" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
