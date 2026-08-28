const { test, expect } = require('playwright/test');

const BASE_URL = 'http://127.0.0.1:4173/';
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'Mormor21!';

test('campaign brain visual verification', async ({ page }) => {
  test.setTimeout(180000);

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  const passwordField = page.locator('#auth-password');
  if (await passwordField.isVisible().catch(() => false)) {
    await passwordField.fill(AUTH_PASSWORD);
    await page.locator('#auth-submit').click();
    await page.waitForLoadState('networkidle');
  }

  await page.locator('[data-workspace="klaviyo"]').click();
  await page.locator('[data-klaviyo-view="campaign_brain"]').click();
  await expect(page.locator('#klaviyo-campaign-brain-panel')).toBeVisible();

  await page.screenshot({ path: 'tmp/campaign-brain-before.png', fullPage: true });

  await page.locator('#campaign-brain-assemble-button').click();
  await page.waitForTimeout(1500);

  await page.locator('#campaign-brain-generate-button').click();
  await page.waitForTimeout(8000);

  const artifactButton = page.locator('#campaign-brain-artifacts-button');
  await expect(artifactButton).toBeEnabled({ timeout: 30000 });
  await artifactButton.click();

  await expect(page.locator('text=Campaign asset library')).toBeVisible({ timeout: 120000 });
  await page.locator('text=Campaign asset library').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);

  await page.screenshot({ path: 'tmp/campaign-brain-library.png', fullPage: true });
});
