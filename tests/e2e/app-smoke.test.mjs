import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { npubFromHex } from '../../src/lib/nostrAuth.js';
import { scopedStorageName, storageKey } from '../../src/lib/storage.js';

const BASE_URL = process.env.APP_BASE_URL || 'http://127.0.0.1:5173';
const REMOTE_HASH = '3'.repeat(64);
const UPLOAD_HASH = '3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7';

test('app loads and navigates between primary surfaces', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  const errors = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    if (/Failed to load resource: the server responded with a status of (401|404)/.test(message.text())) return;
    errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  const blossomRoute = async (route) => {
    const url = new URL(route.request().url());
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, PUT, DELETE, OPTIONS',
      'Access-Control-Expose-Headers': 'Allow, X-Reason',
    };
    if (url.pathname === '/upload' && route.request().method() === 'HEAD') {
      await route.fulfill({ status: 200, headers });
      return;
    }
    if (url.pathname === '/upload' && route.request().method() === 'PUT') {
      const hash = route.request().headers()['x-sha-256'] || UPLOAD_HASH;
      await route.fulfill({
        status: 201,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sha256: hash,
          url: `https://${url.hostname}/${hash}.txt`,
          size: 4,
          type: route.request().headers()['content-type'] || 'text/plain',
          uploaded: 1770000100,
        }),
      });
      return;
    }
    if (url.pathname === '/mirror' && route.request().method() === 'PUT') {
      await route.fulfill({
        status: 201,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sha256: UPLOAD_HASH,
          url: `https://${url.hostname}/${UPLOAD_HASH}.txt`,
          size: 4,
          type: 'text/plain',
          uploaded: 1770000100,
        }),
      });
      return;
    }
    if (url.pathname === '/mirror') {
      await route.fulfill({ status: 204, headers: { ...headers, Allow: 'OPTIONS, PUT' } });
      return;
    }
    if (url.pathname === '/media') {
      await route.fulfill({ status: 200, headers });
      return;
    }
    if (url.pathname.startsWith('/list/')) {
      await route.fulfill({
        status: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify([
          {
            sha256: REMOTE_HASH,
            url: `https://media.example.test/${REMOTE_HASH}.jpg`,
            size: 4096,
            type: 'image/jpeg',
            uploaded: 1770000000,
          },
        ]),
      });
      return;
    }
    if (url.pathname === `/${REMOTE_HASH}`) {
      await route.fulfill({ status: 200, headers: { ...headers, 'Content-Type': 'image/jpeg', 'Content-Length': '4096' } });
      return;
    }
    if (url.pathname === `/${UPLOAD_HASH}` || url.pathname === `/${UPLOAD_HASH}.txt`) {
      await route.fulfill({ status: 200, headers: { ...headers, 'Content-Type': 'text/plain', 'Content-Length': '4' } });
      return;
    }
    if (/^[0-9a-f]{64}(?:\.txt)?$/.test(url.pathname.slice(1))) {
      await route.fulfill({ status: 200, headers: { ...headers, 'Content-Type': 'image/png', 'Content-Length': '4' } });
      return;
    }
    await route.fulfill({ status: 404, headers });
  };
  await page.route('https://media.example.test/**', blossomRoute);
  await page.route('https://blossom.primal.net/**', blossomRoute);
  await page.route('https://cdn.satellite.earth/**', blossomRoute);
  await page.route('https://blossom.band/**', blossomRoute);
  await page.route('https://nostr.download/**', blossomRoute);
  await page.route('https://example.com/.well-known/nostr.json*', async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ names: { alice: `${'0'.repeat(63)}1` } }),
    });
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.atl-root');
  await page.waitForFunction(() => window.__ATELIER_READY === true);
  await assert.doesNotReject(() => page.getByRole('button', { name: /^Library$/ }).click());
  await page.getByText('No blobs have been loaded yet.').waitFor();
  await page.getByRole('button', { name: /^Upload$/ }).click();
  await page.waitForSelector('.atl-drop');
  await page.getByRole('button', { name: /^Collections$/ }).click();
  await page.waitForSelector('.atl-coll-grid');
  await page.getByRole('button', { name: /New collection/ }).last().click();
  await page.getByTitle('Publish event').first().click();
  await page.waitForFunction((key) => {
    const collections = JSON.parse(localStorage.getItem(key) || '[]');
    return collections.some((collection) => collection.remoteEvent?.kind === 30003);
  }, storageKey('collections'));
  await page.getByRole('button', { name: /^Servers$/ }).click();
  await page.getByRole('button', { name: /^Add server$/ }).click();
  await page.getByPlaceholder('https://your-blossom-server.example').fill('media.example.test/path');
  await page.locator('.srv-add-form').getByRole('button', { name: /^Add$/ }).click();
  await page.locator('.url', { hasText: 'https://media.example.test' }).waitFor();
  const storedServers = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey(scopedStorageName('servers', 'mode:demo')));
  assert.equal(storedServers.at(-1).url, 'https://media.example.test');
  assert.equal(storedServers.filter((server) => server.primary).length, 1);
  const mediaRow = page.locator('.atl-srv-row', { hasText: 'https://media.example.test' });
  await mediaRow.getByTitle('Check server').click();
  await mediaRow.locator('.srv-cap.on', { hasText: 'retrieve' }).waitFor();
  await mediaRow.locator('.srv-cap.on', { hasText: 'mirror' }).waitFor();
  await mediaRow.locator('.srv-cap.on', { hasText: 'upload' }).waitFor();
  await page.getByRole('button', { name: /Publish list/ }).click();
  const serverPreferenceEvent = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey(scopedStorageName('serverPreferenceEvent', 'mode:demo')));
  assert.equal(serverPreferenceEvent.kind, 10063);
  assert.equal(serverPreferenceEvent.tags.at(-1)[1], 'https://media.example.test');
  await page.getByRole('button', { name: /^Relays$/ }).click();
  await page.getByRole('button', { name: /^Add relay$/ }).click();
  await page.getByPlaceholder('wss://relay.example.com').fill('relay.example.test');
  await page.locator('.srv-add-form').getByRole('button', { name: /^Add$/ }).click();
  await page.locator('.url', { hasText: 'wss://relay.example.test' }).waitFor();
  await page.getByRole('button', { name: /^Publish relay list$/ }).click();
  const relayListEvent = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey(scopedStorageName('relayListEvent', 'mode:demo')));
  assert.equal(relayListEvent.kind, 10002);
  assert.deepEqual(relayListEvent.tags.at(-1), ['r', 'wss://relay.example.test']);
  await page.getByRole('button', { name: /^Profile$/ }).click();
  await page.getByLabel('Display name').fill('Mira Test');
  await page.getByLabel('Username (slug)').fill('alice');
  await page.getByLabel('NIP-05').fill('alice@example.com');
  await page.getByRole('button', { name: /^Verify$/ }).click();
  await page.getByText('Verified against this public key.').waitFor();
  await page.getByLabel('Avatar image').setInputFiles({
    name: 'avatar.png',
    mimeType: 'image/png',
    buffer: Buffer.from('avatar'),
  });
  await page.waitForFunction((key) => {
    const profile = JSON.parse(localStorage.getItem(key) || '{}');
    return profile.picture?.startsWith('https://') && profile.picture?.endsWith('.txt');
  }, storageKey('profile'));
  await page.getByRole('button', { name: /Publish to relays/ }).click();
  await page.waitForFunction((key) => {
    const profile = JSON.parse(localStorage.getItem(key) || '{}');
    return profile.profileEvent?.kind === 0 && JSON.parse(profile.profileEvent.content).display_name === 'Mira Test';
  }, storageKey('profile'));
  await page.getByRole('button', { name: /^Upload$/ }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'demo.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('data'),
  });
  await page.waitForFunction((key) => {
    const jobs = JSON.parse(localStorage.getItem(key) || '[]');
    return jobs.some((job) => job.name === 'demo.txt' && job.hash && job.state === 'done');
  }, storageKey('uploadJobs'));
  const uploadedJobs = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey('uploadJobs'));
  const demoJob = uploadedJobs.find((job) => job.name === 'demo.txt');
  assert.equal(demoJob.state, 'done');
  const uploadedBlobs = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey('blobs'));
  assert.equal(uploadedBlobs.some((blob) => blob.hash === demoJob.hash), true);
  await page.goto(`${BASE_URL}/?onboarding=1&step=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ob-card');
  await page.getByRole('button', { name: /Let's go/ }).click();
  await page.waitForSelector('.ob-srv-row');
  await page.goto(`${BASE_URL}/?loggedOut=1`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Sign in with nostr').waitFor();
  await page.waitForFunction((key) => {
    const session = JSON.parse(localStorage.getItem(key) || '{}');
    return session.loggedIn === false;
  }, storageKey('session'));

  await page.getByPlaceholder('npub1...').fill(npubFromHex('0'.repeat(63) + '1'));
  await page.getByRole('button', { name: /^Read-only · paste npub$/ }).click();
  await page.locator('.atl-readonly-pill').waitFor();
  assert.equal(await page.locator('.atl-readonly-pill').innerText(), 'Read-only');
  await page.getByRole('button', { name: /^Servers$/ }).click();
  await page.getByRole('button', { name: /^Add server$/ }).click();
  await page.getByPlaceholder('https://your-blossom-server.example').fill('media.example.test');
  await page.locator('.srv-add-form').getByRole('button', { name: /^Add$/ }).click();
  await page.locator('.url', { hasText: 'https://media.example.test' }).waitFor();
  const readonlyMediaRow = page.locator('.atl-srv-row', { hasText: 'https://media.example.test' });
  await readonlyMediaRow.getByTitle('Check server').click();
  await readonlyMediaRow.locator('.srv-cap.on', { hasText: 'retrieve' }).waitFor();
  await page.getByRole('button', { name: /^Library$/ }).click();
  await page.getByRole('button', { name: /^Refresh$/ }).click();
  await page.waitForFunction(({ key, hash }) => {
    const blobs = JSON.parse(localStorage.getItem(key) || '[]');
    return blobs.some((blob) => blob.hash === hash);
  }, { key: storageKey('blobs'), hash: REMOTE_HASH });
  await page.locator(`.atl-gtile[title="${REMOTE_HASH}.jpg"]`).waitFor();
  await page.getByTitle('Refresh blob details').click();
  const storedBlobs = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey('blobs'));
  assert.equal(storedBlobs.length, 1);
  assert.equal(storedBlobs[0].hash, REMOTE_HASH);
  assert.equal(storedBlobs[0].replicas.some((replica) => replica.available), true);
  await page.getByRole('button', { name: /^Upload$/ }).click();
  await page.waitForSelector('.atl-drop');
  assert.equal(await page.getByRole('button', { name: /Choose files/ }).isDisabled(), true);
  await page.getByRole('button', { name: /^Settings$/ }).click();
  await page.getByLabel('Accent color').fill('#336699');
  await page.getByRole('button', { name: /Export backup/ }).click();
  await page.waitForFunction(() => {
    const text = document.querySelector('textarea[aria-label="Backup JSON"]')?.value || '';
    return text.includes('"app": "atelier"') && text.includes('"accent": "#336699"');
  });
  const scopedSettings = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey(scopedStorageName('settings', 'pubkey:0000000000000000000000000000000000000000000000000000000000000001')));
  assert.equal(scopedSettings.accent, '#336699');
  await page.getByLabel('Accent color').fill('#884488');
  await page.getByRole('button', { name: /Import backup/ }).click();
  await page.waitForFunction((key) => {
    const settings = JSON.parse(localStorage.getItem(key) || '{}');
    return settings.accent === '#336699';
  }, storageKey(scopedStorageName('settings', 'pubkey:0000000000000000000000000000000000000000000000000000000000000001')));
  await page.getByLabel('Confirmation phrase').fill('SIGN OUT');
  await page.getByRole('button', { name: /Sign out of Atelier/ }).click();
  await page.getByRole('button', { name: /^Browser extension \(NIP-07\)$/ }).waitFor();
  const signedOutSession = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey('session'));
  assert.equal(signedOutSession.loggedIn, false);
  assert.equal(signedOutSession.mode, 'demo');
  assert.equal(signedOutSession.pubkey, null);
  assert.equal(signedOutSession.readonly, false);
  assert.equal(signedOutSession.remoteSigner, null);

  await browser.close();
  assert.deepEqual(errors, []);
});
