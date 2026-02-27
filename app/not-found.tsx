import Link from "next/link";

export default function NotFound() {
  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center px-5">
      <p className="font-serif text-8xl font-bold text-gold md:text-9xl">404</p>
      <p className="mt-4 text-lg text-taupe">Strona nie została znaleziona</p>
      <Link
        href="/"
        className="mt-8 inline-block rounded-full bg-gold px-8 py-3 text-sm font-medium text-white transition-colors duration-200 hover:bg-gold-dark"
      >
        Wróć na stronę główną
      </Link>
    </section>
  );
}
