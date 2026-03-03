import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

const BASE = '/omenaa';
const LOCALE = 'en';

test.describe('User registration', () => {
  test('registration page renders all form fields', async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/register`);
    await page.waitForLoadState('networkidle');

    // Required fields
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#reg-email')).toBeVisible();

    // Optional fields
    await expect(page.locator('#phone')).toBeVisible();
    await expect(page.locator('#reg-password')).toBeVisible();

    // Submit button
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
  });

  test('password field is marked as optional', async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/register`);
    await page.waitForLoadState('networkidle');

    const passwordLabel = page.locator('label[for="reg-password"]');
    await expect(passwordLabel).toContainText('optional');
  });

  test('registers a new account and shows email verification prompt', async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/register`);
    await page.waitForLoadState('networkidle');

    const timestamp = Date.now();
    const testEmail = `newuser_${timestamp}@omenaa-e2e.test`;

    await page.locator('#name').fill('New E2E User');
    await page.locator('#reg-email').fill(testEmail);
    await page.locator('#phone').fill('+48 123 456 789');

    await page.getByRole('button', { name: /create account/i }).click();

    // After successful registration, should show "Check your email" screen
    await expect(page.getByText('Check your email')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(testEmail)).toBeVisible();
  });

  test('registers with password and shows email verification prompt', async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/register`);
    await page.waitForLoadState('networkidle');

    const timestamp = Date.now();
    const testEmail = `newuser_pwd_${timestamp}@omenaa-e2e.test`;

    await page.locator('#name').fill('User With Password');
    await page.locator('#reg-email').fill(testEmail);
    await page.locator('#reg-password').fill('SecurePass123!');

    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByText('Check your email')).toBeVisible({ timeout: 10000 });
  });

  test('duplicate email registration shows error', async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/register`);
    await page.waitForLoadState('networkidle');

    // First registration
    const email = `dup_${Date.now()}@omenaa-e2e.test`;
    await page.locator('#name').fill('First User');
    await page.locator('#reg-email').fill(email);
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText('Check your email')).toBeVisible({ timeout: 10000 });

    // Second registration with same email — go back to form
    await page.goto(`${BASE}/${LOCALE}/register`);
    await page.waitForLoadState('networkidle');

    await page.locator('#name').fill('Duplicate User');
    await page.locator('#reg-email').fill(email);
    await page.getByRole('button', { name: /create account/i }).click();

    // Should show error about duplicate
    await page.waitForTimeout(3000);
    const body = await page.textContent('body');
    expect(body).toMatch(/already|exists|duplicate|taken/i);
  });

  test('QR code registration shows context banner', async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/register?qr=TEST_QR_CODE`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Registration via event QR code')).toBeVisible();
  });

  test('invitation registration shows context banner', async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/register?invitation=TEST_TOKEN`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText("You've been invited to Omenaa")).toBeVisible();
  });

  test('sign in link navigates to login page', async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/register`);
    await page.waitForLoadState('networkidle');

    const signInLink = page.getByRole('link', { name: /sign in/i });
    await expect(signInLink).toBeVisible();
    await expect(signInLink).toHaveAttribute('href', `/${LOCALE}/login`);
  });
});
