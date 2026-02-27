import type { Metadata } from "next";
import Breadcrumbs from "@/app/components/Breadcrumbs";
import ContactForm from "./ContactForm";

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
          <ContactForm />

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
