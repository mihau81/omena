import { SUPPORTED_LOCALES } from '@/app/lib/i18n';
import AuctionsClient from './AuctionsClient';

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export default async function AuctionsPage() {
  return <AuctionsClient />;
}
