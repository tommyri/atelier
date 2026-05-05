export const PROFILE_KIND = 0;

const HEX_PUBKEY_RE = /^[0-9a-f]{64}$/i;
const PROFILE_NAME_RE = /^[a-z0-9_][a-z0-9_.-]{0,31}$/i;
const NIP05_RE = /^([a-z0-9_.-]{1,64})@([a-z0-9.-]+\.[a-z]{2,})$/i;
const LIGHTNING_RE = /^[^\s@]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

function optional(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isHttpUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function stringField(content, key) {
  const value = content?.[key];
  return typeof value === 'string' ? value : '';
}

export function profileMetadataFromProfile(profile) {
  return {
    name: optional(profile.name),
    display_name: optional(profile.display_name),
    about: optional(profile.about),
    picture: optional(profile.picture),
    banner: optional(profile.banner),
    nip05: optional(profile.nip05),
    lud16: optional(profile.lud16),
    website: optional(profile.website),
  };
}

export function createProfileEvent(profile, pubkey, { createdAt = Math.floor(Date.now() / 1000) } = {}) {
  if (!HEX_PUBKEY_RE.test(String(pubkey || ''))) {
    throw new TypeError('A hex Nostr public key is required to create profile metadata.');
  }
  return {
    kind: PROFILE_KIND,
    pubkey: pubkey.toLowerCase(),
    created_at: createdAt,
    tags: [],
    content: JSON.stringify(profileMetadataFromProfile(profile)),
  };
}

export function parseProfileEvent(input, baseProfile = {}) {
  const event = typeof input === 'string' ? JSON.parse(input) : input;
  if (!event || typeof event !== 'object') throw new TypeError('Profile event must be an object.');
  if (event.kind !== PROFILE_KIND) throw new TypeError('Profile metadata must be a kind 0 event.');
  if (!HEX_PUBKEY_RE.test(String(event.pubkey || ''))) throw new TypeError('Profile event is missing a valid pubkey.');
  const content = JSON.parse(event.content || '{}');
  if (!content || typeof content !== 'object' || Array.isArray(content)) throw new TypeError('Profile event content must be a JSON object.');
  return {
    ...baseProfile,
    pubkey: event.pubkey.toLowerCase(),
    name: stringField(content, 'name'),
    display_name: stringField(content, 'display_name') || stringField(content, 'name') || baseProfile.display_name || 'Anonymous',
    about: stringField(content, 'about'),
    picture: stringField(content, 'picture'),
    banner: stringField(content, 'banner'),
    nip05: stringField(content, 'nip05'),
    lud16: stringField(content, 'lud16'),
    website: stringField(content, 'website'),
    profileEvent: event,
    profileUpdatedAt: Number.isFinite(event.created_at) ? event.created_at : null,
    nip05Verified: false,
  };
}

export function validateProfileFields(profile) {
  const errors = {};
  const name = optional(profile.name);
  const nip05 = optional(profile.nip05);
  const lud16 = optional(profile.lud16);
  const website = optional(profile.website);
  const picture = optional(profile.picture);
  const banner = optional(profile.banner);
  const about = typeof profile.about === 'string' ? profile.about : '';

  if (name && !PROFILE_NAME_RE.test(name)) {
    errors.name = 'Use 1-32 letters, numbers, underscore, dot, or dash.';
  }
  if (about.length > 500) {
    errors.about = 'About must be 500 characters or less.';
  }
  if (nip05 && !NIP05_RE.test(nip05)) {
    errors.nip05 = 'Use a NIP-05 identifier like name@example.com.';
  }
  if (lud16 && !LIGHTNING_RE.test(lud16)) {
    errors.lud16 = 'Use a Lightning address like name@example.com.';
  }
  if (website && !isHttpUrl(website)) {
    errors.website = 'Use an http or https URL.';
  }
  if (picture && !isHttpUrl(picture)) {
    errors.picture = 'Avatar must be an http or https URL.';
  }
  if (banner && !isHttpUrl(banner)) {
    errors.banner = 'Banner must be an http or https URL.';
  }
  return errors;
}

export async function verifyNip05(profile, pubkey, { fetcher = globalThis.fetch } = {}) {
  const identifier = optional(profile.nip05).toLowerCase();
  const match = identifier.match(NIP05_RE);
  if (!match) throw new TypeError('Enter a valid NIP-05 identifier first.');
  if (!HEX_PUBKEY_RE.test(String(pubkey || ''))) throw new TypeError('A hex Nostr public key is required for NIP-05.');

  const [, name, domain] = match;
  const url = `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`;
  const response = await fetcher(url, { method: 'GET', cache: 'no-store', redirect: 'manual' });
  if (!response.ok) throw new Error(`NIP-05 lookup failed with ${response.status}.`);
  const json = await response.json();
  const resolved = json?.names?.[name];
  return typeof resolved === 'string' && resolved.toLowerCase() === pubkey.toLowerCase();
}
