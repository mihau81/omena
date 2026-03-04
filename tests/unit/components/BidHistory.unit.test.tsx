import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock context hooks
vi.mock('@/app/lib/BiddingContext', () => ({
  useBidding: vi.fn(),
}));

vi.mock('@/app/lib/LocaleContext', () => ({
  useLocale: vi.fn(),
}));

vi.mock('@/app/lib/CurrencyContext', () => ({
  useCurrency: vi.fn(),
}));

import BidHistory from '@/app/components/BidHistory';
import { useBidding } from '@/app/lib/BiddingContext';
import { useLocale } from '@/app/lib/LocaleContext';
import { useCurrency } from '@/app/lib/CurrencyContext';

type MockBid = {
  id: string;
  lotId: string;
  amount: number;
  paddleNumber: number | null;
  bidType: string;
  isWinning: boolean;
  isRetracted: boolean;
  createdAt: string;
  isUser: boolean;
};

const mockT = {
  bidHistory: 'Bid history',
  noBidsYet: 'No bids yet',
};

function makeBid(overrides: Partial<MockBid> & { id: string; amount: number }): MockBid {
  return {
    lotId: 'lot-1',
    paddleNumber: null,
    bidType: 'online',
    isWinning: false,
    isRetracted: false,
    createdAt: '2024-01-15T12:00:00Z',
    isUser: false,
    ...overrides,
  };
}

function setupMocks(bids: MockBid[] = []) {
  (useBidding as ReturnType<typeof vi.fn>).mockReturnValue({
    getBidsForLot: vi.fn().mockReturnValue(bids),
  });
  (useLocale as ReturnType<typeof vi.fn>).mockReturnValue({ t: mockT });
  (useCurrency as ReturnType<typeof vi.fn>).mockReturnValue({
    formatPrice: (amount: number) => `${amount} PLN`,
  });
}

describe('BidHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('collapsed state (initial)', () => {
    it('renders the toggle button with bid count', () => {
      setupMocks([]);
      render(<BidHistory lotId="lot-1" />);
      expect(screen.getByText(/Bid history \(0\)/)).toBeInTheDocument();
    });

    it('does not show bid list when collapsed', () => {
      setupMocks([]);
      render(<BidHistory lotId="lot-1" />);
      expect(screen.queryByText('No bids yet')).not.toBeInTheDocument();
    });
  });

  describe('expanded state', () => {
    it('shows empty state message when no bids', () => {
      setupMocks([]);
      render(<BidHistory lotId="lot-1" />);
      fireEvent.click(screen.getByText(/Bid history/));
      expect(screen.getByText('No bids yet')).toBeInTheDocument();
    });

    it('renders list of bids with paddle numbers', () => {
      const bids: MockBid[] = [
        makeBid({ id: 'bid-1', amount: 5000, paddleNumber: 42 }),
        makeBid({ id: 'bid-2', amount: 6000, paddleNumber: 77 }),
      ];
      setupMocks(bids);
      render(<BidHistory lotId="lot-1" />);
      fireEvent.click(screen.getByText(/Bid history \(2\)/));

      expect(screen.getByText('Licytant #42')).toBeInTheDocument();
      expect(screen.getByText('Licytant #77')).toBeInTheDocument();
    });

    it('shows "Oferta" when paddleNumber is null', () => {
      const bids: MockBid[] = [
        makeBid({ id: 'bid-1', amount: 5000, paddleNumber: null }),
      ];
      setupMocks(bids);
      render(<BidHistory lotId="lot-1" />);
      fireEvent.click(screen.getByText(/Bid history/));

      expect(screen.getByText('Oferta')).toBeInTheDocument();
    });

    it('shows formatted price for each bid', () => {
      const bids: MockBid[] = [
        makeBid({ id: 'bid-1', amount: 5000 }),
      ];
      setupMocks(bids);
      render(<BidHistory lotId="lot-1" />);
      fireEvent.click(screen.getByText(/Bid history/));

      expect(screen.getByText('5000 PLN')).toBeInTheDocument();
    });

    it('shows "(Ty)" label for user bids', () => {
      const bids: MockBid[] = [
        makeBid({ id: 'bid-1', amount: 5000, isUser: true }),
      ];
      setupMocks(bids);
      render(<BidHistory lotId="lot-1" />);
      fireEvent.click(screen.getByText(/Bid history/));

      expect(screen.getByText('(Ty)')).toBeInTheDocument();
    });

    it('does not show "(Ty)" for non-user bids', () => {
      const bids: MockBid[] = [
        makeBid({ id: 'bid-1', amount: 5000, paddleNumber: 42, isUser: false }),
      ];
      setupMocks(bids);
      render(<BidHistory lotId="lot-1" />);
      fireEvent.click(screen.getByText(/Bid history/));

      expect(screen.queryByText('(Ty)')).not.toBeInTheDocument();
    });

    it('shows retracted bids with strikethrough and label', () => {
      const bids: MockBid[] = [
        makeBid({ id: 'bid-1', amount: 5000, isRetracted: true, paddleNumber: 42 }),
      ];
      setupMocks(bids);
      render(<BidHistory lotId="lot-1" />);
      fireEvent.click(screen.getByText(/Bid history/));

      expect(screen.getByText('(wycofana)')).toBeInTheDocument();
    });
  });

  describe('show more', () => {
    it('shows "Pokaż więcej" button when more than 10 bids', () => {
      const bids: MockBid[] = Array.from({ length: 15 }, (_, i) =>
        makeBid({ id: `bid-${i}`, amount: 5000 + i * 100, paddleNumber: 100 + i }),
      );
      setupMocks(bids);
      render(<BidHistory lotId="lot-1" />);
      fireEvent.click(screen.getByText(/Bid history/));

      expect(screen.getByText(/Pokaż więcej/)).toBeInTheDocument();
    });

    it('does not show "Pokaż więcej" for 10 or fewer bids', () => {
      const bids: MockBid[] = Array.from({ length: 10 }, (_, i) =>
        makeBid({ id: `bid-${i}`, amount: 5000 + i * 100, paddleNumber: 100 + i }),
      );
      setupMocks(bids);
      render(<BidHistory lotId="lot-1" />);
      fireEvent.click(screen.getByText(/Bid history/));

      expect(screen.queryByText(/Pokaż więcej/)).not.toBeInTheDocument();
    });

    it('shows all bids after clicking "Pokaż więcej"', () => {
      const bids: MockBid[] = Array.from({ length: 15 }, (_, i) =>
        makeBid({ id: `bid-${i}`, amount: 5000 + i * 100, paddleNumber: 100 + i }),
      );
      setupMocks(bids);
      render(<BidHistory lotId="lot-1" />);
      fireEvent.click(screen.getByText(/Bid history/));
      fireEvent.click(screen.getByText(/Pokaż więcej/));

      // All 15 bidders should be visible (last one is paddle 114)
      expect(screen.getByText('Licytant #114')).toBeInTheDocument();
    });
  });

  describe('toggle', () => {
    it('collapses bid list when toggle clicked twice', () => {
      setupMocks([]);
      render(<BidHistory lotId="lot-1" />);
      const toggleBtn = screen.getByText(/Bid history/);
      fireEvent.click(toggleBtn); // expand
      expect(screen.getByText('No bids yet')).toBeInTheDocument();
      fireEvent.click(toggleBtn); // collapse
      expect(screen.queryByText('No bids yet')).not.toBeInTheDocument();
    });
  });
});
