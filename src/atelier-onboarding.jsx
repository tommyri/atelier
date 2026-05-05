import React from 'react';
import { PetalMark, PI, shadeColor, lightenTint } from './atelier-shared.jsx';
import { ATELIER_FORMAT, ATELIER_SERVERS } from './data.js';

// Atelier onboarding — 7-step wizard shown after login.
// Walks the user through the things that distinguish a Blossom client from a
// generic media app: choosing servers, mirroring policy, kind 30003 collections,
// kind 0 metadata, and a real upload (BUD-02 PUT /upload + BUD-03 list event).
//
// Visually: a centered card on a soft accent-tinted backdrop with a step rail
// at the top and persistent footer nav. Each step has a "what this is" header
// + the actual control surface, so the user is never just clicking Next.

const ONBOARD_STYLES = `
  .ob-root { width: 100%; height: 100%; display: flex; flex-direction: column; background: radial-gradient(ellipse at top, var(--aaccent-tint) 0%, var(--abg) 55%); overflow: hidden; }
  .ob-topbar { height: 48px; flex-shrink: 0; display: flex; align-items: center; padding: 0 18px; gap: 14px; }
  .ob-topbar .ob-brand { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; letter-spacing: -0.01em; }
  .ob-topbar .ob-brand .mk { color: var(--aaccent-deep); }
  .ob-skip { margin-left: auto; height: 28px; padding: 0 12px; border-radius: 6px; border: 0; background: transparent; color: var(--aink-faint); font-size: 12px; cursor: pointer; white-space: nowrap; }
  .ob-skip:hover { color: var(--aink); background: var(--apanel-2); }

  .ob-rail { display: flex; align-items: center; gap: 0; padding: 0 24px; flex-shrink: 0; }
  .ob-rail-step { display: flex; align-items: center; gap: 8px; padding: 10px 0; min-width: 0; flex-shrink: 0; }
  .ob-rail-num { width: 22px; height: 22px; border-radius: 50%; background: var(--apanel); border: 1px solid var(--aline); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: var(--aink-faint); flex-shrink: 0; transition: all .2s; font-variant-numeric: tabular-nums; }
  .ob-rail-num.done { background: var(--aaccent-deep); border-color: var(--aaccent-deep); color: #fff; }
  .ob-rail-num.active { background: var(--aink); border-color: var(--aink); color: var(--abg); box-shadow: 0 0 0 4px var(--aaccent-tint); }
  .ob-rail-label { font-size: 11.5px; font-weight: 500; color: var(--aink-faint); white-space: nowrap; }
  .ob-rail-label.active { color: var(--aink); font-weight: 600; }
  .ob-rail-line { flex: 1; height: 1px; background: var(--aline); margin: 0 6px; min-width: 8px; max-width: 40px; }
  .ob-rail-line.done { background: var(--aaccent-deep); }

  .ob-stage { flex: 1; min-height: 0; display: flex; align-items: flex-start; justify-content: center; padding: 24px 24px 16px; overflow-y: auto; }
  .ob-card { width: 100%; max-width: 720px; background: var(--apanel); border: 1px solid var(--aline); border-radius: 14px; box-shadow: 0 14px 50px rgba(0,0,0,0.06); overflow: hidden; display: flex; flex-direction: column; }
  .ob-card-head { padding: 26px 32px 18px; border-bottom: 1px solid var(--aline-2); }
  .ob-eyebrow { font-size: 10.5px; font-weight: 600; letter-spacing: 0.09em; text-transform: uppercase; color: var(--aaccent-deep); margin-bottom: 8px; }
  .ob-title { font-size: 22px; font-weight: 600; letter-spacing: -0.015em; line-height: 1.2; }
  .ob-sub { font-size: 13px; color: var(--aink-soft); margin-top: 6px; line-height: 1.55; max-width: 540px; }
  .ob-body { padding: 22px 32px 26px; flex: 1; }
  .ob-foot { display: flex; align-items: center; gap: 10px; padding: 14px 24px; border-top: 1px solid var(--aline-2); background: var(--apanel-2); }
  .ob-foot .grow { flex: 1; min-width: 12px; }
  .ob-foot .ob-step-info { font-size: 11.5px; color: var(--aink-faint); font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .ob-skipstep { background: none; border: none; padding: 0 6px; height: 26px; font-size: 12px; color: var(--aink-faint); cursor: pointer; text-decoration: underline; text-decoration-color: var(--aline); text-underline-offset: 3px; white-space: nowrap; flex-shrink: 0; }
  .ob-skipstep:hover { color: var(--aink); text-decoration-color: currentColor; }

  /* Step 1 — welcome */
  .ob-welcome { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
  .ob-bigmark { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 18px 14px; background: linear-gradient(155deg, var(--aaccent-tint), var(--apanel-2)); border-radius: 10px; }
  .ob-bigmark .mk { color: var(--aaccent-deep); margin-bottom: 12px; transform: scale(2.4); }
  .ob-bigmark .npub { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 11px; color: var(--aink-soft); margin-top: 18px; padding: 4px 10px; background: var(--apanel); border: 1px solid var(--aline); border-radius: 999px; }
  .ob-feature { display: grid; grid-template-columns: 28px 1fr; gap: 12px; align-items: flex-start; padding: 9px 0; }
  .ob-feature .ico { width: 28px; height: 28px; border-radius: 7px; background: var(--aaccent-tint); color: var(--aaccent-deep); display: flex; align-items: center; justify-content: center; }
  .ob-feature .ico svg { width: 14px; height: 14px; }
  .ob-feature .name { font-size: 12.5px; font-weight: 600; }
  .ob-feature .desc { font-size: 11.5px; color: var(--aink-soft); line-height: 1.5; margin-top: 1px; }

  /* Step 2 — servers */
  .ob-srv-row { display: grid; grid-template-columns: 28px 32px 1fr 90px 80px 26px; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--aline); border-radius: 8px; margin-bottom: 6px; background: var(--apanel); }
  .ob-srv-row.picked { border-color: var(--aaccent); background: var(--aaccent-tint); }
  .ob-srv-row .num { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 12px; color: var(--aink-faint); text-align: center; font-variant-numeric: tabular-nums; }
  .ob-srv-row.picked .num { color: var(--aaccent-deep); font-weight: 700; }
  .ob-srv-row .ico { width: 32px; height: 32px; border-radius: 6px; background: var(--aline-2); color: var(--aink-soft); display: flex; align-items: center; justify-content: center; }
  .ob-srv-row.picked .ico { background: var(--apanel); color: var(--aaccent-deep); }
  .ob-srv-row .ico svg { width: 14px; height: 14px; }
  .ob-srv-row .name { font-size: 13px; font-weight: 600; }
  .ob-srv-row .url { font-size: 10.5px; color: var(--aink-faint); font-family: 'JetBrains Mono', ui-monospace, monospace; margin-top: 2px; }
  .ob-srv-row .lat, .ob-srv-row .quota { font-size: 11.5px; color: var(--aink-soft); font-variant-numeric: tabular-nums; text-align: right; }
  .ob-srv-row .pin { width: 22px; height: 22px; border-radius: 5px; border: 1.5px solid var(--aline); background: var(--apanel); display: flex; align-items: center; justify-content: center; }
  .ob-srv-row.picked .pin { background: var(--aaccent-deep); border-color: var(--aaccent-deep); color: #fff; }
  .ob-srv-row .pin svg { width: 11px; height: 11px; }
  .ob-pill { display: inline-flex; align-items: center; gap: 5px; height: 18px; padding: 0 7px; border-radius: 999px; font-size: 10px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
  .ob-pill.pri { background: var(--aaccent-deep); color: #fff; }
  .ob-srv-add { display: flex; gap: 6px; margin-top: 8px; }
  .ob-srv-add input { flex: 1; height: 32px; padding: 0 12px; border-radius: 6px; border: 1px solid var(--aline); background: var(--apanel); font-size: 12.5px; font-family: 'JetBrains Mono', ui-monospace, monospace; outline: none; color: var(--aink); }
  .ob-srv-add input:focus { border-color: var(--aaccent); }

  /* Step 3 — mirror & privacy: choice cards */
  .ob-choice { display: grid; gap: 8px; }
  .ob-choice-card { display: grid; grid-template-columns: 26px 1fr; gap: 12px; padding: 14px 16px; border: 1.5px solid var(--aline); border-radius: 10px; cursor: pointer; background: var(--apanel); transition: all .15s; align-items: flex-start; }
  .ob-choice-card:hover { border-color: var(--aink-faint); }
  .ob-choice-card.picked { border-color: var(--aaccent-deep); background: var(--aaccent-tint); }
  .ob-radio { width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--aline); background: var(--apanel); margin-top: 2px; position: relative; flex-shrink: 0; }
  .ob-choice-card.picked .ob-radio { border-color: var(--aaccent-deep); }
  .ob-choice-card.picked .ob-radio::after { content: ''; position: absolute; inset: 3px; border-radius: 50%; background: var(--aaccent-deep); }
  .ob-choice-name { font-size: 13.5px; font-weight: 600; }
  .ob-choice-desc { font-size: 12px; color: var(--aink-soft); margin-top: 3px; line-height: 1.5; }
  .ob-choice-foot { display: inline-flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 11px; color: var(--aink-faint); font-family: 'JetBrains Mono', ui-monospace, monospace; white-space: nowrap; }
  .ob-choice-card.picked .ob-choice-foot { color: var(--aaccent-deep); }

  /* Step 4 — collection setup */
  .ob-coll-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .ob-coll-card { padding: 14px; border: 1.5px solid var(--aline); border-radius: 10px; cursor: pointer; background: var(--apanel); transition: all .15s; }
  .ob-coll-card:hover { border-color: var(--aink-faint); }
  .ob-coll-card.picked { border-color: var(--aaccent-deep); background: var(--aaccent-tint); }
  .ob-coll-emoji { font-size: 22px; margin-bottom: 8px; }
  .ob-coll-cardname { font-size: 12.5px; font-weight: 600; }
  .ob-coll-cardsub { font-size: 11px; color: var(--aink-soft); margin-top: 2px; line-height: 1.4; }
  .ob-coll-custom { margin-top: 12px; display: grid; grid-template-columns: 70px 1fr; gap: 8px; padding: 12px; border: 1px solid var(--aline); border-radius: 8px; background: var(--apanel-2); }
  .ob-coll-custom .lab { font-size: 11.5px; font-weight: 500; color: var(--aink-soft); align-self: center; }
  .ob-coll-custom input { height: 30px; padding: 0 10px; border-radius: 5px; border: 1px solid var(--aline); background: var(--apanel); font-size: 12.5px; outline: none; color: var(--aink); }
  .ob-coll-custom input:focus { border-color: var(--aaccent); }

  /* Step 5 — profile */
  .ob-prof { display: grid; grid-template-columns: 1.1fr 1fr; gap: 22px; align-items: flex-start; }
  .ob-prof-form { display: flex; flex-direction: column; gap: 11px; }
  .ob-prof-field { display: flex; flex-direction: column; gap: 4px; }
  .ob-prof-field label { font-size: 11.5px; font-weight: 600; color: var(--aink-soft); }
  .ob-prof-field input, .ob-prof-field textarea { padding: 8px 10px; border-radius: 6px; border: 1px solid var(--aline); background: var(--apanel); font-size: 12.5px; outline: none; color: var(--aink); font-family: inherit; }
  .ob-prof-field input:focus, .ob-prof-field textarea:focus { border-color: var(--aaccent); }
  .ob-prof-field textarea { min-height: 60px; resize: vertical; line-height: 1.45; }
  .ob-prof-prev { background: var(--apanel); border: 1px solid var(--aline); border-radius: 10px; overflow: hidden; }
  .ob-prof-banner { height: 64px; background-size: cover; background-position: center; }
  .ob-prof-av { width: 56px; height: 56px; border-radius: 50%; border: 3px solid var(--apanel); margin: -28px auto 6px; display: block; object-fit: cover; }
  .ob-prof-name { text-align: center; font-size: 14px; font-weight: 600; padding: 0 10px; }
  .ob-prof-nip05 { text-align: center; font-size: 11px; color: var(--aaccent-deep); margin-top: 1px; }
  .ob-prof-about { padding: 10px 14px 14px; font-size: 11.5px; color: var(--aink-soft); line-height: 1.5; text-align: center; min-height: 28px; }
  .ob-prof-fine { font-size: 11px; color: var(--aink-faint); padding: 6px 12px 10px; text-align: center; border-top: 1px solid var(--aline-2); margin-top: 4px; }

  /* Step 6 — test upload */
  .ob-up-zone { padding: 22px; border: 1.5px dashed var(--aline); border-radius: 10px; text-align: center; background: var(--apanel-2); transition: all .15s; }
  .ob-up-zone.busy { border-style: solid; border-color: var(--aaccent); background: var(--aaccent-tint); }
  .ob-up-zone.done { border-style: solid; border-color: var(--aok); background: color-mix(in oklab, var(--aok), var(--apanel) 90%); }
  .ob-up-icon { width: 48px; height: 48px; margin: 0 auto 10px; border-radius: 12px; background: var(--apanel); border: 1px solid var(--aline); color: var(--aink-soft); display: flex; align-items: center; justify-content: center; }
  .ob-up-zone.busy .ob-up-icon { color: var(--aaccent-deep); border-color: var(--aaccent); animation: ob-pulse 1.4s ease-in-out infinite; }
  .ob-up-zone.done .ob-up-icon { color: var(--aok); border-color: var(--aok); background: var(--apanel); }
  .ob-up-icon svg { width: 22px; height: 22px; }
  .ob-up-title { font-size: 14px; font-weight: 600; }
  .ob-up-sub { font-size: 12px; color: var(--aink-soft); margin: 4px 0 12px; }
  .ob-up-pickbtn { height: 32px; padding: 0 16px; border-radius: 6px; border: 1px solid var(--aink); background: var(--aink); color: var(--abg); font-size: 12.5px; font-weight: 500; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; white-space: nowrap; }
  .ob-up-pickbtn:hover { opacity: 0.9; }
  .ob-up-pickbtn svg { width: 12px; height: 12px; }
  .ob-up-progress { display: grid; grid-template-columns: 36px 1fr 60px; gap: 12px; align-items: center; padding: 12px 14px; background: var(--apanel); border: 1px solid var(--aline); border-radius: 8px; margin-top: 10px; text-align: left; }
  .ob-up-progress .ico { width: 36px; height: 36px; border-radius: 6px; background: var(--aaccent-tint); color: var(--aaccent-deep); display: flex; align-items: center; justify-content: center; }
  .ob-up-progress .ico svg { width: 14px; height: 14px; }
  .ob-up-progress .name { font-size: 12px; font-weight: 600; }
  .ob-up-progress .meta { font-size: 11px; color: var(--aink-faint); margin-top: 2px; font-family: 'JetBrains Mono', ui-monospace, monospace; }
  .ob-up-bar { height: 3px; background: var(--aline); border-radius: 999px; overflow: hidden; margin-top: 6px; }
  .ob-up-fill { height: 100%; background: var(--aaccent-deep); transition: width .2s; }
  .ob-up-pct { font-size: 11.5px; font-weight: 600; color: var(--aink); text-align: right; font-variant-numeric: tabular-nums; }
  .ob-up-replicas { display: flex; align-items: center; gap: 6px; margin-top: 12px; padding: 10px 12px; background: var(--apanel); border: 1px solid var(--aline); border-radius: 8px; flex-wrap: wrap; }
  .ob-up-replica { display: inline-flex; align-items: center; gap: 5px; height: 22px; padding: 0 8px; border-radius: 999px; font-size: 11px; font-weight: 500; background: var(--aline-2); color: var(--aink-soft); }
  .ob-up-replica.ok { background: color-mix(in oklab, var(--aok), var(--apanel) 80%); color: var(--aok); }
  .ob-up-replica.pending { color: var(--aink-soft); }
  .ob-up-replica .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
  .ob-up-replica .spin { width: 9px; height: 9px; border: 1.5px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: ob-spin .9s linear infinite; }
  @keyframes ob-spin { to { transform: rotate(360deg); } }
  @keyframes ob-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }

  /* Step 7 — done */
  .ob-done-list { display: grid; gap: 8px; }
  .ob-done-row { display: grid; grid-template-columns: 22px 1fr auto; gap: 12px; align-items: center; padding: 12px 14px; border: 1px solid var(--aline); border-radius: 8px; background: var(--apanel); }
  .ob-done-row .check { width: 22px; height: 22px; border-radius: 50%; background: color-mix(in oklab, var(--aok), var(--apanel) 80%); color: var(--aok); display: flex; align-items: center; justify-content: center; }
  .ob-done-row .check svg { width: 12px; height: 12px; }
  .ob-done-row .name { font-size: 13px; font-weight: 600; }
  .ob-done-row .summary { font-size: 11.5px; color: var(--aink-soft); margin-top: 1px; }
  .ob-done-row .pill { font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 999px; background: var(--aaccent-tint); color: var(--aaccent-deep); letter-spacing: 0.04em; text-transform: uppercase; font-family: 'JetBrains Mono', ui-monospace, monospace; white-space: nowrap; }

  /* Animation */
  .ob-card { animation: ob-cardin .35s cubic-bezier(.2,.8,.2,1) both; }
  @keyframes ob-cardin { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

  @media (max-width: 760px) {
    .ob-root { overflow: hidden; }
    .ob-topbar { padding: 0 20px; }
    .ob-rail { overflow-x: auto; padding: 0 20px 2px; scrollbar-width: none; }
    .ob-rail::-webkit-scrollbar { display: none; }
    .ob-rail-step { flex: 0 0 auto; }
    .ob-rail-line { flex: 0 0 30px; }
    .ob-stage { align-items: flex-start; justify-content: flex-start; padding: 20px; }
    .ob-card { max-width: none; min-width: 0; max-height: 100%; overflow-y: auto; border-radius: 12px; }
    .ob-card-head { padding: 24px 24px 18px; }
    .ob-title { font-size: 22px; }
    .ob-body { padding: 22px 24px 24px; }
    .ob-foot { position: sticky; bottom: 0; padding: 14px 20px; flex-wrap: wrap; }
    .ob-foot .grow { flex: 1 1 auto; }
    .ob-welcome,
    .ob-prof { grid-template-columns: 1fr; }
    .ob-bigmark { min-height: 180px; }
    .ob-srv-row { grid-template-columns: 24px 30px 1fr 24px; gap: 9px; }
    .ob-srv-row .lat,
    .ob-srv-row .quota { display: none; }
    .ob-coll-grid { grid-template-columns: 1fr 1fr; }
  }

  @media (max-width: 460px) {
    .ob-topbar { padding: 0 18px; }
    .ob-stage { padding: 18px 16px; }
    .ob-card-head { padding: 22px 20px 16px; }
    .ob-body { padding: 20px; }
    .ob-title { font-size: 21px; }
    .ob-coll-grid { grid-template-columns: 1fr; }
    .ob-choice-foot { white-space: normal; }
    .ob-up-progress { grid-template-columns: 32px 1fr; }
    .ob-up-pct { grid-column: 2; text-align: left; }
  }
`;

