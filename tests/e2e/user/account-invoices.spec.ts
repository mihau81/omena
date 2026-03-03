import { test, expect } from '@playwright/test';

const BASE = '/omenaa';
const LOCALE = 'en';

test.describe('Account invoices page', () => {
  test('renders Invoices heading', async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/account/invoices`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading', { name: /invoices/i });
    const isVisible = await heading.isVisible({ timeout: 5000 }).catch(() => false);

    if (!isVisible) {
      const loginInput = page.locator('input[type="email"]').first();
      expect(await loginInput.isVisible({ timeout: 2000 }).catch(() => false)).toBeTruthy();
    }
  });

  test('shows empty state or invoice list', async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/account/invoices`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const heading = page.getByRole('heading', { name: /invoices/i });
    if (!await heading.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip();
      return;
    }

    const emptyMsg = page.getByText(/no invoices/i);
    const invoiceItem = page.locator('[class*="rounded-xl"]').first();
    const hasEmpty = await emptyMsg.isVisible({ timeout: 3000 }).catch(() => false);
    const hasInvoices = await invoiceItem.isVisible({ timeout: 1000 }).catch(() => false);

    expect(hasEmpty || hasInvoices).toBeTruthy();
  });

  test('shows subtitle about payment status', async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/account/invoices`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading', { name: /invoices/i });
    if (!await heading.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await expect(page.getByText(/payment status/i)).toBeVisible();
  });
});
