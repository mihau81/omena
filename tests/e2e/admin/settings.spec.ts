import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/e2e/.auth/admin.json' });

const BASE = '/omena';

test.describe('Admin - Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/admin/settings`);
    await page.waitForLoadState('networkidle');
  });

  test('renders settings page with heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.getByText('Manage auction house configuration')).toBeVisible();
  });

  test('shows configuration sections', async ({ page }) => {
    await expect(page.getByText('Auction House Information')).toBeVisible();
    await expect(page.getByText('Default Settings')).toBeVisible();
    await expect(page.getByText('Email Configuration')).toBeVisible();
  });

  test('sections show coming soon placeholder', async ({ page }) => {
    const comingSoon = page.getByText('Coming soon');
    expect(await comingSoon.count()).toBeGreaterThanOrEqual(3);
  });
});
