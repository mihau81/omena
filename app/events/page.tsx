import type { Metadata } from "next";
import { events } from "@/app/lib/data";
import { formatDate } from "@/app/lib/utils";
import Breadcrumbs from "@/app/components/Breadcrumbs";

export const metadata: Metadata = {
  title: "Wydarzenia",
};

const eventTypeLabels: Record<string, string> = {
  auction: "Aukcja",
  exhibition: "Wystawa",
  gala: "Gala",
};

export default function EventsPage() {
  return (
    <section className="py-10 md:py-16">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <Breadcrumbs
          items={[
            { label: "Strona główna", href: "/" },
            { label: "Wydarzenia" },
          ]}
        />

        <h1 className="mt-6 font-serif text-4xl font-bold text-dark-brown">
          Wydarzenia
        </h1>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3 md:gap-8">
          {events.map((event) => (
            <div
              key={event.id}
              className="overflow-hidden rounded-xl bg-white shadow-sm"
            >
              <div className="relative h-48 bg-beige">
                <span className="absolute left-4 top-4 rounded-full bg-gold px-3 py-1 text-xs font-medium text-white">
                  {formatDate(event.date)}
                </span>
              </div>
              <div className="p-6">
                <span className="rounded bg-beige px-2 py-1 text-xs text-taupe">
                  {eventTypeLabels[event.type] || event.type}
                </span>
                <h2 className="mt-3 font-serif text-xl font-bold text-dark-brown">
                  {event.title}
                </h2>
                <p className="mt-1 text-sm text-taupe">{event.location}</p>
                <p className="mt-2 text-sm leading-relaxed text-taupe">
                  {event.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
