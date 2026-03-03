import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

const BASE = '/omenaa';
const LOCALE = 'en';

test.describe('Email verification status pages', () => {
  test('approved status shows welcome message and sign-in link', async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/auth/verify-email?status=approved`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Welcome to Omenaa!')).toBeVisible();
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
  });

  test('pending status shows email verified and review message', async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/auth/verify-email?status=pending`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Email Verified')).toBeVisible();
    await expect(page.getByText(/being reviewed/i)).toBeVisible();
  });

  test('invalid status shows error message', async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/auth/verify-email?status=invalid`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Invalid Link')).toBeVisible();
  });

  test('already-verified status shows appropriate message', async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/auth/verify-email?status=already-verified`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Already Verified')).toBeVisible();
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
  });

  test('error status shows generic error', async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/auth/verify-email?status=error`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Something Went Wrong')).toBeVisible();
  });

  test('no status defaults to invalid', async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/auth/verify-email`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Invalid Link')).toBeVisible();
  });
});
