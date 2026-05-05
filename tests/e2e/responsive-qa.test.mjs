import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE_URL = process.env.APP_BASE_URL || 'http://127.0.0.1:5173';
const ARTIFACT_DIR = 'test-artifacts/responsive';
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 820 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'mobile', width: 390, height: 844 },
];

const SURFACES = [
  { name: 'library', path: '/?view=library', waitFor: '.atl-root' },
  { name: 'onboarding', path: '/?onboarding=1&step=0', waitFor: '.ob-card' },
  { name: 'upload', path: '/?view=upload', waitFor: '.atl-drop' },
  { name: 'relays', path: '/?view=relays', waitFor: '.atl-tablecard' },
  { name: 'settings', path: '/?view=settings', waitFor: '.atl-set-card' },
];

test('responsive QA screenshots cover primary app surfaces', async () => {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const surface of SURFACES) {
      await page.goto(`${BASE_URL}${surface.path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector(surface.waitFor);
      const overflow = await page.evaluate(() => {
        const root = document.querySelector('.atl-root');
        if (!root) return 0;
        return Math.max(0, root.scrollWidth - root.clientWidth);
      });
      assert.equal(overflow, 0, `${surface.name} overflows horizontally at ${viewport.name}`);
      await page.screenshot({ path: `${ARTIFACT_DIR}/${surface.name}-${viewport.name}.png`, fullPage: false });
    }
  }

  await browser.close();
  assert.deepEqual(errors, []);
});
