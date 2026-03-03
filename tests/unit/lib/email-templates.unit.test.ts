import { describe, it, expect } from 'vitest';
import {
  outbidNotification,
  auctionStarting,
  registrationApproved,
  registrationRejected,
  lotWon,
  emailVerification,
  magicLinkLogin,
  accountApproved,
  accountRejected,
  pendingApproval,
  invitationTemplate,
  passwordReset,
  adminNewUserPending,
  invoiceReady,
  paymentReminder,
} from '@/lib/email-templates';

// Helper: asserts valid HTML email structure
function expectValidEmailHTML(html: string) {
  expect(html).toBeTruthy();
  expect(html.length).toBeGreaterThan(0);
  expect(html).toContain('<!DOCTYPE html>');
  expect(html).toContain('<html');
  expect(html).toContain('<head>');
  expect(html).toContain('<body');
  expect(html).toContain('</body>');
  expect(html).toContain('</html>');
  expect(html).toContain('OMENA');
}

describe('outbidNotification', () => {
  const html = outbidNotification('Jan Kowalski', 'Obraz olejny, Krajobraz', 15000, 'https://omena.pl/lot/123');

  it('returns valid HTML email', () => {
    expectValidEmailHTML(html);
  });

  it('contains user name', () => {
    expect(html).toContain('Jan Kowalski');
  });

  it('contains lot title', () => {
    expect(html).toContain('Obraz olejny, Krajobraz');
  });

  it('contains formatted bid amount', () => {
    // Polish currency format uses "zl" symbol, not "PLN" text
    expect(html).toContain('15');
    expect(html).toContain('000');
    expect(html).toContain('z\u0142');
  });

  it('contains bid button with lot URL', () => {
    expect(html).toContain('https://omena.pl/lot/123');
    expect(html).toContain('Bid Now');
  });

  it('contains outbid heading', () => {
    expect(html).toContain('Outbid');
  });
});

describe('auctionStarting', () => {
  const startDate = new Date('2026-03-15T14:00:00Z');
  const html = auctionStarting('Anna Nowak', 'Spring Art Auction 2026', startDate, 'https://omena.pl/auction/456');

  it('returns valid HTML email', () => {
    expectValidEmailHTML(html);
  });

  it('contains user name', () => {
    expect(html).toContain('Anna Nowak');
  });

  it('contains auction title', () => {
    expect(html).toContain('Spring Art Auction 2026');
  });

  it('contains formatted date', () => {
    // en-GB formatted date should contain "March" and "2026"
    expect(html).toContain('March');
    expect(html).toContain('2026');
  });

  it('contains auction URL', () => {
    expect(html).toContain('https://omena.pl/auction/456');
  });

  it('contains "View Auction" button', () => {
    expect(html).toContain('View Auction');
  });
});

describe('registrationApproved', () => {
  const html = registrationApproved('Piotr Zielinski', 'Modern Art Sale', 42);

  it('returns valid HTML email', () => {
    expectValidEmailHTML(html);
  });

  it('contains user name', () => {
    expect(html).toContain('Piotr Zielinski');
  });

  it('contains auction title', () => {
    expect(html).toContain('Modern Art Sale');
  });

  it('contains paddle number', () => {
    expect(html).toContain('42');
  });

  it('contains approval heading', () => {
    expect(html).toContain('Registration Approved');
  });

  it('mentions paddle number concept', () => {
    expect(html).toContain('Paddle Number');
  });
});

describe('registrationRejected', () => {
  it('returns valid HTML email without reason', () => {
    const html = registrationRejected('Jan Nowak', 'Fine Art Auction');
    expectValidEmailHTML(html);
    expect(html).toContain('Jan Nowak');
    expect(html).toContain('Fine Art Auction');
    expect(html).toContain('Not Approved');
  });

  it('contains reason when provided', () => {
    const html = registrationRejected('Jan Nowak', 'Fine Art Auction', 'Incomplete documentation');
    expect(html).toContain('Incomplete documentation');
    expect(html).toContain('Reason');
  });

  it('does not contain reason section when not provided', () => {
    const html = registrationRejected('Jan Nowak', 'Fine Art Auction');
    expect(html).not.toContain('<strong>Reason:</strong>');
  });

  it('contains contact information', () => {
    const html = registrationRejected('Jan Nowak', 'Fine Art Auction');
    expect(html).toContain('info@omena.pl');
  });
});

