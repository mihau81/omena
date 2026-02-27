"use client";

import { useRef, useEffect, useState } from "react";
import { stats } from "@/app/lib/data";

function parseNumber(value: string | number): number {
  if (typeof value === "number") return value;
  return parseInt(value.replace(/[^\d]/g, ""), 10) || 0;
}

function formatDisplay(current: number, original: string | number): string {
  if (typeof original === "string" && original.includes("PLN")) {
    return current.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " PLN";
  }
  return current.toString();
}

const items: { key: string; label: string; value: string | number }[] = [
  { key: "auctions", label: "Aukcji", value: stats.totalAuctions },
  { key: "lots", label: "Obiektów", value: stats.totalLots },
  { key: "artists", label: "Artystów", value: stats.totalArtists },
  { key: "raised", label: "Zebrano", value: stats.totalRaised },
];

export default function StatsSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [counts, setCounts] = useState<number[]>(items.map(() => 0));

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;

    const targets = items.map((item) => parseNumber(item.value));
    const duration = 1500;
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      setCounts(targets.map((t) => Math.round(eased * t)));

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
  }, [visible]);

  return (
    <section ref={sectionRef} className="py-16 md:py-24">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 px-5 md:grid-cols-4 md:gap-8 md:px-8">
        {items.map((item, i) => (
          <div key={item.key} className="text-center">
            <p className="font-serif text-3xl font-bold text-gold md:text-4xl">
              {formatDisplay(counts[i], item.value)}
            </p>
            <p className="mt-2 text-sm uppercase tracking-wide text-taupe">
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
