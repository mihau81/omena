import type { Metadata } from "next";
import { teamMembers } from "@/app/lib/data";

export const metadata: Metadata = {
  title: "O nas",
};

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-beige py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-5 text-center md:px-8">
          <h1 className="font-serif text-4xl font-bold text-dark-brown md:text-5xl">
            O nas
          </h1>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-3xl px-5 md:px-8">
          <p className="leading-relaxed text-taupe">
            Omena to renomowany dom aukcyjny z siedzibą w Warszawie,
            specjalizujący się w sztuce polskiej i europejskiej XX oraz XXI
            wieku. Od momentu założenia naszą misją jest budowanie mostów
            między artystami, kolekcjonerami i miłośnikami sztuki — tworząc
            przestrzeń, w której wybitne dzieła znajdują swoich nowych
            opiekunów.
          </p>
          <p className="mt-6 leading-relaxed text-taupe">
            Wierzymy, że sztuka ma moc inspirowania, edukowania i jednoczenia
            ludzi. Dlatego każda nasza aukcja to nie tylko wydarzenie handlowe,
            ale również kulturalne — starannie kuratorowane, oparte na głębokiej
            wiedzy eksperckiej i prowadzone z najwyższym szacunkiem dla
            artystów i ich dzieł.
          </p>
        </div>
      </section>

      {/* Team */}
      <section className="bg-beige/50 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <h2 className="text-center font-serif text-3xl font-bold text-dark-brown md:text-4xl">
            Nasz zespół
          </h2>

          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3 md:gap-8">
            {teamMembers.map((member) => (
              <div
                key={member.name}
                className="rounded-xl bg-white p-6 shadow-sm"
              >
                <div className="mb-4 h-48 rounded-lg bg-beige" />
                <h3 className="font-serif text-lg font-bold text-dark-brown">
                  {member.name}
                </h3>
                <p className="mt-1 text-sm text-gold">{member.role}</p>
                <p className="mt-3 text-sm leading-relaxed text-taupe">
                  {member.bio}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <h2 className="text-center font-serif text-3xl font-bold text-dark-brown md:text-4xl">
            Nasze wartości
          </h2>

          <div className="mt-10 grid gap-6 md:grid-cols-3 md:gap-8">
            {/* Autentyczność */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/10">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-gold"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h3 className="mt-4 font-serif text-lg font-bold text-dark-brown">
                Autentyczność
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-taupe">
                Każde dzieło przechodzi rygorystyczny proces weryfikacji
                proweniencji i autentyczności. Współpracujemy z najlepszymi
                ekspertami, aby zagwarantować pewność pochodzenia każdego
                obiektu.
              </p>
            </div>

            {/* Ekspertyza */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/10">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-gold"
                >
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
              </div>
              <h3 className="mt-4 font-serif text-lg font-bold text-dark-brown">
                Ekspertyza
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-taupe">
                Nasz zespół łączy dekady doświadczenia w historii sztuki,
                kuratorstwiei rynku aukcyjnym. Dzielimy się wiedzą, pomagając
                kolekcjonerom podejmować świadome decyzje.
              </p>
            </div>

            {/* Dyskrecja */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/10">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-gold"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <h3 className="mt-4 font-serif text-lg font-bold text-dark-brown">
                Dyskrecja
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-taupe">
                Rozumiemy, że rynek sztuki wymaga najwyższej poufności.
                Gwarantujemy pełną dyskrecję w każdym aspekcie współpracy — od
                wyceny po finalizację transakcji.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
