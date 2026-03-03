import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/e2e/.auth/admin.json' });

const BASE = '/omenaa';

test.describe('Admin - Email Whitelist', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/admin/whitelists`);
    await page.waitForLoadState('networkidle');
  });

  test('renders whitelist page with heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Email Whitelist' })).toBeVisible();
  });

  test('shows add email form', async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add' })).toBeVisible();
  });

  test('shows CSV import controls', async ({ page }) => {
    await expect(page.locator('input[type="file"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import CSV' })).toBeVisible();
  });

  test('shows table with column headers', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: 'Email' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Added' })).toBeVisible();
  });
});
