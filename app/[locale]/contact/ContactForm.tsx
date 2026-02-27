'use client';

import { useLocale } from '@/app/lib/LocaleContext';

export default function ContactForm() {
  const { t } = useLocale();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
      }}
      aria-label={t.contactTitle}
    >
      <div className="space-y-6">
        <div>
          <label
            htmlFor="name"
            className="mb-1 block text-sm font-medium text-dark-brown"
          >
            {t.contactFormName}
          </label>
          <input
            id="name"
            type="text"
            className="w-full rounded-lg border border-beige-dark bg-white px-4 py-3 text-sm text-dark-brown focus:border-gold focus:ring-1 focus:ring-gold focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-dark-brown"
          >
            {t.contactFormEmail}
          </label>
          <input
            id="email"
            type="email"
            className="w-full rounded-lg border border-beige-dark bg-white px-4 py-3 text-sm text-dark-brown focus:border-gold focus:ring-1 focus:ring-gold focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="message"
            className="mb-1 block text-sm font-medium text-dark-brown"
          >
            {t.contactFormMessage}
          </label>
          <textarea
            id="message"
            rows={6}
            className="w-full rounded-lg border border-beige-dark bg-white px-4 py-3 text-sm text-dark-brown focus:border-gold focus:ring-1 focus:ring-gold focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="rounded-full bg-gold px-8 py-3 text-sm font-medium text-white transition-all duration-200 hover:bg-gold-dark hover:scale-[1.02]"
        >
          {t.contactFormSend}
        </button>
      </div>
    </form>
  );
}
