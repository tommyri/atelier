const HEX_PUBKEY_RE = /^[0-9a-f]{64}$/i;
const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function polymod(values) {
  const generator = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const value of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i += 1) {
      if ((top >> i) & 1) chk ^= generator[i];
    }
  }
  return chk;
}

function hrpExpand(hrp) {
  const expanded = [];
  for (let i = 0; i < hrp.length; i += 1) expanded.push(hrp.charCodeAt(i) >> 5);
  expanded.push(0);
  for (let i = 0; i < hrp.length; i += 1) expanded.push(hrp.charCodeAt(i) & 31);
  return expanded;
}

function createChecksum(hrp, data) {
  const values = [...hrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0];
  const mod = polymod(values) ^ 1;
  const checksum = [];
  for (let p = 0; p < 6; p += 1) checksum.push((mod >> (5 * (5 - p))) & 31);
  return checksum;
}

function verifyChecksum(hrp, data) {
  return polymod([...hrpExpand(hrp), ...data]) === 1;
}

function convertBits(data, fromBits, toBits, pad = true) {
  let acc = 0;
  let bits = 0;
  const result = [];
  const maxv = (1 << toBits) - 1;
  const maxAcc = (1 << (fromBits + toBits - 1)) - 1;

  for (const value of data) {
    if (value < 0 || value >> fromBits !== 0) throw new Error('Invalid bech32 input value');
    acc = ((acc << fromBits) | value) & maxAcc;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      result.push((acc >> bits) & maxv);
    }
  }

  if (pad && bits > 0) result.push((acc << (toBits - bits)) & maxv);
  if (!pad && (bits >= fromBits || ((acc << (toBits - bits)) & maxv))) {
    throw new Error('Invalid incomplete bech32 group');
  }
  return result;
}

function hexToBytes(hex) {
  if (!HEX_PUBKEY_RE.test(hex)) throw new TypeError('Expected a 64-character hex public key');
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.slice(i, i + 2), 16));
  return bytes;
}

function bytesToHex(bytes) {
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function decodeBech32(value) {
  const text = String(value || '').trim().toLowerCase();
  const separator = text.lastIndexOf('1');
  if (separator <= 0 || separator + 7 > text.length) throw new Error('Invalid bech32 string.');

  const hrp = text.slice(0, separator);
  const data = [];
  for (const char of text.slice(separator + 1)) {
    const index = BECH32_CHARSET.indexOf(char);
    if (index === -1) throw new Error('Invalid bech32 character.');
    data.push(index);
  }
  if (!verifyChecksum(hrp, data)) throw new Error('Invalid bech32 checksum.');
  return { hrp, data: data.slice(0, -6) };
}

export function npubFromHex(hex) {
  const hrp = 'npub';
  const data = convertBits(hexToBytes(hex.toLowerCase()), 8, 5);
  const combined = [...data, ...createChecksum(hrp, data)];
  return `${hrp}1${combined.map((value) => BECH32_CHARSET[value]).join('')}`;
}

export function hexFromNpub(npub) {
  const normalized = String(npub || '').trim().replace(/^nostr:/i, '').toLowerCase();
  const decoded = decodeBech32(normalized);
  if (decoded.hrp !== 'npub') throw new Error('Expected an npub public key.');
  const bytes = convertBits(decoded.data, 5, 8, false);
  const hex = bytesToHex(bytes);
  if (!HEX_PUBKEY_RE.test(hex)) throw new Error('npub did not decode to a valid public key.');
  return hex;
}

export function profileFromReadonlyNpub(input, baseProfile = {}) {
  const pubkey = hexFromNpub(input);
  return profileFromNostrPublicKey(pubkey, {
    ...baseProfile,
    name: '',
    display_name: 'Read-only profile',
    nip05: '',
    about: 'Viewing this public key without signing permissions.',
  });
}

export function shortNpub(npub) {
  return `${npub.slice(0, 9)}…${npub.slice(-4)}`;
}

export function detectNip07Provider(windowLike = globalThis.window) {
  const provider = windowLike?.nostr;
  return provider && typeof provider.getPublicKey === 'function' ? provider : null;
}

export async function requestNip07PublicKey(windowLike = globalThis.window) {
  const provider = detectNip07Provider(windowLike);
  if (!provider) {
    throw new Error('No NIP-07 browser extension was found. Install or enable a NIP-07 extension, then reload Atelier.');
  }

  const pubkey = await provider.getPublicKey();
  if (!HEX_PUBKEY_RE.test(pubkey || '')) {
    throw new Error('The NIP-07 extension returned an invalid public key.');
  }
  return pubkey.toLowerCase();
}

export function profileFromNostrPublicKey(pubkey, baseProfile = {}) {
  const npub = npubFromHex(pubkey);
  return {
    ...baseProfile,
    pubkey,
    npubShort: shortNpub(npub),
    hexShort: `${pubkey.slice(0, 4)}…${pubkey.slice(-4)}`,
    name: baseProfile.name || 'nostr-user',
    display_name: baseProfile.display_name || 'Nostr user',
    nip05: baseProfile.nip05 || '',
    picture: baseProfile.picture || '',
    banner: baseProfile.banner || '',
  };
}
