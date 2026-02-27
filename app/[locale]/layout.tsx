import { SUPPORTED_LOCALES, getTranslation } from '@/app/lib/i18n';
import { LocaleProvider } from '@/app/lib/LocaleContext';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = getTranslation(locale);

  return (
    <LocaleProvider locale={locale} t={t}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[60] focus:bg-gold focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:top-4 focus:left-4"
      >
        {t.skipToContent}
      </a>
      <Header />
      <main id="main-content" className="min-h-screen">
        {children}
      </main>
      <Footer />
    </LocaleProvider>
  );
}
