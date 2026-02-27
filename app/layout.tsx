import type { Metadata } from "next";
import { Playfair_Display, Lato } from "next/font/google";
import "./globals.css";
import Header from "./components/Header";
import Footer from "./components/Footer";

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
    "Omena — profesjonalny dom aukcyjny dzieł sztuki. Odkryj wyjątkowe obrazy, rzeźby i obiekty kolekcjonerskie od najwybitniejszych artystów.",
  keywords: ["aukcje", "sztuka", "dzieła sztuki", "galeria", "kolekcje", "omena"],
  openGraph: {
    title: "Omena — Aukcje Dzieł Sztuki",
    description:
      "Odkryj wyjątkowe dzieła sztuki na aukcjach domu aukcyjnego Omena. Obrazy, rzeźby i obiekty kolekcjonerskie od najwybitniejszych artystów.",
    siteName: "Omena",
    locale: "pl_PL",
    type: "website",
  },
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
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-[60] focus:bg-gold focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:top-4 focus:left-4"
        >
          Przejdź do treści
        </a>
        <Header />
        <main id="main-content" className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
