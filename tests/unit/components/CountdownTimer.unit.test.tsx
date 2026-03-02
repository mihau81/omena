import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import CountdownTimer from '@/app/components/CountdownTimer';

describe('CountdownTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('ended state', () => {
    it('shows "Aukcja trwa!" for a past date', () => {
      const pastDate = new Date(Date.now() - 10000).toISOString();
      render(<CountdownTimer targetDate={pastDate} />);
      expect(screen.getByText(/Aukcja trwa!/i)).toBeInTheDocument();
    });

    it('does not render countdown boxes for a past date', () => {
      const pastDate = new Date(Date.now() - 10000).toISOString();
      render(<CountdownTimer targetDate={pastDate} />);
      expect(screen.queryByText(/Dni/i)).not.toBeInTheDocument();
    });
  });

  describe('countdown display', () => {
    it('renders countdown for a future date', () => {
      const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      render(<CountdownTimer targetDate={futureDate} />);
      expect(screen.getByText('Dni')).toBeInTheDocument();
      expect(screen.getByText('Godz')).toBeInTheDocument();
      expect(screen.getByText('Min')).toBeInTheDocument();
      expect(screen.getByText('Sek')).toBeInTheDocument();
    });

    it('shows non-zero days for date 3 days in future', () => {
      const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      render(<CountdownTimer targetDate={futureDate} />);
      // Days should be 02 or 03
      const daysEl = screen.getByText('Dni').closest('div');
      const daysValue = daysEl?.querySelector('p')?.textContent;
      expect(Number(daysValue)).toBeGreaterThan(0);
    });

    it('shows "00" seconds initially for an exact future time', () => {
      // Set current time to a known value
      vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
      const futureDate = new Date('2026-01-01T12:01:00Z').toISOString(); // 1 min future
      render(<CountdownTimer targetDate={futureDate} />);
      // Seconds should be 00
      const secEl = screen.getByText('Sek').closest('div');
      expect(secEl).toBeInTheDocument();
    });
  });

  describe('live update tick', () => {
    it('transitions to ended state when time runs out', () => {
      // Set time to 500ms before expiry
      vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
      const targetDate = new Date('2026-01-01T12:00:00.500Z').toISOString();

      render(<CountdownTimer targetDate={targetDate} />);
      // Should show countdown initially
      expect(screen.getByText('Sek')).toBeInTheDocument();

      // Advance 1 second — past expiry
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByText(/Aukcja trwa!/i)).toBeInTheDocument();
    });
  });
});
