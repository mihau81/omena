import { Metadata } from "next";
import AuctionsClient from "./AuctionsClient";

export const metadata: Metadata = {
  title: "Aukcje",
};

export default function AuctionsPage() {
  return <AuctionsClient />;
}
