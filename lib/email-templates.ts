// ─── Shared Layout ───────────────────────────────────────────────────────────

const GOLD = '#C49A6C';
const DARK = '#1a1a1a';
const LIGHT_BG = '#f8f6f3';

type Locale = string;

const footerText: Record<string, string> = {
  pl: 'Otrzymujesz tę wiadomość, ponieważ masz konto w Omena Auction House.',
  en: 'You received this email because you have an account at Omena Auction House.',
  de: 'Sie erhalten diese E-Mail, weil Sie ein Konto bei Omena Auction House haben.',
  fr: 'Vous recevez cet e-mail car vous avez un compte chez Omena Auction House.',
  es: 'Recibe este correo porque tiene una cuenta en Omena Auction House.',
};

function layout(content: string, locale: Locale = 'en'): string {
  const footer = footerText[locale] || footerText.en;
  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Omena Auction House</title>
</head>
<body style="margin:0;padding:0;background:${LIGHT_BG};font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${LIGHT_BG};padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:4px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:${DARK};padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:${GOLD};font-size:28px;font-weight:normal;letter-spacing:4px;text-transform:uppercase;">
                OMENA
              </h1>
              <p style="margin:4px 0 0;color:#888;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">
                Auction House
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f0ede8;padding:24px 40px;text-align:center;">
              <p style="margin:0;color:#999;font-size:11px;font-family:Arial,sans-serif;line-height:1.6;">
                ${footer}<br />
                © ${new Date().getFullYear()} Omena. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function heading(text: string): string {
  return `<h2 style="margin:0 0 24px;color:${DARK};font-size:22px;font-weight:normal;border-bottom:2px solid ${GOLD};padding-bottom:12px;">${text}</h2>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;color:#444;font-size:15px;line-height:1.7;font-family:Arial,sans-serif;">${text}</p>`;
}

function button(label: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td style="background:${GOLD};border-radius:2px;">
        <a href="${url}" style="display:inline-block;padding:12px 28px;color:#fff;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;letter-spacing:1px;text-transform:uppercase;font-weight:bold;">${label}</a>
      </td>
    </tr>
  </table>`;
}

function highlight(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;font-family:Arial,sans-serif;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:1px;">${label}</td>
    <td style="padding:8px 0;font-family:Arial,sans-serif;font-size:15px;color:${DARK};font-weight:bold;text-align:right;">${value}</td>
  </tr>`;
}

function table(rows: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-top:1px solid #e8e4df;border-bottom:1px solid #e8e4df;">
    ${rows}
  </table>`;
}

// ─── Templates ───────────────────────────────────────────────────────────────

export function outbidNotification(
  userName: string,
  lotTitle: string,
  newBidAmount: number,
  lotUrl: string,
  locale: Locale = 'en',
): string {
  const amountFormatted = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(newBidAmount);

  if (locale === 'pl') {
    return layout(`
      ${heading('Zostałeś przebity')}
      ${paragraph(`Szanowny/a ${userName},`)}
      ${paragraph('Ktoś złożył wyższą ofertę na lot, który wygrywałeś. Działaj szybko, aby pozostać w aukcji!')}
      ${table(
        highlight('Lot', lotTitle) +
        highlight('Nowa najwyższa oferta', amountFormatted),
      )}
      ${paragraph('Nie przegap okazji — złóż nową ofertę teraz.')}
      ${button('Licytuj', lotUrl)}
      ${paragraph(`<span style="color:#999;font-size:12px;">Ten alert został wysłany, ponieważ miałeś ofertę na ten lot. Jeśli nie chcesz dalej licytować, zignoruj tę wiadomość.</span>`)}
    `, locale);
  }
  return layout(`
    ${heading('You\'ve Been Outbid')}
    ${paragraph(`Dear ${userName},`)}
    ${paragraph(`Someone has placed a higher bid on a lot you were winning. Act quickly to stay in the auction!`)}
    ${table(
      highlight('Lot', lotTitle) +
      highlight('New Highest Bid', amountFormatted),
    )}
    ${paragraph('Don\'t miss your chance — place a new bid now.')}
    ${button('Bid Now', lotUrl)}
    ${paragraph(`<span style="color:#999;font-size:12px;">This alert was sent because you had a bid on this lot. If you no longer wish to bid, simply ignore this message.</span>`)}
  `, locale);
}

export function auctionStarting(
  userName: string,
  auctionTitle: string,
  startDate: Date,
  auctionUrl: string,
  locale: Locale = 'en',
): string {
  const dateFmtLocale = locale === 'pl' ? 'pl-PL' : 'en-GB';
  const dateFormatted = new Intl.DateTimeFormat(dateFmtLocale, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  }).format(startDate);

  if (locale === 'pl') {
    return layout(`
      ${heading('Aukcja wkrótce się rozpocznie')}
      ${paragraph(`Szanowny/a ${userName},`)}
      ${paragraph('Aukcja, na którą się zarejestrowałeś, wkrótce się rozpocznie. Przygotuj się do licytacji!')}
      ${table(
        highlight('Aukcja', auctionTitle) +
        highlight('Start', dateFormatted),
      )}
      ${paragraph('Przejrzyj katalog i zaplanuj swoje oferty przed rozpoczęciem aukcji.')}
      ${button('Zobacz aukcję', auctionUrl)}
    `, locale);
  }
  return layout(`
    ${heading('Auction Starting Soon')}
    ${paragraph(`Dear ${userName},`)}
    ${paragraph(`An auction you\'ve registered for is starting soon. Make sure you\'re ready to bid!`)}
    ${table(
      highlight('Auction', auctionTitle) +
      highlight('Starts', dateFormatted),
    )}
    ${paragraph('Browse the catalog and plan your bids before the auction begins.')}
    ${button('View Auction', auctionUrl)}
  `, locale);
}

export function registrationApproved(
  userName: string,
  auctionTitle: string,
  paddleNumber: number,
  locale: Locale = 'en',
): string {
  if (locale === 'pl') {
    return layout(`
      ${heading('Rejestracja zatwierdzona')}
      ${paragraph(`Szanowny/a ${userName},`)}
      ${paragraph('Twoja rejestracja na nadchodzącą aukcję została zatwierdzona. Możesz teraz licytować.')}
      ${table(
        highlight('Aukcja', auctionTitle) +
        highlight('Twój numer tabliczki', String(paddleNumber)),
      )}
      ${paragraph('Zapamiętaj swój numer tabliczki — będziesz go potrzebować podczas aukcji.')}
      ${paragraph(`<span style="color:#999;font-size:12px;">W razie pytań skontaktuj się z nami: <a href="mailto:info@omena.pl" style="color:${GOLD};">info@omena.pl</a>.</span>`)}
    `, locale);
  }
  return layout(`
    ${heading('Registration Approved')}
    ${paragraph(`Dear ${userName},`)}
    ${paragraph(`Your registration for the upcoming auction has been approved. You are now eligible to bid.`)}
    ${table(
      highlight('Auction', auctionTitle) +
      highlight('Your Paddle Number', String(paddleNumber)),
    )}
    ${paragraph('Please note your paddle number — you will need it to participate in the live auction.')}
    ${paragraph(`<span style="color:#999;font-size:12px;">If you have any questions, please contact us at <a href="mailto:info@omena.pl" style="color:${GOLD};">info@omena.pl</a>.</span>`)}
  `, locale);
}

export function registrationRejected(
  userName: string,
  auctionTitle: string,
  reason?: string,
  locale: Locale = 'en',
): string {
  if (locale === 'pl') {
    return layout(`
      ${heading('Rejestracja niezatwierdzona')}
      ${paragraph(`Szanowny/a ${userName},`)}
      ${paragraph('Z przykrością informujemy, że Twoja rejestracja na poniższą aukcję nie została zatwierdzona.')}
      ${table(highlight('Aukcja', auctionTitle))}
      ${reason ? paragraph(`<strong>Powód:</strong> ${reason}`) : ''}
      ${paragraph('Jeśli masz pytania lub chcesz przekazać dodatkowe informacje, skontaktuj się z nami.')}
      ${paragraph(`<span style="color:#999;font-size:12px;">Kontakt: <a href="mailto:info@omena.pl" style="color:${GOLD};">info@omena.pl</a>.</span>`)}
    `, locale);
  }
  return layout(`
    ${heading('Registration Not Approved')}
    ${paragraph(`Dear ${userName},`)}
    ${paragraph(`We regret to inform you that your registration request for the following auction has not been approved.`)}
    ${table(highlight('Auction', auctionTitle))}
    ${reason ? paragraph(`<strong>Reason:</strong> ${reason}`) : ''}
    ${paragraph('If you have any questions or would like to provide additional information, please contact us.')}
    ${paragraph(`<span style="color:#999;font-size:12px;">For enquiries, contact us at <a href="mailto:info@omena.pl" style="color:${GOLD};">info@omena.pl</a>.</span>`)}
  `, locale);
}

export function lotWon(
  userName: string,
  lotTitle: string,
  hammerPrice: number,
  premium: number,
  total: number,
  locale: Locale = 'en',
): string {
  const fmt = (n: number) => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(n);

  if (locale === 'pl') {
    return layout(`
      ${heading('Gratulacje — wygrałeś!')}
      ${paragraph(`Szanowny/a ${userName},`)}
      ${paragraph('Udało Ci się wylicytować poniższy lot. Faktura zostanie wysłana wkrótce.')}
      ${table(
        highlight('Lot', lotTitle) +
        highlight('Cena wylicytowana', fmt(hammerPrice)) +
        highlight('Opłata aukcyjna', fmt(premium)) +
        highlight('Łącznie do zapłaty', fmt(total)),
      )}
      ${paragraph('Prosimy czekać na fakturę z instrukcjami płatności. Termin płatności to zazwyczaj 7 dni.')}
      ${paragraph(`<span style="color:#999;font-size:12px;">W sprawie płatności skontaktuj się z nami: <a href="mailto:info@omena.pl" style="color:${GOLD};">info@omena.pl</a>.</span>`)}
    `, locale);
  }
  return layout(`
    ${heading('Congratulations — You Won!')}
    ${paragraph(`Dear ${userName},`)}
    ${paragraph(`You have successfully won the following lot at auction. An invoice will be sent to you shortly.`)}
    ${table(
      highlight('Lot', lotTitle) +
      highlight('Hammer Price', fmt(hammerPrice)) +
      highlight("Buyer's Premium", fmt(premium)) +
      highlight('Total Due', fmt(total)),
    )}
    ${paragraph('Please await your invoice for payment instructions. Payment is typically due within 7 days.')}
    ${paragraph(`<span style="color:#999;font-size:12px;">For payment queries, contact us at <a href="mailto:info@omena.pl" style="color:${GOLD};">info@omena.pl</a>.</span>`)}
  `, locale);
}

// ─── Account Lifecycle Templates ────────────────────────────────────────────

export function emailVerification(
  userName: string,
  verifyUrl: string,
  locale: Locale = 'en',
): string {
  if (locale === 'pl') {
    return layout(`
      ${heading('Zweryfikuj swój adres email')}
      ${paragraph(`Szanowny/a ${userName},`)}
      ${paragraph('Dziękujemy za rejestrację w Omena Auction House. Kliknij poniższy przycisk, aby potwierdzić swój adres email.')}
      ${button('Zweryfikuj email', verifyUrl)}
      ${paragraph('<span style="color:#999;font-size:12px;">Ten link jest ważny przez 24 godziny. Jeśli nie zakładałeś konta, zignoruj tę wiadomość.</span>')}
    `, locale);
  }
  return layout(`
    ${heading('Verify Your Email')}
    ${paragraph(`Dear ${userName},`)}
    ${paragraph('Thank you for registering at Omena Auction House. Please verify your email address by clicking the button below.')}
    ${button('Verify Email', verifyUrl)}
    ${paragraph('<span style="color:#999;font-size:12px;">This link is valid for 24 hours. If you did not create an account, please ignore this email.</span>')}
  `, locale);
}

export function magicLinkLogin(
  email: string,
  magicUrl: string,
  locale: Locale = 'en',
): string {
  if (locale === 'pl') {
    return layout(`
      ${heading('Zaloguj się do Omena')}
      ${paragraph(`Link do logowania został wysłany na adres <strong>${email}</strong>.`)}
      ${paragraph('Kliknij poniższy przycisk, aby zalogować się na swoje konto. Hasło nie jest wymagane.')}
      ${button('Zaloguj się', magicUrl)}
      ${paragraph('<span style="color:#999;font-size:12px;">Ten link jest ważny przez 15 minut i może być użyty tylko raz. Jeśli nie prosiłeś o ten link, zignoruj tę wiadomość.</span>')}
    `, locale);
  }
  return layout(`
    ${heading('Sign In to Omena')}
    ${paragraph(`A sign-in link was requested for <strong>${email}</strong>.`)}
    ${paragraph('Click the button below to sign in to your account. No password needed.')}
    ${button('Sign In', magicUrl)}
    ${paragraph('<span style="color:#999;font-size:12px;">This link is valid for 15 minutes and can only be used once. If you did not request this, please ignore this email.</span>')}
  `, locale);
}

export function accountApproved(
  userName: string,
  locale: Locale = 'en',
): string {
  if (locale === 'pl') {
    return layout(`
      ${heading('Konto zatwierdzone')}
      ${paragraph(`Szanowny/a ${userName},`)}
      ${paragraph('Twoje konto w Omena Auction House zostało zatwierdzone. Możesz teraz się zalogować i przeglądać nasze aukcje.')}
      ${paragraph('Witamy w Omena — zapraszamy na nadchodzące wydarzenia.')}
      ${paragraph(`<span style="color:#999;font-size:12px;">W razie pytań skontaktuj się z nami: <a href="mailto:info@omena.pl" style="color:${GOLD};">info@omena.pl</a>.</span>`)}
    `, locale);
  }
  return layout(`
    ${heading('Account Approved')}
    ${paragraph(`Dear ${userName},`)}
    ${paragraph('Your account at Omena Auction House has been approved. You can now sign in and start exploring our auctions.')}
    ${paragraph('Welcome to Omena — we look forward to seeing you at our upcoming events.')}
    ${paragraph(`<span style="color:#999;font-size:12px;">If you have any questions, contact us at <a href="mailto:info@omena.pl" style="color:${GOLD};">info@omena.pl</a>.</span>`)}
  `, locale);
}

export function accountRejected(
  userName: string,
  reason?: string,
  locale: Locale = 'en',
): string {
  if (locale === 'pl') {
    return layout(`
      ${heading('Wniosek o konto')}
      ${paragraph(`Szanowny/a ${userName},`)}
      ${paragraph('Z przykrością informujemy, że Twój wniosek o konto w Omena Auction House nie został zatwierdzony.')}
      ${reason ? paragraph(`<strong>Powód:</strong> ${reason}`) : ''}
      ${paragraph('Jeśli uważasz, że to pomyłka lub chcesz przekazać dodatkowe informacje, skontaktuj się z nami.')}
      ${paragraph(`<span style="color:#999;font-size:12px;">Kontakt: <a href="mailto:info@omena.pl" style="color:${GOLD};">info@omena.pl</a>.</span>`)}
    `, locale);
  }
  return layout(`
    ${heading('Account Application')}
    ${paragraph(`Dear ${userName},`)}
    ${paragraph('We regret to inform you that your account application at Omena Auction House has not been approved at this time.')}
    ${reason ? paragraph(`<strong>Reason:</strong> ${reason}`) : ''}
    ${paragraph('If you believe this is an error or would like to provide additional information, please contact us.')}
    ${paragraph(`<span style="color:#999;font-size:12px;">For enquiries, contact us at <a href="mailto:info@omena.pl" style="color:${GOLD};">info@omena.pl</a>.</span>`)}
  `, locale);
}

export function pendingApproval(
  userName: string,
  locale: Locale = 'en',
): string {
  if (locale === 'pl') {
    return layout(`
      ${heading('Email zweryfikowany — oczekiwanie na zatwierdzenie')}
      ${paragraph(`Szanowny/a ${userName},`)}
      ${paragraph('Twój adres email został pomyślnie zweryfikowany. Twoje konto jest teraz weryfikowane przez nasz zespół.')}
      ${paragraph('Otrzymasz wiadomość email, gdy Twoje konto zostanie zatwierdzone. Zwykle zajmuje to 1–2 dni robocze.')}
      ${paragraph(`<span style="color:#999;font-size:12px;">W razie pytań skontaktuj się z nami: <a href="mailto:info@omena.pl" style="color:${GOLD};">info@omena.pl</a>.</span>`)}
    `, locale);
  }
  return layout(`
    ${heading('Email Verified — Awaiting Approval')}
    ${paragraph(`Dear ${userName},`)}
    ${paragraph('Your email address has been successfully verified. Your account is now being reviewed by our team.')}
    ${paragraph('You will receive an email once your account has been approved. This usually takes 1–2 business days.')}
    ${paragraph(`<span style="color:#999;font-size:12px;">If you have any questions, contact us at <a href="mailto:info@omena.pl" style="color:${GOLD};">info@omena.pl</a>.</span>`)}
  `, locale);
}

export function invitationTemplate(
  inviterName: string,
  inviteUrl: string,
  locale: Locale = 'en',
): string {
  if (locale === 'pl') {
    return layout(`
      ${heading('Zaproszenie do Omena')}
      ${paragraph(`<strong>${inviterName}</strong> zaprasza Cię do dołączenia do Omena Auction House — platformy aukcji sztuki i kolekcjonerstwa.`)}
      ${paragraph('Kliknij poniższy przycisk, aby utworzyć konto i zacząć przeglądać nadchodzące wydarzenia.')}
      ${button('Przyjmij zaproszenie', inviteUrl)}
      ${paragraph('<span style="color:#999;font-size:12px;">To zaproszenie jest ważne przez 72 godziny i może być użyte tylko raz. Jeśli nie oczekiwałeś tego zaproszenia, zignoruj tę wiadomość.</span>')}
    `, locale);
  }
  return layout(`
    ${heading('You\'re Invited to Omena')}
    ${paragraph(`<strong>${inviterName}</strong> has invited you to join Omena Auction House — a curated platform for art and collectibles auctions.`)}
    ${paragraph('Click the button below to create your account and start exploring our upcoming events.')}
    ${button('Accept Invitation', inviteUrl)}
    ${paragraph('<span style="color:#999;font-size:12px;">This invitation is valid for 72 hours and can only be used once. If you did not expect this, please ignore this email.</span>')}
  `, locale);
}

export function passwordReset(
  userName: string,
  resetUrl: string,
  locale: Locale = 'en',
): string {
  if (locale === 'pl') {
    return layout(`
      ${heading('Resetowanie hasła')}
      ${paragraph(`Szanowny/a ${userName},`)}
      ${paragraph('Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta w Omena Auction House. Kliknij poniższy przycisk, aby ustawić nowe hasło.')}
      ${button('Zresetuj hasło', resetUrl)}
      ${paragraph('<span style="color:#999;font-size:12px;">Ten link jest ważny przez 1 godzinę. Jeśli nie prosiłeś o reset hasła, zignoruj tę wiadomość — Twoje hasło pozostanie bez zmian.</span>')}
    `, locale);
  }
  return layout(`
    ${heading('Reset Your Password')}
    ${paragraph(`Dear ${userName},`)}
    ${paragraph('A password reset was requested for your Omena Auction House account. Click the button below to set a new password.')}
    ${button('Reset Password', resetUrl)}
    ${paragraph('<span style="color:#999;font-size:12px;">This link is valid for 1 hour. If you did not request a password reset, please ignore this email — your password will remain unchanged.</span>')}
  `, locale);
}

export function adminNewUserPending(
  userName: string,
  userEmail: string,
): string {
  return layout(`
    ${heading('New User Awaiting Approval')}
    ${paragraph('A new user has verified their email and is awaiting your approval:')}
    ${table(
      highlight('Name', userName) +
      highlight('Email', userEmail),
    )}
    ${paragraph('Please review and approve or reject this application in the admin panel.')}
  `);
}

export function invoiceReady(
  userName: string,
  lotTitle: string,
  lotNumber: number,
  invoiceNumber: string,
  hammerPrice: number,
  buyersPremium: number,
  totalAmount: number,
  dueDate: Date,
  invoiceUrl: string,
): string {
  const fmt = (n: number) => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(n);
  const dueDateFormatted = new Intl.DateTimeFormat('pl-PL', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(dueDate);

  return layout(`
    ${heading('Faktura jest gotowa')}
    ${paragraph(`Szanowny/a ${userName},`)}
    ${paragraph(`Dziękujemy za udział w aukcji. Poniżej znajdziesz szczegóły faktury za wylicytowany lot.`)}
    ${table(
      highlight('Lot', `#${lotNumber} — ${lotTitle}`) +
      highlight('Nr faktury', invoiceNumber) +
      highlight('Cena wylicytowana', fmt(hammerPrice)) +
      highlight('Opłata aukcyjna', fmt(buyersPremium)) +
      highlight('Łączna kwota', fmt(totalAmount)) +
      highlight('Termin płatności', dueDateFormatted),
    )}
    ${paragraph('Prosimy o dokonanie płatności w terminie wskazanym powyżej. Szczegóły płatności znajdziesz w fakturze.')}
    ${button('Wyświetl fakturę', invoiceUrl)}
    ${paragraph(`<span style="color:#999;font-size:12px;">W razie pytań prosimy o kontakt: <a href="mailto:info@omena.pl" style="color:${GOLD};">info@omena.pl</a>.</span>`)}
  `);
}

export function paymentReminder(
  userName: string,
  lotTitle: string,
  invoiceNumber: string,
  totalAmount: number,
  dueDate: Date,
  invoiceUrl: string,
): string {
  const fmt = (n: number) => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(n);
  const dueDateFormatted = new Intl.DateTimeFormat('pl-PL', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(dueDate);

  return layout(`
    ${heading('Przypomnienie o płatności')}
    ${paragraph(`Szanowny/a ${userName},`)}
    ${paragraph(`Przypominamy o nieuregulowanej płatności za wylicytowany lot.`)}
    ${table(
      highlight('Lot', lotTitle) +
      highlight('Nr faktury', invoiceNumber) +
      highlight('Kwota do zapłaty', fmt(totalAmount)) +
      highlight('Termin płatności', dueDateFormatted),
    )}
    ${paragraph('Prosimy o jak najszybsze uregulowanie należności, aby uniknąć konsekwencji wynikających z regulaminu aukcji.')}
    ${button('Przejdź do faktury', invoiceUrl)}
    ${paragraph(`<span style="color:#999;font-size:12px;">W razie pytań prosimy o kontakt: <a href="mailto:info@omena.pl" style="color:${GOLD};">info@omena.pl</a>.</span>`)}
  `);
}