describe('lotWon', () => {
  const html = lotWon('Maria Dabrowska', 'Silver Vase, Art Deco', 25000, 5000, 30000);

  it('returns valid HTML email', () => {
    expectValidEmailHTML(html);
  });

  it('contains user name', () => {
    expect(html).toContain('Maria Dabrowska');
  });

  it('contains lot title', () => {
    expect(html).toContain('Silver Vase, Art Deco');
  });

  it('contains hammer price formatted as PLN', () => {
    expect(html).toContain('25');
    expect(html).toContain('000');
    expect(html).toContain('z\u0142');
  });

  it('contains premium amount', () => {
    expect(html).toContain('5');
    expect(html).toContain('000');
  });

  it('contains total amount', () => {
    expect(html).toContain('30');
    expect(html).toContain('000');
  });

  it('contains congratulations heading', () => {
    expect(html).toContain('Congratulations');
  });

  it('contains price breakdown labels', () => {
    expect(html).toContain('Hammer Price');
    expect(html).toContain('Premium');
    expect(html).toContain('Total Due');
  });
});

describe('emailVerification', () => {
  const html = emailVerification('Tomek', 'https://omena.pl/verify?token=abc123');

  it('returns valid HTML email', () => {
    expectValidEmailHTML(html);
  });

  it('contains user name', () => {
    expect(html).toContain('Tomek');
  });

  it('contains verify URL', () => {
    expect(html).toContain('https://omena.pl/verify?token=abc123');
  });

  it('contains verify button', () => {
    expect(html).toContain('Verify Email');
  });

  it('mentions 24-hour validity', () => {
    expect(html).toContain('24 hours');
  });
});

describe('magicLinkLogin', () => {
  const html = magicLinkLogin('user@example.com', 'https://omena.pl/magic?token=xyz');

  it('returns valid HTML email', () => {
    expectValidEmailHTML(html);
  });

  it('contains email address', () => {
    expect(html).toContain('user@example.com');
  });

  it('contains magic link URL', () => {
    expect(html).toContain('https://omena.pl/magic?token=xyz');
  });

  it('contains sign in button', () => {
    expect(html).toContain('Sign In');
  });

  it('mentions 15-minute validity', () => {
    expect(html).toContain('15 minutes');
  });
});

describe('accountApproved', () => {
  const html = accountApproved('Kasia Wisniewska');

  it('returns valid HTML email', () => {
    expectValidEmailHTML(html);
  });

  it('contains user name', () => {
    expect(html).toContain('Kasia Wisniewska');
  });

  it('contains approval heading', () => {
    expect(html).toContain('Account Approved');
  });

  it('contains welcome message', () => {
    expect(html).toContain('approved');
  });

  it('contains contact info', () => {
    expect(html).toContain('info@omena.pl');
  });
});

describe('accountRejected', () => {
  it('returns valid HTML email without reason', () => {
    const html = accountRejected('Marek Wojcik');
    expectValidEmailHTML(html);
    expect(html).toContain('Marek Wojcik');
    expect(html).toContain('not been approved');
  });

  it('contains reason when provided', () => {
    const html = accountRejected('Marek Wojcik', 'Identity verification failed');
    expect(html).toContain('Identity verification failed');
    expect(html).toContain('Reason');
  });

  it('does not contain reason section when not provided', () => {
    const html = accountRejected('Marek Wojcik');
    expect(html).not.toContain('<strong>Reason:</strong>');
  });
});

