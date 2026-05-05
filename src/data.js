// Static product data only. Runtime account state starts empty and is populated
// from login, configured servers, Blossom lists, uploads, or backup import.

export const ATELIER_SERVERS = [
  { url: 'https://blossom.primal.net', status: 'offline', latency: 0, used: 0, quota: 1024, primary: true, name: 'Primal', lastCheckedAt: null, capabilities: {} },
  { url: 'https://cdn.satellite.earth', status: 'offline', latency: 0, used: 0, quota: 1024, primary: false, name: 'Satellite', lastCheckedAt: null, capabilities: {} },
  { url: 'https://blossom.band', status: 'offline', latency: 0, used: 0, quota: 1024, primary: false, name: 'Blossom.band', lastCheckedAt: null, capabilities: {} },
  { url: 'https://nostr.download', status: 'offline', latency: 0, used: 0, quota: 1024, primary: false, name: 'nostr.download', lastCheckedAt: null, capabilities: {} },
];

export const ATELIER_FORMAT = {
  fmtBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
    return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  },
  fmtMB(mb) {
    if (mb < 1024) return mb.toFixed(0) + ' MB';
    return (mb / 1024).toFixed(2) + ' GB';
  },
  fmtDur(s) {
    const m = Math.floor(s / 60), r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  },
  fmtDate(iso) {
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  },
  fmtRel(iso) {
    const d = new Date(iso), diff = Date.now() - d.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    return days + ' days ago';
  },
  kindOf(b) {
    if (b.type.startsWith('image/')) return 'image';
    if (b.type.startsWith('video/')) return 'video';
    if (b.type.startsWith('audio/')) return 'audio';
    if (b.type === 'application/pdf') return 'pdf';
    return 'file';
  },
};