const OB_STEPS = [
  { id: 'welcome',  label: 'Welcome' },
  { id: 'servers',  label: 'Servers' },
  { id: 'mirror',   label: 'Mirroring' },
  { id: 'collect',  label: 'Collections' },
  { id: 'profile',  label: 'Profile' },
  { id: 'upload',   label: 'Upload' },
  { id: 'done',     label: 'Done' },
];

const OB_COLLECTION_PRESETS = [
  { id: 'photos',  emoji: '📷', name: 'Photography',  desc: 'Best shots, edits, portraits' },
  { id: 'design',  emoji: '🎨', name: 'Design refs',   desc: 'Posters, type, screenshots' },
  { id: 'memes',   emoji: '🌀', name: 'Memes',         desc: 'Reaction images and bits' },
  { id: 'voice',   emoji: '🎙️', name: 'Voice notes',   desc: 'Audio drafts and clips' },
  { id: 'docs',    emoji: '📄', name: 'Documents',     desc: 'PDFs, drafts, contracts' },
  { id: 'shared',  emoji: '🔗', name: 'For sharing',   desc: 'Public links you hand out' },
];

function ensureOnboardStyles() {
  if (!document.getElementById('ob-styles')) {
    const s = document.createElement('style'); s.id = 'ob-styles'; s.textContent = ONBOARD_STYLES; document.head.appendChild(s);
  }
}

