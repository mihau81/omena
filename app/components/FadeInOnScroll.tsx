"use client";

import { useRef, useEffect, useState, type ReactNode } from "react";

interface FadeInOnScrollProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "left" | "right" | "none";
}

const translateMap = {
  up: "translateY(20px)",
  left: "translateX(-20px)",
  right: "translateX(20px)",
  none: "none",
};

export default function FadeInOnScroll({
  children,
  className,
  delay = 0,
  direction = "up",
}: FadeInOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : translateMap[direction],
        transition: `opacity 600ms ease-out, transform 600ms ease-out`,
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
