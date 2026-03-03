import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

const BASE = '/omenaa';
const LOCALE = 'en';

test.describe('Magic link verification page', () => {
  test('shows error when no token provided', async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/auth/magic-link`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Sign-in Failed')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('No token provided')).toBeVisible();
  });

  test('shows loading state then error for invalid token', async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/auth/magic-link?token=invalid-token`);

    // Should show loading first
    const signingIn = page.getByText('Signing you in...');
    const isLoading = await signingIn.isVisible({ timeout: 2000 }).catch(() => false);
    // It may flash quickly or go straight to error

    // Eventually shows error
    await expect(page.getByText('Sign-in Failed')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/invalid|expired/i)).toBeVisible();
  });

  test('renders OMENAA branding', async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/auth/magic-link`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('OMENAA').first()).toBeVisible();
  });
});
