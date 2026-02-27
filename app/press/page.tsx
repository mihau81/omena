import type { Metadata } from "next";
import Image from "next/image";
import { pressItems } from "@/app/lib/data";
import { formatDate } from "@/app/lib/utils";
import Breadcrumbs from "@/app/components/Breadcrumbs";
import FadeInOnScroll from "@/app/components/FadeInOnScroll";

export const metadata: Metadata = {
  title: "Prasa",
};

export default function PressPage() {
  return (
    <section className="py-10 md:py-16">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <Breadcrumbs
          items={[
            { label: "Strona główna", href: "/" },
            { label: "Prasa" },
          ]}
        />

        <h1 className="mt-6 font-serif text-4xl font-bold text-dark-brown">
          Prasa i media
        </h1>

        <FadeInOnScroll>
          <div className="mt-10 grid gap-6 md:grid-cols-2 md:gap-8">
            {pressItems.map((item) => (
              <div
                key={item.id}
                className="overflow-hidden rounded-xl bg-white shadow-sm transition-shadow duration-300 hover:shadow-md"
              >
                <div className="h-40 overflow-hidden bg-beige">
                  <Image
                    src={item.image}
                    alt={item.title}
                    width={800}
                    height={500}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="p-6">
                  <p className="text-xs font-medium uppercase tracking-wide text-gold">
                    {item.source}
                  </p>
                  <h2 className="mt-2 font-serif text-lg font-bold text-dark-brown">
                    {item.title}
                  </h2>
                  <p className="mt-1 text-sm text-taupe">
                    {formatDate(item.date)}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-taupe">
                    {item.excerpt}
                  </p>
                  <a
                    href={item.url}
                    className="mt-4 inline-block text-sm text-gold underline-offset-4 decoration-gold/0 hover:decoration-gold transition-all duration-200 hover:text-gold-dark"
                  >
                    Czytaj więcej &rarr;
                  </a>
                </div>
              </div>
            ))}
          </div>
        </FadeInOnScroll>
      </div>
    </section>
  );
}
