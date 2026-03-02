import { getTranslation } from '@/app/lib/i18n';
import { getPublicArtists } from '@/db/queries/artists';
import ArtistsClient from './ArtistsClient';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function ArtistsPage({ params }: Props) {
  const { locale } = await params;
  const t = getTranslation(locale);
  const artists = await getPublicArtists();

  return <ArtistsClient artists={artists} t={t} locale={locale} />;
}
