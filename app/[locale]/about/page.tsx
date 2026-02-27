import Image from 'next/image';
import FadeInOnScroll from '@/app/components/FadeInOnScroll';
import { SUPPORTED_LOCALES, getTranslation } from '@/app/lib/i18n';
import { teamMembers } from '@/app/lib/data';

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = getTranslation(locale);

  return (
    <>
      {/* Hero */}
      <section className="bg-beige py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-5 text-center md:px-8">
          <h1 className="font-serif text-4xl font-bold text-dark-brown md:text-5xl">
            {t.aboutTitle}
          </h1>
        </div>
      </section>

      {/* Mission */}
      <FadeInOnScroll>
        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-3xl px-5 md:px-8">
            <p className="leading-relaxed text-taupe">{t.aboutMission1}</p>
            <p className="mt-6 leading-relaxed text-taupe">{t.aboutMission2}</p>
          </div>
        </section>
      </FadeInOnScroll>

      {/* Team */}
      <FadeInOnScroll>
        <section className="bg-beige/50 py-16 md:py-24">
          <div className="mx-auto max-w-7xl px-5 md:px-8">
            <h2 className="text-center font-serif text-3xl font-bold text-dark-brown md:text-4xl">
              {t.aboutTeamTitle}
            </h2>

            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3 md:gap-8">
              {teamMembers.map((member) => (
                <div
                  key={member.name}
                  className="rounded-xl bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-md"
                >
                  <div className="mb-4 h-48 overflow-hidden rounded-lg bg-beige">
                    <Image
                      src={member.image}
                      alt={member.name}
                      width={600}
                      height={600}
                      className="h-full w-full object-cover object-top"
                    />
                  </div>
                  <h3 className="font-serif text-lg font-bold text-dark-brown">
                    {member.name}
                  </h3>
                  <p className="mt-1 text-sm text-gold">{member.role}</p>
                  <p className="mt-3 text-sm leading-relaxed text-taupe">
                    {member.bio}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </FadeInOnScroll>

      {/* Values */}
      <FadeInOnScroll>
        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-7xl px-5 md:px-8">
            <h2 className="text-center font-serif text-3xl font-bold text-dark-brown md:text-4xl">
              {t.aboutValuesTitle}
            </h2>

            <div className="mt-10 grid gap-6 md:grid-cols-3 md:gap-8">
              {/* Authenticity */}
              <div className="rounded-xl bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-md">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/10">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-gold"
                    aria-hidden="true"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <h3 className="mt-4 font-serif text-lg font-bold text-dark-brown">
                  {t.aboutValueAuthenticity}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-taupe">
                  {t.aboutValueAuthenticityDesc}
                </p>
              </div>

              {/* Expertise */}
              <div className="rounded-xl bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-md">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/10">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-gold"
                    aria-hidden="true"
                  >
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                  </svg>
                </div>
                <h3 className="mt-4 font-serif text-lg font-bold text-dark-brown">
                  {t.aboutValueExpertise}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-taupe">
                  {t.aboutValueExpertiseDesc}
                </p>
              </div>

              {/* Discretion */}
              <div className="rounded-xl bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-md">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/10">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-gold"
                    aria-hidden="true"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <h3 className="mt-4 font-serif text-lg font-bold text-dark-brown">
                  {t.aboutValueDiscretion}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-taupe">
                  {t.aboutValueDiscretionDesc}
                </p>
              </div>
            </div>
          </div>
        </section>
      </FadeInOnScroll>
    </>
  );
}
