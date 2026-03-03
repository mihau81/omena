import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

const BASE = '/omenaa';
const LOCALE = 'en';

test.describe('Pending approval page', () => {
  test('renders awaiting approval message', async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/auth/pending-approval`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Awaiting Approval')).toBeVisible();
    await expect(page.getByText(/being reviewed/i)).toBeVisible();
  });

  test('has back to login link', async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/auth/pending-approval`);
    await page.waitForLoadState('networkidle');

    const loginLink = page.getByRole('link', { name: /back to login/i });
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute('href', `/${LOCALE}/login`);
  });
});
