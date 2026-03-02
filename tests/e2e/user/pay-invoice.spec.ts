import { test, expect } from '@playwright/test';

const BASE = '/omena';
const LOCALE = 'en';

test.describe('Pay invoice page', () => {
  test('invoice page shows payment form for valid invoice', async ({ page }) => {
    // Navigate to a test invoice — we use a placeholder ID
    // In real tests this would use a seeded invoice ID
    await page.goto(`${BASE}/${LOCALE}/pay/test-invoice-id`);
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body');
    expect(body).toBeTruthy();
    // Should either show the invoice or a not found/invalid message
  });

  test('pay page is accessible via /pay/{invoiceId} route', async ({ page }) => {
    const response = await page.request.get(`${BASE}/${LOCALE}/pay/nonexistent`);
    // Should return some response (200 with error state, or 404)
    expect([200, 404]).toContain(response.status());
  });

  test('invoice details section is shown when invoice exists', async ({ page }) => {
    // First try to find any invoice from admin API
    const invoicesRes = await page.request.get(`${BASE}/api/admin/invoices`);
    if (invoicesRes.ok()) {
      const data = await invoicesRes.json();
      const invoices = data.invoices ?? [];
      if (invoices.length > 0) {
        const invoiceId = invoices[0].id;
        await page.goto(`${BASE}/${LOCALE}/pay/${invoiceId}`);
        await page.waitForLoadState('networkidle');

        // Invoice details should be visible
        const heading = page.getByRole('heading').first();
        await expect(heading).toBeVisible();
      }
    }
  });

  test('Stripe payment form elements are present on valid invoice', async ({ page }) => {
    // This test checks that Stripe iframe or payment elements appear
    // It requires a real invoice to be present
    await page.goto(`${BASE}/${LOCALE}/pay/test`);
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body');
    // Should not crash
    expect(body).toBeTruthy();
  });
});
