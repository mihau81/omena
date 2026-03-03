import { chromium, FullConfig } from '@playwright/test';

/**
 * Global setup — runs once before all tests.
 * Seeds the test database and verifies the dev server is reachable.
 */
async function globalSetup(_config: FullConfig) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Wait for the dev server to be ready
  const baseUrl = 'http://localhost:3002/omenaa';
  let attempts = 0;
  while (attempts < 30) {
    try {
      const res = await page.request.get(`${baseUrl}/en`);
      if (res.status() < 500) break;
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 2000));
    attempts++;
  }

  await browser.close();
}

export default globalSetup;
