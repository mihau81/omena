"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center px-5">
      <p className="font-serif text-6xl font-bold text-gold md:text-7xl">
        Ups
      </p>
      <h1 className="mt-4 font-serif text-2xl text-dark-brown">
        Coś poszło nie tak
      </h1>
      <p className="mt-2 text-center text-taupe">
        Wystąpił nieoczekiwany błąd. Spróbuj odświeżyć stronę.
      </p>
      <button
        onClick={reset}
        className="mt-8 inline-block rounded-full bg-gold px-8 py-3 text-sm font-medium text-white transition-colors duration-200 hover:bg-gold-dark"
      >
        Spróbuj ponownie
      </button>
    </section>
  );
}
