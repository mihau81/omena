import { test as setup, expect } from '@playwright/test';
import path from 'path';

const ADMIN_FILE = path.join(__dirname, '.auth/admin.json');
const USER_FILE = path.join(__dirname, '.auth/user.json');

const BASE = '/omena';

// ─── Admin auth ────────────────────────────────────────────────────────────
setup('authenticate as admin', async ({ page }) => {
  await page.goto(`${BASE}/admin/login`);

  await page.locator('#email').fill('admin@omena.pl');
  await page.locator('#password').fill('admin123');
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Wait until redirected to admin dashboard
  await page.waitForURL(`${BASE}/admin`);
  await expect(page.getByText('Dashboard').first()).toBeVisible({ timeout: 10000 });

  await page.context().storageState({ path: ADMIN_FILE });
});

// ─── User auth ─────────────────────────────────────────────────────────────
setup('authenticate as user', async ({ page }) => {
  // Try to register a test user via the correct API endpoint
  const registerResponse = await page.request.post(`${BASE}/api/auth/register`, {
    data: {
      email: 'testuser@omena-e2e.test',
      password: 'TestPassword123!',
      name: 'E2E Test User',
    },
  });

  // Registration may return 409 if user already exists — that's fine
  // It may also return 201 (new user created with pending_verification status)
  if (!registerResponse.ok() && registerResponse.status() !== 409) {
    // If register endpoint fails unexpectedly, save empty state
    await page.context().storageState({ path: USER_FILE });
    return;
  }

  // Approve the user directly via DB (bypass email verification for E2E)
  // We do this by calling the admin API if available, or via direct API call
  // For E2E setup, we use the password login which requires approved status.
  // The seed/global-setup should handle setting the user to approved.
  // If the user was just created, try to approve via admin API:
  if (registerResponse.status() === 201) {
    const data = await registerResponse.json();
    const userId = data.userId;
    if (userId) {
      // Attempt to approve via admin login + approve endpoint
      // First authenticate as admin
      await page.goto(`${BASE}/admin/login`);
      const emailInput = page.locator('#email');
      if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await emailInput.fill('admin@omena.pl');
        await page.locator('#password').fill('admin123');
        await page.getByRole('button', { name: 'Sign In' }).click();
        await page.waitForTimeout(2000);

        // Approve user via API
        await page.request.post(`${BASE}/api/admin/users/${userId}/approve`);
      }
    }
  }

  // Now try to log in as the user via password
  await page.goto(`${BASE}/en/login`);
  await page.waitForLoadState('networkidle');

  // Click "or sign in with password" to expand password form
  const passwordToggle = page.locator('button', { hasText: /sign in with password/i });
  if (await passwordToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
    await passwordToggle.click();
  }

  const emailInput = page.locator('input[type="email"]').first();
  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailInput.fill('testuser@omena-e2e.test');

    const passwordInput = page.locator('input[type="password"]').first();
    if (await passwordInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await passwordInput.fill('TestPassword123!');
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForTimeout(3000);
    }
  }

  await page.context().storageState({ path: USER_FILE });
});
