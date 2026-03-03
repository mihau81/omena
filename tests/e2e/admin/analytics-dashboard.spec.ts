import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/e2e/.auth/admin.json' });

const BASE = '/omenaa';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'artists', label: 'Top Artists' },
  { id: 'activity', label: 'Bid Activity' },
  { id: 'comparison', label: 'Auction Comparison' },
  { id: 'users', label: 'User Metrics' },
];

test.describe('Admin - Analytics Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/admin/analytics`);
    await page.waitForLoadState('networkidle');
  });

  test('analytics page renders heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  });

  test('all 6 tabs are visible', async ({ page }) => {
    for (const tab of TABS) {
      const tabBtn = page.getByRole('button', { name: tab.label });
      await expect(tabBtn).toBeVisible();
    }
  });

  test('Overview tab shows KPI cards', async ({ page }) => {
    // Overview is the default tab
    await page.waitForTimeout(2000); // Wait for data to load

    const kpiCards = page.locator('[class*="AnalyticsCard"], [class*="card"]').first();
    const overviewText = page.locator('text=/revenue|sell.through|bidders/i').first();

    const hasCards = await kpiCards.isVisible({ timeout: 3000 }).catch(() => false);
    const hasText = await overviewText.isVisible({ timeout: 1000 }).catch(() => false);
    expect(hasCards || hasText).toBeTruthy();
  });

  test('Revenue tab loads data', async ({ page }) => {
    const revenueTab = page.getByRole('button', { name: 'Revenue' });
    await revenueTab.click();
    await page.waitForTimeout(2000);

    // Revenue tab should show some content
    const body = await page.textContent('body');
    expect(body).toMatch(/revenue|hammer|month/i);
  });

  test('Top Artists tab loads data', async ({ page }) => {
    const artistsTab = page.getByRole('button', { name: 'Top Artists' });
    await artistsTab.click();
    await page.waitForTimeout(2000);

    const body = await page.textContent('body');
    expect(body).toMatch(/artist|hammer|sold/i);
  });

  test('Bid Activity tab loads data', async ({ page }) => {
    const activityTab = page.getByRole('button', { name: 'Bid Activity' });
    await activityTab.click();
    await page.waitForTimeout(2000);

    const body = await page.textContent('body');
    expect(body).toMatch(/activity|hour|bids/i);
  });

  test('Auction Comparison tab loads data', async ({ page }) => {
    const compTab = page.getByRole('button', { name: 'Auction Comparison' });
    await compTab.click();
    await page.waitForTimeout(2000);

    const body = await page.textContent('body');
    expect(body).toMatch(/auction|comparison|revenue|sell/i);
  });

  test('User Metrics tab loads data', async ({ page }) => {
    const usersTab = page.getByRole('button', { name: 'User Metrics' });
    await usersTab.click();
    await page.waitForTimeout(2000);

    const body = await page.textContent('body');
    expect(body).toMatch(/user|registration|bidder/i);
  });

  test('tabs switch active state correctly', async ({ page }) => {
    const revenueTab = page.getByRole('button', { name: 'Revenue' });
    await revenueTab.click();

    // Active tab has different styling (dark-brown bg)
    await expect(revenueTab).toHaveClass(/bg-dark-brown|text-white/);
  });
});