export function AtelierOnboarding({ dark, accent, startStep, onDone, profile, setProfile, settings, setSettings, lists, setLists }) {
  React.useEffect(ensureOnboardStyles, []);
  const user = profile;
  const [step, setStep] = React.useState(Math.max(0, Math.min(startStep || 0, OB_STEPS.length - 1)));
  React.useEffect(() => { setStep(Math.max(0, Math.min(startStep || 0, OB_STEPS.length - 1))); }, [startStep]);

  // Local wizard state — committed to parent on Finish.
  const [chosenServers, setChosenServers] = React.useState(() => new Set(ATELIER_SERVERS.filter(s => s.primary).slice(0, 1).map(s => s.url)));
  const [primaryUrl, setPrimaryUrl] = React.useState(ATELIER_SERVERS.find(s => s.primary)?.url || ATELIER_SERVERS[0].url);
  const [customUrl, setCustomUrl] = React.useState('');
  const [mirrorChoice, setMirrorChoice] = React.useState('mirror'); // 'primary-only' | 'mirror' | 'mirror-public'
  const [chosenColls, setChosenColls] = React.useState(() => new Set(['photos']));
  const [customColl, setCustomColl] = React.useState('');
  const [draftProfile, setDraftProfile] = React.useState({ ...profile });
  const [uploadState, setUploadState] = React.useState({ phase: 'idle', progress: 0, replicas: {}, file: null });

  const next = () => setStep(s => Math.min(s + 1, OB_STEPS.length - 1));
  const back = () => setStep(s => Math.max(s - 1, 0));

  // Final commit on Finish
  const finish = () => {
    setProfile(draftProfile);
    setSettings(s => ({
      ...s,
      mirror: mirrorChoice !== 'primary-only',
      publishList: mirrorChoice !== 'mirror' ? s.publishList : true,
      privacy: mirrorChoice === 'mirror',
    }));
    // Prepend any new collections the user chose and keep existing local lists.
    const presetByName = Object.fromEntries(OB_COLLECTION_PRESETS.map(p => [p.id, p]));
    const newLists = [];
    chosenColls.forEach(id => {
      const p = presetByName[id];
      if (p && !lists.some(l => l.name === p.name)) {
        newLists.push({ id: p.id, name: p.name, emoji: p.emoji, desc: p.desc, kind: 30003, hashes: [] });
      }
    });
    if (customColl.trim()) newLists.push({ id: 'custom-' + Date.now(), name: customColl.trim(), emoji: '✨', desc: '', kind: 30003, hashes: [] });
    if (newLists.length) setLists([...newLists, ...lists]);
    onDone();
  };

  const stepDef = OB_STEPS[step];

  return (
    <div className={`atl-root ${dark ? 'dark' : ''}`} style={{ '--aaccent': accent || '#e8a4b8', '--aaccent-deep': accent ? shadeColor(accent, -18) : '#c97896', '--aaccent-tint': accent ? lightenTint(accent) : '#f8e8ed' }}>
      <div className="ob-root">
        <div className="ob-topbar">
          <span className="ob-brand"><span className="mk"><PetalMark size={18}/></span><span>Atelier</span></span>
          <button className="ob-skip" onClick={onDone}>Skip setup{step < OB_STEPS.length - 1 ? ' →' : ''}</button>
        </div>

        <div className="ob-rail">
          {OB_STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <div className="ob-rail-step">
                <div className={`ob-rail-num ${i < step ? 'done' : ''} ${i === step ? 'active' : ''}`}>
                  {i < step ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width="11" height="11"><path d="M5 12l5 5L20 7"/></svg> : i + 1}
                </div>
                <span className={`ob-rail-label ${i === step ? 'active' : ''}`}>{s.label}</span>
              </div>
              {i < OB_STEPS.length - 1 && <div className={`ob-rail-line ${i < step ? 'done' : ''}`}/>}
            </React.Fragment>
          ))}
        </div>

        <div className="ob-stage">
          <div className="ob-card" key={step}>
            {step === 0 && <StepWelcome user={user}/>}
            {step === 1 && <StepServers chosen={chosenServers} setChosen={setChosenServers} primary={primaryUrl} setPrimary={setPrimaryUrl} customUrl={customUrl} setCustomUrl={setCustomUrl}/>}
            {step === 2 && <StepMirror choice={mirrorChoice} setChoice={setMirrorChoice} chosenCount={chosenServers.size}/>}
            {step === 3 && <StepCollections chosen={chosenColls} setChosen={setChosenColls} custom={customColl} setCustom={setCustomColl}/>}
            {step === 4 && <StepProfile draft={draftProfile} setDraft={setDraftProfile}/>}
            {step === 5 && <StepUpload state={uploadState} setState={setUploadState} chosen={chosenServers} primaryUrl={primaryUrl} mirror={mirrorChoice !== 'primary-only'}/>}
            {step === 6 && <StepDone chosen={chosenServers} primary={primaryUrl} mirrorChoice={mirrorChoice} colls={chosenColls} customColl={customColl} draft={draftProfile} upload={uploadState}/>}

            <div className="ob-foot">
              <span className="ob-step-info">Step {step + 1} of {OB_STEPS.length} · {stepDef.label}</span>
              <span className="grow"/>
              {step > 0 && <button className="atl-btn" onClick={back}>{PI.chevronLeft || '←'}<span>Back</span></button>}
              {[3, 4, 5].includes(step) && (
                <button className="ob-skipstep" onClick={next} title="Skip this step — you can do it later from the main app">
                  Skip this step
                </button>
              )}
              {step < OB_STEPS.length - 1 ? (
                <button className="atl-btn primary" onClick={next} disabled={step === 1 && chosenServers.size === 0}>
                  <span>{step === 0 ? "Let's go" : 'Continue'}</span>
                </button>
              ) : (
                <button className="atl-btn primary" onClick={finish}>
                  <span>Open Atelier</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Step bodies ----------

function StepWelcome({ user }) {
  return (
    <>
      <div className="ob-card-head">
        <div className="ob-eyebrow">Welcome</div>
        <h1 className="ob-title">Your media, on servers <em style={{ fontFamily: "'EB Garamond', serif" }}>you</em> choose.</h1>
        <p className="ob-sub">Atelier is a Blossom client. Your files live on the storage servers you pick — not on a platform. Your nostr identity stays the same everywhere.</p>
      </div>
      <div className="ob-body">
        <div className="ob-welcome">
          <div className="ob-bigmark">
            <span className="mk"><PetalMark size={36}/></span>
            <div style={{ fontSize: 12, color: 'var(--aink-soft)', marginTop: 6 }}>Signed in as</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{user.display_name || 'Anonymous'}</div>
            <div className="npub">{user.npubShort || 'No account'}</div>
          </div>
          <div>
            <div className="ob-feature">
              <div className="ico">{PI.server}</div>
              <div>
                <div className="name">Servers, plural</div>
                <div className="desc">Upload once, replicate to many. If one disappears, your files don't.</div>
              </div>
            </div>
            <div className="ob-feature">
              <div className="ico">{PI.shield}</div>
              <div>
                <div className="name">Content-addressed</div>
                <div className="desc">Every blob is its sha256 hash. Anyone with the hash can verify the file is intact.</div>
              </div>
            </div>
            <div className="ob-feature">
              <div className="ico">{PI.folder}</div>
              <div>
                <div className="name">Collections, not folders</div>
                <div className="desc">Group blobs into nostr lists (kind 30003) — portable across every Blossom client.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function StepServers({ chosen, setChosen, primary, setPrimary, customUrl, setCustomUrl }) {
  const toggle = (url) => {
    setChosen(prev => {
      const n = new Set(prev);
      if (n.has(url)) { n.delete(url); if (primary === url && n.size > 0) setPrimary([...n][0]); }
      else { n.add(url); if (!primary) setPrimary(url); }
      return n;
    });
  };
  const setPick = (url) => { if (chosen.has(url)) setPrimary(url); };
  const ordered = [...ATELIER_SERVERS];
  return (
    <>
      <div className="ob-card-head">
        <div className="ob-eyebrow">Step 2 · Servers</div>
        <h1 className="ob-title">Where should your blobs live?</h1>
        <p className="ob-sub">Pick at least one. The first one is your primary — new uploads go there first. We'll publish this list as a kind 10063 event so other clients can find your files.</p>
      </div>
      <div className="ob-body">
        {ordered.map((s, i) => {
          const picked = chosen.has(s.url);
          const isPrimary = picked && primary === s.url;
          const idx = picked ? [...chosen].indexOf(s.url) + 1 : null;
          return (
            <div key={s.url} className={`ob-srv-row ${picked ? 'picked' : ''}`} onClick={() => toggle(s.url)}>
              <div className="num">{picked ? idx : '·'}</div>
              <div className="ico">{PI.server}</div>
              <div style={{ minWidth: 0 }}>
                <div className="name" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  {s.name}
                  {isPrimary && <span className="ob-pill pri">Primary</span>}
                  {!isPrimary && picked && <button className="atl-btn" style={{ height: 19, padding: '0 7px', fontSize: 10.5, fontWeight: 500, whiteSpace: 'nowrap' }} onClick={(e) => { e.stopPropagation(); setPick(s.url); }}>Make primary</button>}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 400, color: s.status === 'online' ? 'var(--aok)' : '#d8a23a' }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }}/>{s.status}
                  </span>
                </div>
                <div className="url">{s.url}</div>
              </div>
              <div className="lat">{s.latency}<span style={{ color: 'var(--aink-faint)' }}> ms</span></div>
              <div className="quota">{ATELIER_FORMAT.fmtMB(s.quota)}</div>
              <div className="pin">
                {picked && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>}
              </div>
            </div>
          );
        })}
        <div className="ob-srv-add">
          <input value={customUrl} onChange={e => setCustomUrl(e.target.value)} placeholder="https://your-server.example   (paste a custom Blossom server URL)"/>
          <button className="atl-btn" disabled={!customUrl} onClick={() => { if (!customUrl) return; setCustomUrl(''); }}>{PI.plus}<span>Add</span></button>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--aink-faint)', marginTop: 10, lineHeight: 1.5 }}>
          {chosen.size === 0 ? <span style={{ color: 'var(--adanger)' }}>Pick at least one to continue.</span> : <>{chosen.size} selected · primary will be <b style={{ color: 'var(--aink)' }}>{ATELIER_SERVERS.find(s => s.url === primary)?.name || primary}</b></>}
        </div>
      </div>
    </>
  );
}

