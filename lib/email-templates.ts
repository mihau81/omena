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
