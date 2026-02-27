import type { Metadata } from "next";
import { Playfair_Display, Lato } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Omena — Aukcje Dzieł Sztuki",
    template: "%s | Omena",
  },
  description:
    "Omena — profesjonalny serwis aukcyjny dzieł sztuki. Odkryj wyjątkowe obrazy, rzeźby i obiekty kolekcjonerskie od najwybitniejszych artystów.",
  keywords: ["aukcje", "sztuka", "dzieła sztuki", "galeria", "kolekcje", "omena"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body
        className={`${playfair.variable} ${lato.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