function StepMirror({ choice, setChoice, chosenCount }) {
  const opts = [
    { id: 'primary-only', name: 'Primary only — fastest, no redundancy',  desc: 'Upload only to your primary server. If it goes down, your blobs are gone for everyone else, too.', tag: 'BUD-02' },
    { id: 'mirror',       name: 'Mirror to all selected servers (recommended)', desc: 'Every upload is mirrored across the ' + chosenCount + ' server' + (chosenCount === 1 ? '' : 's') + ' you picked using PUT /mirror. Slower, but resilient.', tag: 'BUD-02 + BUD-04' },
    { id: 'mirror-public',name: 'Mirror + publish list publicly',          desc: 'Same as above, plus your kind 10063 server list is broadcast — other clients can fetch your files even if your primary is offline.', tag: 'BUD-04 + kind 10063' },
  ];
  return (
    <>
      <div className="ob-card-head">
        <div className="ob-eyebrow">Step 3 · Replication</div>
        <h1 className="ob-title">How redundant should your uploads be?</h1>
        <p className="ob-sub">Pick a default. You can always override per-file later, and toggle individual blobs to mirror or stay on one server.</p>
      </div>
      <div className="ob-body">
        <div className="ob-choice">
          {opts.map(o => (
            <div key={o.id} className={`ob-choice-card ${choice === o.id ? 'picked' : ''}`} onClick={() => setChoice(o.id)}>
              <div className="ob-radio"/>
              <div>
                <div className="ob-choice-name">{o.name}</div>
                <div className="ob-choice-desc">{o.desc}</div>
                <div className="ob-choice-foot">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="10" height="10"><path d="M8 6l-4 6 4 6M16 6l4 6-4 6"/></svg>
                  <span>{o.tag}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function StepCollections({ chosen, setChosen, custom, setCustom }) {
  const toggle = (id) => setChosen(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return (
    <>
      <div className="ob-card-head">
        <div className="ob-eyebrow">Step 4 · Organize</div>
        <h1 className="ob-title">Spin up a few starter collections.</h1>
        <p className="ob-sub">Collections are nostr lists (kind 30003). Add a blob to one and any Blossom client you sign into can see the same grouping. Pick what fits — you can rename and reshuffle anytime.</p>
      </div>
      <div className="ob-body">
        <div className="ob-coll-grid">
          {OB_COLLECTION_PRESETS.map(p => (
            <div key={p.id} className={`ob-coll-card ${chosen.has(p.id) ? 'picked' : ''}`} onClick={() => toggle(p.id)}>
              <div className="ob-coll-emoji">{p.emoji}</div>
              <div className="ob-coll-cardname">{p.name}</div>
              <div className="ob-coll-cardsub">{p.desc}</div>
            </div>
          ))}
        </div>
        <div className="ob-coll-custom">
          <div className="lab">Or write your own</div>
          <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="e.g. Client work · 2026"/>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--aink-faint)', marginTop: 10 }}>
          {chosen.size + (custom.trim() ? 1 : 0)} collection{(chosen.size + (custom.trim() ? 1 : 0)) === 1 ? '' : 's'} will be created. You can also skip this and start fresh.
        </div>
      </div>
    </>
  );
}

function StepProfile({ draft, setDraft }) {
  const set = (k, v) => setDraft(p => ({ ...p, [k]: v }));
  return (
    <>
      <div className="ob-card-head">
        <div className="ob-eyebrow">Step 5 · Identity</div>
        <h1 className="ob-title">A face for your nostr identity.</h1>
        <p className="ob-sub">Atelier publishes your profile as a kind 0 metadata event. The avatar and banner are blobs uploaded to your primary server, so they live wherever your media lives.</p>
      </div>
      <div className="ob-body">
        <div className="ob-prof">
          <div className="ob-prof-form">
            <div className="ob-prof-field">
              <label>Display name</label>
              <input value={draft.display_name || ''} onChange={e => set('display_name', e.target.value)} placeholder="What people see"/>
            </div>
            <div className="ob-prof-field">
              <label>Username (NIP-05)</label>
              <input value={draft.nip05 || ''} onChange={e => set('nip05', e.target.value)} placeholder="you@nostrplebs.com"/>
            </div>
            <div className="ob-prof-field">
              <label>Lightning address</label>
              <input value={draft.lud16 || ''} onChange={e => set('lud16', e.target.value)} placeholder="you@getalby.com"/>
            </div>
            <div className="ob-prof-field">
              <label>About</label>
              <textarea value={draft.about || ''} onChange={e => set('about', e.target.value)} placeholder="A line or two — what you make, what you're into."/>
            </div>
          </div>
          <div className="ob-prof-prev">
            <div className="ob-prof-banner" style={{ backgroundImage: `url(${draft.banner})` }}/>
            {draft.picture
              ? <img className="ob-prof-av" src={draft.picture} alt=""/>
              : <div className="ob-prof-av" style={{ background: 'var(--apanel-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--aink-faint)' }}>{PI.user}</div>}
            <div className="ob-prof-name">{draft.display_name || 'Your name'}</div>
            <div className="ob-prof-nip05">{draft.nip05 || 'username@example.com'}</div>
            <div className="ob-prof-about">{draft.about || <span style={{ color: 'var(--aink-faint)', fontStyle: 'italic' }}>About text appears here.</span>}</div>
            <div className="ob-prof-fine">Live preview · saves on Finish</div>
          </div>
        </div>
      </div>
    </>
  );
}

function StepUpload({ state, setState, chosen, primaryUrl, mirror }) {
  const inputRef = React.useRef(null);
  const ordered = ATELIER_SERVERS.filter(s => chosen.has(s.url));

  const startUploadPreview = (event) => {
    const selected = event?.target?.files?.[0];
    const file = selected
      ? { name: selected.name, size: selected.size, type: selected.type || 'application/octet-stream' }
      : { name: 'selected-file.jpg', size: 482_117, type: 'image/jpeg' };
    setState({ phase: 'uploading', progress: 0, replicas: Object.fromEntries(ordered.map(s => [s.url, 'pending'])), file });
    let p = 0;
    const tick = () => {
      p = Math.min(100, p + (8 + Math.random() * 14));
      setState(prev => ({ ...prev, progress: p }));
      if (p < 100) { setTimeout(tick, 140); }
      else {
        // Primary completes immediately, mirrors stagger.
        setState(prev => ({ ...prev, phase: 'mirroring', replicas: { ...prev.replicas, [primaryUrl]: 'ok' } }));
        if (mirror) {
          ordered.filter(s => s.url !== primaryUrl).forEach((s, i) => {
            setTimeout(() => {
              setState(prev => ({ ...prev, replicas: { ...prev.replicas, [s.url]: 'syncing' } }));
              setTimeout(() => {
                setState(prev => {
                  const r = { ...prev.replicas, [s.url]: 'ok' };
                  const allDone = Object.values(r).every(v => v === 'ok');
                  return { ...prev, replicas: r, phase: allDone ? 'done' : 'mirroring' };
                });
              }, 900 + Math.random() * 600);
            }, 250 + i * 350);
          });
        } else {
          setState(prev => ({ ...prev, phase: 'done' }));
        }
      }
    };
    setTimeout(tick, 200);
  };

  return (
    <>
      <div className="ob-card-head">
        <div className="ob-eyebrow">Step 6 · Try it</div>
        <h1 className="ob-title">Upload one file to make sure it works.</h1>
        <p className="ob-sub">We'll PUT it to your primary server first. {mirror ? 'Then mirror to the rest, one by one.' : 'Mirroring is off, so it stays only on the primary.'}</p>
      </div>
      <div className="ob-body">
        <div className={`ob-up-zone ${state.phase === 'uploading' || state.phase === 'mirroring' ? 'busy' : ''} ${state.phase === 'done' ? 'done' : ''}`}>
          <div className="ob-up-icon">
            {state.phase === 'done' ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>
             : state.phase === 'idle' ? PI.upload
             : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'ob-spin 1s linear infinite' }}><path d="M12 2a10 10 0 1 0 10 10"/></svg>}
          </div>
          <div className="ob-up-title">
            {state.phase === 'idle' && 'Drop a file or pick one'}
            {state.phase === 'uploading' && 'Uploading to primary…'}
            {state.phase === 'mirroring' && 'Mirroring across servers…'}
            {state.phase === 'done' && 'Upload complete'}
          </div>
          <div className="ob-up-sub">
            {state.phase === 'idle' && 'Anything works. We\'ll generate a sha256 hash and PUT to /upload.'}
            {state.phase !== 'idle' && state.file && <span>{state.file.name} · {ATELIER_FORMAT.fmtBytes(state.file.size)}</span>}
          </div>
          {state.phase === 'idle' && (
            <button className="ob-up-pickbtn" onClick={() => inputRef.current?.click()}>
              {PI.upload}<span>Pick a file</span>
            </button>
          )}
          <input ref={inputRef} type="file" hidden onChange={startUploadPreview}/>
        </div>

        {state.phase !== 'idle' && state.file && (
          <div className="ob-up-progress">
            <div className="ico">{PI.image || PI.upload}</div>
            <div>
              <div className="name">{state.file.name}</div>
              <div className="meta">sha256: a3f2b1c8…d7e8f9 · {ATELIER_FORMAT.fmtBytes(state.file.size)}</div>
              <div className="ob-up-bar"><div className="ob-up-fill" style={{ width: state.progress + '%' }}/></div>
            </div>
            <div className="ob-up-pct">{Math.round(state.progress)}%</div>
          </div>
        )}

        {state.phase !== 'idle' && (
          <div className="ob-up-replicas">
            <span style={{ fontSize: 11.5, color: 'var(--aink-faint)', fontWeight: 500, marginRight: 4 }}>Replicas:</span>
            {ordered.map(s => {
              const r = state.replicas[s.url] || 'pending';
              const cls = r === 'ok' ? 'ok' : r === 'syncing' ? 'pending' : 'pending';
              return (
                <span key={s.url} className={`ob-up-replica ${cls}`}>
                  {r === 'ok' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width="9" height="9"><path d="M5 12l5 5L20 7"/></svg>}
                  {r === 'syncing' && <span className="spin"/>}
                  {r === 'pending' && <span className="dot"/>}
                  <span>{s.name}</span>
                </span>
              );
            })}
            {state.phase === 'done' && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--aok)', fontWeight: 600 }}>✓ Verified on all replicas</span>}
          </div>
        )}
      </div>
    </>
  );
}

function StepDone({ chosen, primary, mirrorChoice, colls, customColl, draft, upload }) {
  const primaryName = ATELIER_SERVERS.find(s => s.url === primary)?.name || primary;
  const mirrorLabels = { 'primary-only': 'Primary only', 'mirror': 'Mirror across all', 'mirror-public': 'Mirror + public list' };
  const collCount = colls.size + (customColl.trim() ? 1 : 0);
  const rows = [
    { name: 'Servers', summary: chosen.size + ' selected · ' + primaryName + ' is primary', pill: 'kind 10063' },
    { name: 'Replication', summary: mirrorLabels[mirrorChoice], pill: mirrorChoice === 'primary-only' ? 'BUD-02' : 'BUD-04' },
    { name: 'Collections', summary: collCount + ' will be created', pill: 'kind 30003' },
    { name: 'Profile', summary: (draft.display_name || 'unnamed') + (draft.nip05 ? ' · ' + draft.nip05 : ''), pill: 'kind 0' },
    { name: 'Test upload', summary: upload.phase === 'done' ? 'Verified on ' + Object.values(upload.replicas).filter(v => v === 'ok').length + ' server' + (Object.values(upload.replicas).filter(v => v === 'ok').length === 1 ? '' : 's') : 'Skipped', pill: upload.phase === 'done' ? 'BUD-02' : '—' },
  ];
  return (
    <>
      <div className="ob-card-head">
        <div className="ob-eyebrow">Done</div>
        <h1 className="ob-title">You're set up.</h1>
        <p className="ob-sub">Here's what we'll save when you open Atelier. Anything you change here can be edited later in Servers, Settings, Collections, and Profile.</p>
      </div>
      <div className="ob-body">
        <div className="ob-done-list">
          {rows.map(r => (
            <div key={r.name} className="ob-done-row">
              <span className="check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg></span>
              <div>
                <div className="name">{r.name}</div>
                <div className="summary">{r.summary}</div>
              </div>
              <span className="pill">{r.pill}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