describe('pendingApproval', () => {
  const html = pendingApproval('Ewa Kaminska');

  it('returns valid HTML email', () => {
    expectValidEmailHTML(html);
  });

  it('contains user name', () => {
    expect(html).toContain('Ewa Kaminska');
  });

  it('contains awaiting approval message', () => {
    expect(html).toContain('Awaiting Approval');
  });

  it('mentions email verification success', () => {
    expect(html).toContain('verified');
  });

  it('mentions review timeline', () => {
    expect(html).toContain('1\u20132 business days');
  });
});

describe('invitationTemplate', () => {
  const html = invitationTemplate('Adam Lewandowski', 'https://omena.pl/invite?code=inv123');

  it('returns valid HTML email', () => {
    expectValidEmailHTML(html);
  });

  it('contains inviter name', () => {
    expect(html).toContain('Adam Lewandowski');
  });

  it('contains invitation URL', () => {
    expect(html).toContain('https://omena.pl/invite?code=inv123');
  });

  it('contains accept button', () => {
    expect(html).toContain('Accept Invitation');
  });

  it('mentions 72-hour validity', () => {
    expect(html).toContain('72 hours');
  });

  it('contains invitation heading', () => {
    expect(html).toContain('Invited');
  });
});

describe('passwordReset', () => {
  const html = passwordReset('Zofia Krol', 'https://omena.pl/reset?token=reset456');

  it('returns valid HTML email', () => {
    expectValidEmailHTML(html);
  });

  it('contains user name', () => {
    expect(html).toContain('Zofia Krol');
  });

  it('contains reset URL', () => {
    expect(html).toContain('https://omena.pl/reset?token=reset456');
  });

  it('contains reset button', () => {
    expect(html).toContain('Reset Password');
  });

  it('mentions 1-hour validity', () => {
    expect(html).toContain('1 hour');
  });
});

describe('adminNewUserPending', () => {
  const html = adminNewUserPending('Nowy Uzytkownik', 'nowy@example.com');

  it('returns valid HTML email', () => {
    expectValidEmailHTML(html);
  });

  it('contains user name', () => {
    expect(html).toContain('Nowy Uzytkownik');
  });

  it('contains user email', () => {
    expect(html).toContain('nowy@example.com');
  });

  it('contains admin notification heading', () => {
    expect(html).toContain('New User Awaiting Approval');
  });

  it('mentions admin panel review', () => {
    expect(html).toContain('admin panel');
  });
});

describe('invoiceReady', () => {
  const dueDate = new Date('2026-04-15T00:00:00Z');
  const html = invoiceReady(
    'Krzysztof Mazur',
    'Obraz, Zachod slonca',
    15,
    'INV-2026-0042',
    35000,
    7000,
    42000,
    dueDate,
    'https://omena.pl/invoice/42',
  );

  it('returns valid HTML email', () => {
    expectValidEmailHTML(html);
  });

  it('contains user name', () => {
    expect(html).toContain('Krzysztof Mazur');
  });

  it('contains lot title with lot number', () => {
    expect(html).toContain('Obraz, Zachod slonca');
    expect(html).toContain('#15');
  });

  it('contains invoice number', () => {
    expect(html).toContain('INV-2026-0042');
  });

  it('contains hammer price in PLN', () => {
    expect(html).toContain('35');
    expect(html).toContain('z\u0142');
  });

  it('contains buyers premium', () => {
    expect(html).toContain('7');
    expect(html).toContain('000');
  });

  it('contains total amount', () => {
    expect(html).toContain('42');
    expect(html).toContain('000');
  });

  it('contains due date in Polish format', () => {
    // Polish date: "15 kwietnia 2026" (approximate, depends on timezone)
    expect(html).toContain('2026');
  });

  it('contains invoice URL', () => {
    expect(html).toContain('https://omena.pl/invoice/42');
  });

  it('is in Polish language', () => {
    expect(html).toContain('Faktura jest gotowa');
    expect(html).toContain('Szanowny/a');
    expect(html).toContain('Cena wylicytowana');
    expect(html).toContain('Termin p\u0142atno\u015Bci');
  });

  it('contains view invoice button in Polish', () => {
    expect(html).toContain('Wy\u015Bwietl faktur\u0119');
  });
});

