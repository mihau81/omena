import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/e2e/.auth/admin.json' });

const BASE = '/omena';

test.describe('Admin - QR Code Registrations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/admin/qr-registrations`);
    await page.waitForLoadState('networkidle');
  });

  test('renders QR registrations page with heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'QR Code Registrations' })).toBeVisible();
  });

  test('shows create QR form with all fields', async ({ page }) => {
    await expect(page.getByText('Label')).toBeVisible();
    await expect(page.getByText('Valid From')).toBeVisible();
    await expect(page.getByText('Valid Until')).toBeVisible();
    await expect(page.getByText('Max Uses')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create QR Code' })).toBeVisible();
  });

  test('shows table with column headers', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: 'Label' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Valid Period' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Uses' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
  });
});
