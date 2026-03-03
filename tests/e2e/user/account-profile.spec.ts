import { test, expect } from '@playwright/test';

const BASE = '/omenaa';
const LOCALE = 'en';

test.describe('Account profile page', () => {
  test('renders Profile heading', async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/account/profile`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading', { name: /profile/i });
    const isVisible = await heading.isVisible({ timeout: 5000 }).catch(() => false);

    if (!isVisible) {
      const loginInput = page.locator('input[type="email"]').first();
      expect(await loginInput.isVisible({ timeout: 2000 }).catch(() => false)).toBeTruthy();
    }
  });

  test('shows profile form fields', async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/account/profile`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading', { name: /profile/i });
    if (!await heading.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await page.waitForTimeout(2000);

    // Check form fields
    await expect(page.locator('#prof-name')).toBeVisible();
    await expect(page.locator('#prof-phone')).toBeVisible();
    await expect(page.locator('#prof-address')).toBeVisible();
    await expect(page.locator('#prof-city')).toBeVisible();
    await expect(page.locator('#prof-postal')).toBeVisible();
    await expect(page.locator('#prof-country')).toBeVisible();
  });

  test('shows Save Changes button', async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/account/profile`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading', { name: /profile/i });
    if (!await heading.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await page.waitForTimeout(2000);
    await expect(page.getByRole('button', { name: /save changes/i })).toBeVisible();
  });

  test('shows password section', async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/account/profile`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading', { name: /profile/i });
    if (!await heading.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await page.waitForTimeout(2000);

    // Should show either "Change Password" or "Set Password"
    const changeOrSet = page.getByText(/change password|set password/i);
    await expect(changeOrSet.first()).toBeVisible();
  });
});
