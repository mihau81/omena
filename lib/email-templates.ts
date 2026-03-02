// ─── Shared Layout ───────────────────────────────────────────────────────────

const GOLD = '#C49A6C';
const DARK = '#1a1a1a';
const LIGHT_BG = '#f8f6f3';

function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
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
                You received this email because you have an account at Omena Auction House.<br />
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
): string {
  const amountFormatted = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(newBidAmount);

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
  `);
}

export function auctionStarting(
  userName: string,
  auctionTitle: string,
  startDate: Date,
  auctionUrl: string,
): string {
  const dateFormatted = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  }).format(startDate);

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
  `);
}

export function registrationApproved(
  userName: string,
  auctionTitle: string,
  paddleNumber: number,
): string {
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
  `);
}

export function registrationRejected(
  userName: string,
  auctionTitle: string,
  reason?: string,
): string {
  return layout(`
    ${heading('Registration Not Approved')}
    ${paragraph(`Dear ${userName},`)}
    ${paragraph(`We regret to inform you that your registration request for the following auction has not been approved.`)}
    ${table(highlight('Auction', auctionTitle))}
    ${reason ? paragraph(`<strong>Reason:</strong> ${reason}`) : ''}
    ${paragraph('If you have any questions or would like to provide additional information, please contact us.')}
    ${paragraph(`<span style="color:#999;font-size:12px;">For enquiries, contact us at <a href="mailto:info@omena.pl" style="color:${GOLD};">info@omena.pl</a>.</span>`)}
  `);
}

export function lotWon(
  userName: string,
  lotTitle: string,
  hammerPrice: number,
  premium: number,
  total: number,
): string {
  const fmt = (n: number) => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(n);

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
  `);
}

// ─── Account Lifecycle Templates ────────────────────────────────────────────

export function emailVerification(
  userName: string,
  verifyUrl: string,
): string {
  return layout(`
    ${heading('Verify Your Email')}
    ${paragraph(`Dear ${userName},`)}
    ${paragraph('Thank you for registering at Omena Auction House. Please verify your email address by clicking the button below.')}
    ${button('Verify Email', verifyUrl)}
    ${paragraph('<span style="color:#999;font-size:12px;">This link is valid for 24 hours. If you did not create an account, please ignore this email.</span>')}
  `);
}

export function magicLinkLogin(
  email: string,
  magicUrl: string,
): string {
  return layout(`
    ${heading('Sign In to Omena')}
    ${paragraph(`A sign-in link was requested for <strong>${email}</strong>.`)}
    ${paragraph('Click the button below to sign in to your account. No password needed.')}
    ${button('Sign In', magicUrl)}
    ${paragraph('<span style="color:#999;font-size:12px;">This link is valid for 15 minutes and can only be used once. If you did not request this, please ignore this email.</span>')}
  `);
}

export function accountApproved(
  userName: string,
): string {
  return layout(`
    ${heading('Account Approved')}
    ${paragraph(`Dear ${userName},`)}
    ${paragraph('Your account at Omena Auction House has been approved. You can now sign in and start exploring our auctions.')}
    ${paragraph('Welcome to Omena — we look forward to seeing you at our upcoming events.')}
    ${paragraph(`<span style="color:#999;font-size:12px;">If you have any questions, contact us at <a href="mailto:info@omena.pl" style="color:${GOLD};">info@omena.pl</a>.</span>`)}
  `);
}

export function accountRejected(
  userName: string,
  reason?: string,
): string {
  return layout(`
    ${heading('Account Application')}
    ${paragraph(`Dear ${userName},`)}
    ${paragraph('We regret to inform you that your account application at Omena Auction House has not been approved at this time.')}
    ${reason ? paragraph(`<strong>Reason:</strong> ${reason}`) : ''}
    ${paragraph('If you believe this is an error or would like to provide additional information, please contact us.')}
    ${paragraph(`<span style="color:#999;font-size:12px;">For enquiries, contact us at <a href="mailto:info@omena.pl" style="color:${GOLD};">info@omena.pl</a>.</span>`)}
  `);
}

export function pendingApproval(
  userName: string,
): string {
  return layout(`
    ${heading('Email Verified — Awaiting Approval')}
    ${paragraph(`Dear ${userName},`)}
    ${paragraph('Your email address has been successfully verified. Your account is now being reviewed by our team.')}
    ${paragraph('You will receive an email once your account has been approved. This usually takes 1–2 business days.')}
    ${paragraph(`<span style="color:#999;font-size:12px;">If you have any questions, contact us at <a href="mailto:info@omena.pl" style="color:${GOLD};">info@omena.pl</a>.</span>`)}
  `);
}

export function invitationTemplate(
  inviterName: string,
  inviteUrl: string,
): string {
  return layout(`
    ${heading('You\'re Invited to Omena')}
    ${paragraph(`<strong>${inviterName}</strong> has invited you to join Omena Auction House — a curated platform for art and collectibles auctions.`)}
    ${paragraph('Click the button below to create your account and start exploring our upcoming events.')}
    ${button('Accept Invitation', inviteUrl)}
    ${paragraph('<span style="color:#999;font-size:12px;">This invitation is valid for 72 hours and can only be used once. If you did not expect this, please ignore this email.</span>')}
  `);
}

export function passwordReset(
  userName: string,
  resetUrl: string,
): string {
  return layout(`
    ${heading('Reset Your Password')}
    ${paragraph(`Dear ${userName},`)}
    ${paragraph('A password reset was requested for your Omena Auction House account. Click the button below to set a new password.')}
    ${button('Reset Password', resetUrl)}
    ${paragraph('<span style="color:#999;font-size:12px;">This link is valid for 1 hour. If you did not request a password reset, please ignore this email — your password will remain unchanged.</span>')}
  `);
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
