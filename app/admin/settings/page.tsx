import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings',
};

export default function SettingsPage() {
  const sections = [
    {
      title: 'Auction House Information',
      description: 'Manage your auction house name, logo, and contact details.',
    },
    {
      title: 'Default Settings',
      description: 'Configure default buyer\'s premium rates, currency, and bidding increments.',
    },
    {
      title: 'Email Configuration',
      description: 'Set up email templates, SMTP settings, and notification preferences.',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-dark-brown">Settings</h1>
        <p className="text-sm text-taupe mt-1">Manage auction house configuration</p>
      </div>

      <div className="space-y-4">
        {sections.map((section) => (
          <div
            key={section.title}
            className="bg-white rounded-xl border border-beige shadow-sm p-6"
          >
            <h2 className="text-lg font-serif font-bold text-dark-brown mb-2">
              {section.title}
            </h2>
            <p className="text-sm text-taupe mb-4">{section.description}</p>
            <div className="rounded-lg bg-cream/50 border border-beige px-4 py-3 text-sm text-taupe">
              Coming soon
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
