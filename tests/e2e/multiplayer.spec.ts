import { test, expect } from '@playwright/test';

test('verify 2-player game with AI bot does not crash or show blank screen', async ({ page }) => {
  // Catch any client-side JavaScript crashes
  page.on('pageerror', (exception) => {
    console.error(`Client-side exception captured: ${exception.message}`);
    throw exception;
  });

  page.on('console', (msg) => {
    console.log(`PAGE LOG: [${msg.type()}] ${msg.text()}`);
  });

  // 1. Navigate to the game
  await page.goto('/');

  // Wait for the booting loader to disappear
  await page.waitForSelector('.loader-overlay', { state: 'detached' });

  // Disconnect if already logged in to ensure a clean local session
  const disconnectBtn = page.locator('header button:has-text("DISCONNECT")');
  if (await disconnectBtn.isVisible()) {
    await disconnectBtn.click();
    // Wait for loader to disappear after logging out
    await page.waitForSelector('.loader-overlay', { state: 'detached' }).catch(() => {});
  }

  // Toggle to offline mode if needed
  const ssoButton = page.locator('button:has-text("ONLINE (SSO)")');
  if (await ssoButton.isVisible()) {
    await ssoButton.click();
  }

  // 2. Launch Local Guest Grid
  const guestButton = page.locator('button:has-text("LAUNCH LOCAL GUEST GRID")');
  await expect(guestButton).toBeVisible();
  await guestButton.click();

  // 3. Click to open create game modal
  const initButton = page.locator('button:has-text("INITIALIZE SWEEP FIELD")');
  await expect(initButton).toBeVisible();
  await initButton.click();

  // 4. Fill form
  await page.fill('input[placeholder="e.g. Sector 9"]', 'Auto Sector 9');
  
  // Set max players to 2
  await page.selectOption('.modal-card select', '2');
  
  // Launch game
  await page.click('button:has-text("LAUNCH SECTOR MATRIX")');

  // Wait for lobby to load
  await expect(page.locator('h3:has-text("GRID SWEEPER ROSTER")')).toBeVisible();

  // 5. In lobby, assign slot 2 to AI Easy
  const aiEasyButton = page.locator('button:has-text("AI EASY")').first();
  await expect(aiEasyButton).toBeVisible();
  await aiEasyButton.click();

  // Wait for the slot assignment to register
  await page.waitForTimeout(500);

  // 6. Start the game
  const startButton = page.locator('button:has-text("IGNITE SWEEP SIGNAL")');
  await expect(startButton).toBeVisible();
  await startButton.click();

  // Wait for the game to start and let the board render
  await page.waitForTimeout(1000);

  // 7. Make a turn on our own channel (by clicking the canvas center)
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  
  // Click center of the board
  const box = await canvas.boundingBox();
  if (box) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.click(cx, cy);
  }

  // 8. Monitor Channel 2 (the AI bot)
  const monitorChannelBtn = page.locator('button:has-text("Channel 2 (AI)")');
  await expect(monitorChannelBtn).toBeVisible();
  await monitorChannelBtn.click();

  // Let the game run for 6 seconds to observe AI moves and any potential crash
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(1000);
    // Verify canvas is still visible and has not vanished/glitched
    await expect(canvas).toBeVisible();
  }
});
