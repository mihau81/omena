import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FilterBar from '@/app/components/FilterBar';

const defaultProps = {
  categories: ['Wszystkie', 'Malarstwo', 'Rzeźba'],
  statuses: ['Wszystkie', 'Live', 'Nadchodzące', 'Zakończone'],
  onCategoryChange: vi.fn(),
  onStatusChange: vi.fn(),
  activeCategory: 'Wszystkie',
  activeStatus: 'Wszystkie',
};

describe('FilterBar', () => {
  describe('rendering', () => {
    it('renders all category options', () => {
      render(<FilterBar {...defaultProps} />);
      // 'Wszystkie' appears in both categories and statuses, use getAllByText
      expect(screen.getAllByText('Wszystkie')).toHaveLength(2);
      expect(screen.getByText('Malarstwo')).toBeInTheDocument();
      expect(screen.getByText('Rzeźba')).toBeInTheDocument();
    });

    it('renders all status options', () => {
      render(<FilterBar {...defaultProps} />);
      expect(screen.getByText('Live')).toBeInTheDocument();
      expect(screen.getByText('Nadchodzące')).toBeInTheDocument();
      expect(screen.getByText('Zakończone')).toBeInTheDocument();
    });

    it('renders with correct ARIA label', () => {
      render(<FilterBar {...defaultProps} />);
      expect(screen.getByRole('search', { name: /filtry aukcji/i })).toBeInTheDocument();
    });
  });

  describe('active state', () => {
    it('applies active style to activeCategory button', () => {
      render(<FilterBar {...defaultProps} activeCategory="Malarstwo" />);
      const activeBtn = screen.getByText('Malarstwo');
      expect(activeBtn).toHaveClass('bg-gold');
    });

    it('does not apply active style to inactive category button', () => {
      render(<FilterBar {...defaultProps} activeCategory="Malarstwo" />);
      const inactiveBtn = screen.getByText('Rzeźba');
      expect(inactiveBtn).not.toHaveClass('bg-gold');
    });

    it('applies active style to activeStatus button', () => {
      render(<FilterBar {...defaultProps} activeStatus="Live" />);
      const activeBtn = screen.getByText('Live');
      expect(activeBtn).toHaveClass('bg-gold');
    });
  });

  describe('interactions', () => {
    it('calls onCategoryChange with correct value when category button clicked', () => {
      const onCategoryChange = vi.fn();
      render(<FilterBar {...defaultProps} onCategoryChange={onCategoryChange} />);
      fireEvent.click(screen.getByText('Malarstwo'));
      expect(onCategoryChange).toHaveBeenCalledWith('Malarstwo');
    });

    it('calls onStatusChange with correct value when status button clicked', () => {
      const onStatusChange = vi.fn();
      render(<FilterBar {...defaultProps} onStatusChange={onStatusChange} />);
      fireEvent.click(screen.getByText('Live'));
      expect(onStatusChange).toHaveBeenCalledWith('Live');
    });

    it('calls onCategoryChange once per click', () => {
      const onCategoryChange = vi.fn();
      render(<FilterBar {...defaultProps} onCategoryChange={onCategoryChange} />);
      fireEvent.click(screen.getByText('Rzeźba'));
      expect(onCategoryChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('renders empty categories gracefully', () => {
      render(<FilterBar {...defaultProps} categories={[]} />);
      // Should not throw, status buttons still present
      expect(screen.getByText('Live')).toBeInTheDocument();
    });

    it('renders single category', () => {
      render(<FilterBar {...defaultProps} categories={['Only']} />);
      expect(screen.getByText('Only')).toBeInTheDocument();
    });
  });
});
