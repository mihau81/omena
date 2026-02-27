import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getInvoice } from '@/lib/invoice-service';
import PaymentForm from './PaymentForm';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string; invoiceId: string }>;
}

export default async function PayPage({ params }: Props) {
  const { locale, invoiceId } = await params;

  // Require authenticated user
  const session = await auth();
  if (!session?.user) {
    redirect(`/${locale}/login?next=/omena/${locale}/pay/${invoiceId}`);
  }

  const user = session.user;
  if (user.userType !== 'user') {
    redirect(`/${locale}`);
  }

  // Load the invoice
  const invoice = await getInvoice(invoiceId);
  if (!invoice) {
    redirect(`/${locale}`);
  }

  // Only the invoice owner may pay
  if (invoice.userId !== user.id) {
    redirect(`/${locale}`);
  }

  // Already paid?
  if (invoice.status === 'paid') {
    return (
      <section className="mx-auto max-w-lg px-5 py-16 text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        <h1 className="font-serif text-2xl font-bold text-dark-brown mb-2">Already Paid</h1>
        <p className="text-taupe text-sm">
          Invoice <span className="font-mono font-semibold">{invoice.invoiceNumber}</span> has already been settled.
        </p>
      </section>
    );
  }

  // Cancelled?
  if (invoice.status === 'cancelled') {
    return (
      <section className="mx-auto max-w-lg px-5 py-16 text-center">
        <h1 className="font-serif text-2xl font-bold text-dark-brown mb-2">Invoice Cancelled</h1>
        <p className="text-taupe text-sm">
          Invoice <span className="font-mono font-semibold">{invoice.invoiceNumber}</span> has been cancelled.
        </p>
      </section>
    );
  }

  const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!stripePublishableKey) {
    return (
      <section className="mx-auto max-w-lg px-5 py-16 text-center">
        <h1 className="font-serif text-2xl font-bold text-dark-brown mb-2">Payment Unavailable</h1>
        <p className="text-taupe text-sm">
          Online payment is currently unavailable. Please contact us to arrange payment.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-lg px-5 py-10 md:py-16">
      <h1 className="font-serif text-3xl font-bold text-dark-brown mb-2">Pay Invoice</h1>
      <p className="text-taupe text-sm mb-8">
        Complete your payment for auction lot below.
      </p>

      <PaymentForm
        invoiceId={invoice.id}
        invoiceNumber={invoice.invoiceNumber}
        lotTitle={invoice.lotTitle}
        lotNumber={invoice.lotNumber}
        auctionTitle={invoice.auctionTitle}
        hammerPrice={invoice.hammerPrice}
        buyersPremium={invoice.buyersPremium}
        totalAmount={invoice.totalAmount}
        currency={invoice.currency}
        stripePublishableKey={stripePublishableKey}
      />
    </section>
  );
}
