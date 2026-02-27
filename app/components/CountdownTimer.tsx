"use client";

import { useState, useEffect } from "react";

interface CountdownTimerProps {
  targetDate: string;
}

function getTimeLeft(target: string) {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

const units: { key: keyof NonNullable<ReturnType<typeof getTimeLeft>>; label: string }[] = [
  { key: "days", label: "Dni" },
  { key: "hours", label: "Godz" },
  { key: "minutes", label: "Min" },
  { key: "seconds", label: "Sek" },
];

export default function CountdownTimer({ targetDate }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<ReturnType<typeof getTimeLeft>>(
    getTimeLeft(targetDate)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft(targetDate));
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!timeLeft) {
    return (
      <p className="font-serif text-xl font-bold text-gold">Aukcja trwa!</p>
    );
  }

  return (
    <div className="flex gap-3">
      {units.map((unit) => (
        <div
          key={unit.key}
          className="rounded-lg bg-white p-3 text-center shadow-sm md:p-4"
        >
          <p className="font-serif text-2xl font-bold text-dark-brown md:text-3xl">
            {String(timeLeft[unit.key]).padStart(2, "0")}
          </p>
          <p className="mt-1 text-xs uppercase text-taupe">{unit.label}</p>
        </div>
      ))}
    </div>
  );
}