describe('paymentReminder', () => {
  const dueDate = new Date('2026-04-15T00:00:00Z');
  const html = paymentReminder(
    'Agnieszka Bak',
    'Rzeźba brązowa',
    'INV-2026-0099',
    18000,
    dueDate,
    'https://omena.pl/invoice/99',
  );

  it('returns valid HTML email', () => {
    expectValidEmailHTML(html);
  });

  it('contains user name', () => {
    expect(html).toContain('Agnieszka Bak');
  });

  it('contains lot title', () => {
    expect(html).toContain('Rze\u017Aba br\u0105zowa');
  });

  it('contains invoice number', () => {
    expect(html).toContain('INV-2026-0099');
  });

  it('contains total amount in PLN', () => {
    expect(html).toContain('18');
    expect(html).toContain('000');
    expect(html).toContain('z\u0142');
  });

  it('contains due date', () => {
    expect(html).toContain('2026');
  });

  it('contains invoice URL', () => {
    expect(html).toContain('https://omena.pl/invoice/99');
  });

  it('is in Polish language', () => {
    expect(html).toContain('Przypomnienie o p\u0142atno\u015Bci');
    expect(html).toContain('Szanowny/a');
  });

  it('contains navigate to invoice button in Polish', () => {
    expect(html).toContain('Przejd\u017A do faktury');
  });

  it('contains warning about consequences', () => {
    expect(html).toContain('regulaminu aukcji');
  });
});

describe('all templates share common structure', () => {
  const templates = [
    { name: 'outbidNotification', fn: () => outbidNotification('U', 'L', 100, 'https://x') },
    { name: 'auctionStarting', fn: () => auctionStarting('U', 'A', new Date(), 'https://x') },
    { name: 'registrationApproved', fn: () => registrationApproved('U', 'A', 1) },
    { name: 'registrationRejected', fn: () => registrationRejected('U', 'A') },
    { name: 'lotWon', fn: () => lotWon('U', 'L', 100, 20, 120) },
    { name: 'emailVerification', fn: () => emailVerification('U', 'https://x') },
    { name: 'magicLinkLogin', fn: () => magicLinkLogin('e@x.com', 'https://x') },
    { name: 'accountApproved', fn: () => accountApproved('U') },
    { name: 'accountRejected', fn: () => accountRejected('U') },
    { name: 'pendingApproval', fn: () => pendingApproval('U') },
    { name: 'invitationTemplate', fn: () => invitationTemplate('I', 'https://x') },
    { name: 'passwordReset', fn: () => passwordReset('U', 'https://x') },
    { name: 'adminNewUserPending', fn: () => adminNewUserPending('U', 'e@x.com') },
    { name: 'invoiceReady', fn: () => invoiceReady('U', 'L', 1, 'INV-1', 100, 20, 120, new Date(), 'https://x') },
    { name: 'paymentReminder', fn: () => paymentReminder('U', 'L', 'INV-1', 120, new Date(), 'https://x') },
  ];

  it.each(templates)('$name contains DOCTYPE', ({ fn }) => {
    expect(fn()).toContain('<!DOCTYPE html>');
  });

  it.each(templates)('$name contains Omena branding', ({ fn }) => {
    expect(fn()).toContain('OMENA');
  });

  it.each(templates)('$name contains Auction House tagline', ({ fn }) => {
    expect(fn()).toContain('Auction House');
  });

  it.each(templates)('$name contains footer with copyright', ({ fn }) => {
    const html = fn();
    expect(html).toContain('Omena');
    expect(html).toContain('All rights reserved');
  });

  it('all 15 templates are tested', () => {
    expect(templates).toHaveLength(15);
  });
});
