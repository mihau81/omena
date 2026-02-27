import type { Metadata } from "next";
import Breadcrumbs from "@/app/components/Breadcrumbs";

export const metadata: Metadata = {
  title: "Kontakt",
};

export default function ContactPage() {
  return (
    <section className="py-10 md:py-16">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <Breadcrumbs
          items={[
            { label: "Strona główna", href: "/" },
            { label: "Kontakt" },
          ]}
        />

        <h1 className="mt-6 font-serif text-4xl font-bold text-dark-brown">
          Kontakt
        </h1>

        <div className="mt-10 grid gap-10 md:grid-cols-[1fr_360px] md:gap-12">
          {/* Form */}
          <form action="#">
            <div className="space-y-6">
              <div>
                <label
                  htmlFor="name"
                  className="mb-1 block text-sm font-medium text-dark-brown"
                >
                  Imię i nazwisko
                </label>
                <input
                  id="name"
                  type="text"
                  className="w-full rounded-lg border border-beige-dark bg-white px-4 py-3 text-sm text-dark-brown focus:border-gold focus:ring-1 focus:ring-gold focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="mb-1 block text-sm font-medium text-dark-brown"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  className="w-full rounded-lg border border-beige-dark bg-white px-4 py-3 text-sm text-dark-brown focus:border-gold focus:ring-1 focus:ring-gold focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="subject"
                  className="mb-1 block text-sm font-medium text-dark-brown"
                >
                  Temat
                </label>
                <select
                  id="subject"
                  className="w-full rounded-lg border border-beige-dark bg-white px-4 py-3 text-sm text-dark-brown focus:border-gold focus:ring-1 focus:ring-gold focus:outline-none"
                >
                  <option>Zapytanie ogólne</option>
                  <option>Konsygnacja</option>
                  <option>Wycena</option>
                  <option>Współpraca</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="message"
                  className="mb-1 block text-sm font-medium text-dark-brown"
                >
                  Wiadomość
                </label>
                <textarea
                  id="message"
                  rows={6}
                  className="w-full rounded-lg border border-beige-dark bg-white px-4 py-3 text-sm text-dark-brown focus:border-gold focus:ring-1 focus:ring-gold focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="rounded-full bg-gold px-8 py-3 text-sm font-medium text-white transition-colors duration-200 hover:bg-gold-dark"
              >
                Wyślij wiadomość
              </button>
            </div>
          </form>

          {/* Sidebar */}
          <div className="space-y-8">
            <div>
              <h2 className="font-serif text-lg font-bold text-dark-brown">
                Adres
              </h2>
              <address className="mt-3 text-sm leading-relaxed text-taupe not-italic">
                <p>ul. Foksal 17</p>
                <p>00-372 Warszawa</p>
              </address>
            </div>

            <div>
              <h2 className="font-serif text-lg font-bold text-dark-brown">
                Telefon
              </h2>
              <a
                href="tel:+48221234567"
                className="mt-3 block text-sm text-taupe transition-colors duration-200 hover:text-gold"
              >
                +48 22 123 45 67
              </a>
            </div>

            <div>
              <h2 className="font-serif text-lg font-bold text-dark-brown">
                Email
              </h2>
              <a
                href="mailto:kontakt@omena.art"
                className="mt-3 block text-sm text-taupe transition-colors duration-200 hover:text-gold"
              >
                kontakt@omena.art
              </a>
            </div>

            <div>
              <h2 className="font-serif text-lg font-bold text-dark-brown">
                Godziny otwarcia
              </h2>
              <div className="mt-3 space-y-1 text-sm text-taupe">
                <p>Pon-Pt: 10:00-18:00</p>
                <p>Sob: 10:00-14:00</p>
              </div>
            </div>

            <div className="flex h-64 items-center justify-center rounded-xl bg-beige">
              <p className="text-taupe">Mapa</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
