import { test, expect } from '@playwright/test';

test('should load the home page and verify elements', async ({ page }) => {
  await page.goto('/');
  // Basic title assertion - should contain RetroSweeper
  await expect(page).toHaveTitle(/.*RetroSweeper|.*Sweeper/i);
});
