import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Omenaa — Dom Aukcyjny",
    short_name: "Omenaa",
    description:
      "Profesjonalny dom aukcyjny dzieł sztuki. Odkryj wyjątkowe obrazy, rzeźby i obiekty kolekcjonerskie.",
    theme_color: "#C8A96E",
    background_color: "#FDF8F0",
    display: "standalone",
    start_url: "/omenaa",
    icons: [
      {
        src: "/omenaa/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/omenaa/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
