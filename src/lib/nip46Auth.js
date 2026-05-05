import { profileFromNostrPublicKey } from './nostrAuth.js';

const HEX_PUBKEY_RE = /^[0-9a-f]{64}$/i;

function isRelayUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'wss:' || url.protocol === 'ws:';
  } catch {
    return false;
  }
}

function normalizeRelayUrl(value) {
  const url = new URL(value);
  return url.toString().replace(/\/$/, '');
}

export function parseBunkerUri(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed) throw new Error('Paste a bunker:// connection string from your remote signer.');

  const url = new URL(trimmed);
  if (url.protocol !== 'bunker:') {
    throw new Error('Remote signer login expects a bunker:// connection string.');
  }

  const pubkey = (url.hostname || url.pathname.replace(/^\/+/, '') || url.searchParams.get('pubkey') || '').toLowerCase();
  if (!HEX_PUBKEY_RE.test(pubkey)) {
    throw new Error('The bunker URL is missing a valid remote-signer public key.');
  }

  const relays = url.searchParams.getAll('relay').map(decodeURIComponent).filter(Boolean);
  if (relays.length === 0) throw new Error('The bunker URL must include at least one relay parameter.');

  const normalizedRelays = Array.from(new Set(relays.map(normalizeRelayUrl)));
  if (!normalizedRelays.every(isRelayUrl)) {
    throw new Error('Bunker relay parameters must be websocket URLs that start with wss:// or ws://.');
  }

  return {
    pubkey,
    relays: normalizedRelays,
    secret: url.searchParams.get('secret') || undefined,
  };
}

async function parseBunkerConnection(input) {
  if (!String(input || '').trim()) return parseBunkerUri(input);
  try {
    return parseBunkerUri(input);
  } catch (localError) {
    if (!String(input || '').trim().startsWith('bunker://')) throw localError;
    const { parseBunkerInput } = await import('nostr-tools/nip46');
    const parsed = await parseBunkerInput(input);
    if (!parsed?.pubkey || !HEX_PUBKEY_RE.test(parsed.pubkey) || !Array.isArray(parsed.relays) || parsed.relays.length === 0) {
      throw localError;
    }
    return {
      pubkey: parsed.pubkey.toLowerCase(),
      relays: Array.from(new Set(parsed.relays.map(normalizeRelayUrl))),
      secret: parsed.secret || undefined,
    };
  }
}

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

export async function connectNip46Bunker(input, { timeoutMs = 30000, baseProfile = {} } = {}) {
  const [{ generateSecretKey, getPublicKey, utils }, { BunkerSigner }] = await Promise.all([
    import('nostr-tools'),
    import('nostr-tools/nip46'),
  ]);
  const bunker = await parseBunkerConnection(input);
  const clientSecretKey = generateSecretKey();
  const clientPubkey = getPublicKey(clientSecretKey);
  const clientSecretKeyHex = utils.bytesToHex(clientSecretKey);
  const signer = BunkerSigner.fromBunker(clientSecretKey, bunker, {
    onauth: (url) => {
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    },
  });

  try {
    await withTimeout(signer.connect(), timeoutMs, 'Timed out waiting for the remote signer to approve the connection.');
    const userPubkey = await withTimeout(signer.getPublicKey(), timeoutMs, 'Timed out waiting for the remote signer public key.');
    const relays = signer.bp?.relays?.length ? signer.bp.relays : bunker.relays;

    return {
      session: {
        loggedIn: true,
        mode: 'nip46',
        pubkey: userPubkey,
        readonly: false,
        remoteSigner: {
          clientPubkey,
          clientSecretKey: clientSecretKeyHex,
          remoteSignerPubkey: bunker.pubkey,
          userPubkey,
          relays,
          secret: bunker.secret || null,
          connectedAt: new Date().toISOString(),
        },
      },
      profile: profileFromNostrPublicKey(userPubkey, baseProfile),
    };
  } finally {
    signer.close();
  }
}

export function summarizeBunkerUri(input) {
  const parsed = parseBunkerUri(input);
  return {
    remoteSigner: `${parsed.pubkey.slice(0, 8)}…${parsed.pubkey.slice(-4)}`,
    relays: parsed.relays,
    hasSecret: Boolean(parsed.secret),
  };
}
