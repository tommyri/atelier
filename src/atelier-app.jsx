import React from 'react';
import { AtelierOnboarding } from './atelier-onboarding.jsx';
import { PetalMark, PI, shadeColor, lightenTint } from './atelier-shared.jsx';
import { ATELIER_FORMAT } from './data.js';
import { createAtelierBackup, parseAtelierBackup } from './lib/atelierBackup.js';
import { createServerPreferenceEvent, parseServerPreferenceEvent } from './lib/blossomPreferences.js';
import { inspectBlossomServer } from './lib/blossomHealth.js';
import { loadBlossomLibrary, refreshBlobReplicas } from './lib/blossomLibrary.js';
import { createUploadJob, mirrorBlobToServer, sha256File, uploadAndMirrorFile, validateUploadFile } from './lib/blossomUpload.js';
import { inspectImageMetadata, stripImageMetadata } from './lib/metadataPrivacy.js';
import { applyRemoteCollectionEvent, collectionShareReference, createCollectionEvent, markCollectionPublished } from './lib/nostrCollections.js';
import { createProfileEvent, parseProfileEvent, validateProfileFields, verifyNip05 } from './lib/nostrProfile.js';
import {
  DEFAULT_NOSTR_RELAYS,
  addRelayRecord,
  createRelayListEvent,
  fetchRelayListEvent,
  moveRelayRecord,
  parseRelayListEvent,
  publishRelayListEvent,
  relayPublishUrls,
  relayReadUrls,
  removeRelayRecord,
} from './lib/nostrRelayList.js';
import { connectNip46Bunker } from './lib/nip46Auth.js';
import { profileFromNostrPublicKey, profileFromReadonlyNpub, requestNip07PublicKey } from './lib/nostrAuth.js';
import { addServerRecord, markPrimaryServer, moveServerRecord, removeServerRecord } from './lib/serverConfig.js';
import { useAtelierStore } from './lib/useAtelierStore.js';

// Direction B — "Atelier"
// Pro-tool feel. Filmstrip + large preview pane. Dense. Top tab nav.
// Reuses data.js but defines its own scoped CSS + components.

const ATELIER_STYLES = `
  .atl-root {
    --abg: #f7f5f1;
    --apanel: #ffffff;
    --apanel-2: #faf8f4;
    --aink: #15110d;
    --aink-soft: #56504a;
    --aink-faint: #8e8780;
    --aline: #e6e1d8;
    --aline-2: #efeae0;
    --aaccent: #e8a4b8;
    --aaccent-deep: #c97896;
    --aaccent-tint: #f8e8ed;
    --adanger: #b54836;
    --aok: #4a8d68;
    color: var(--aink);
    background: var(--abg);
    font-family: 'Söhne', 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
    font-size: 13px;
    line-height: 1.45;
    height: 100%; width: 100%; overflow: hidden;
    display: flex; flex-direction: column;
  }
  .atl-root.dark {
    --abg: #131110;
    --apanel: #1c1a18;
    --apanel-2: #181614;
    --aink: #f0ece5;
    --aink-soft: #a8a098;
    --aink-faint: #6a635c;
    --aline: #28241f;
    --aline-2: #20+;
    --aline-2: #221f1c;
    --aaccent: #f0b3c5;
    --aaccent-deep: #e8a4b8;
    --aaccent-tint: #2c1f24;
  }
  .atl-root * { box-sizing: border-box; }
  .atl-root button { font-family: inherit; cursor: pointer; }
  .atl-root input, .atl-root textarea, .atl-root select { font-family: inherit; }
  .atl-root button:focus-visible, .atl-root input:focus-visible, .atl-root textarea:focus-visible, .atl-root select:focus-visible, .atl-root [tabindex]:focus-visible {
    outline: 2px solid var(--aaccent-deep);
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    .atl-root *, .atl-root *::before, .atl-root *::after { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; scroll-behavior: auto !important; }
  }

  /* Top header */
  .atl-head { height: 48px; flex-shrink: 0; display: flex; align-items: center; gap: 12px; padding: 0 14px; border-bottom: 1px solid var(--aline); background: var(--apanel); }
  .atl-brand { display: flex; align-items: center; gap: 8px; padding: 0 6px 0 0; }
  .atl-brand-name { font-size: 14px; font-weight: 600; letter-spacing: -0.01em; }
  .atl-tabs { display: flex; gap: 1px; background: var(--aline-2); border-radius: 8px; padding: 2px; }
  .atl-tab { height: 26px; padding: 0 11px; border-radius: 6px; border: 0; background: transparent; color: var(--aink-soft); font-size: 12.5px; font-weight: 500; display: inline-flex; align-items: center; gap: 6px; }
  .atl-tab svg { width: 13px; height: 13px; }
  .atl-tab:hover { color: var(--aink); }
  .atl-tab.active { background: var(--apanel); color: var(--aink); box-shadow: 0 1px 2px rgba(0,0,0,0.06); }
  .atl-spacer { flex: 1; }
  .atl-pubkey-pill { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border: 1px solid var(--aline); border-radius: 999px; background: var(--apanel-2); font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 11.5px; color: var(--aink-soft); }
  .atl-pubkey-pill .atl-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--aok); }
  .atl-readonly-pill { display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 10px; border: 1px solid rgba(181,72,54,0.24); border-radius: 999px; background: rgba(181,72,54,0.06); color: var(--adanger); font-size: 11.5px; font-weight: 600; white-space: nowrap; }
  .atl-readonly-pill svg { width: 12px; height: 12px; }
  .atl-iconbtn { width: 28px; height: 28px; border-radius: 6px; border: 0; background: transparent; color: var(--aink-soft); display: inline-flex; align-items: center; justify-content: center; }
  .atl-iconbtn:hover { background: var(--aline-2); color: var(--aink); }
  .atl-btn:disabled, .atl-iconbtn:disabled, .atl-iconbtn-mini:disabled, .atl-login-btn:disabled, .atl-toggle:disabled { opacity: 0.48; cursor: not-allowed; }
  .atl-iconbtn svg { width: 14px; height: 14px; }

  .atl-body { flex: 1; min-height: 0; display: flex; flex-direction: column; }

  /* Library (3-pane: left filters / center filmstrip+preview / right inspector) */
  .atl-lib { flex: 1; min-height: 0; display: grid; grid-template-columns: 200px 1fr 300px; }
  .atl-pane-l { border-right: 1px solid var(--aline); background: var(--apanel-2); padding: 14px 12px; overflow-y: auto; }
  .atl-pane-c { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
  .atl-pane-r { border-left: 1px solid var(--aline); background: var(--apanel-2); overflow-y: auto; padding: 16px 16px 24px; }

  .atl-section-h { font-size: 10.5px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--aink-faint); margin: 14px 6px 6px; }
  .atl-section-h:first-child { margin-top: 0; }
  .atl-rowbtn { width: 100%; display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 6px; border: 0; background: transparent; color: var(--aink-soft); font-size: 12.5px; text-align: left; }
  .atl-rowbtn:hover { background: var(--aline-2); color: var(--aink); }
  .atl-rowbtn.active { background: var(--aaccent-tint); color: var(--aaccent-deep); font-weight: 600; }
  .atl-rowbtn .ct { margin-left: auto; font-variant-numeric: tabular-nums; font-size: 11.5px; opacity: 0.6; }
  .atl-rowbtn svg { width: 13px; height: 13px; flex-shrink: 0; }

  /* Center: preview area + filmstrip */
  .atl-preview { flex: 1; min-height: 0; padding: 18px 22px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; background: linear-gradient(180deg, var(--abg), var(--apanel-2)); position: relative; }
  .atl-preview-img { max-width: 100%; max-height: 100%; object-fit: contain; box-shadow: 0 12px 36px rgba(0,0,0,0.12); border-radius: 4px; }
  .atl-preview-card { width: 320px; padding: 36px 30px; background: var(--apanel); border: 1px solid var(--aline); border-radius: 10px; text-align: center; }
  .atl-preview-card-icon { width: 56px; height: 56px; margin: 0 auto 14px; border-radius: 12px; background: var(--aaccent-tint); color: var(--aaccent-deep); display: flex; align-items: center; justify-content: center; }
  .atl-preview-card-icon svg { width: 24px; height: 24px; }
  .atl-preview-floatbar { position: absolute; top: 14px; right: 18px; display: flex; align-items: center; gap: 4px; background: var(--apanel); border: 1px solid var(--aline); border-radius: 8px; padding: 3px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }

  .atl-strip-wrap { flex-shrink: 0; border-top: 1px solid var(--aline); background: var(--apanel); }
  .atl-strip-bar { height: 38px; display: flex; align-items: center; padding: 0 14px; gap: 10px; border-bottom: 1px solid var(--aline-2); }
  .atl-search { flex: 1; max-width: 280px; position: relative; }
  .atl-search input { width: 100%; height: 26px; border-radius: 6px; border: 1px solid var(--aline); background: var(--apanel-2); padding: 0 10px 0 26px; font-size: 12px; color: var(--aink); outline: none; }
  .atl-search input:focus { border-color: var(--aaccent); background: var(--apanel); }
  .atl-search svg { position: absolute; left: 8px; top: 50%; transform: translateY(-50%); width: 12px; height: 12px; color: var(--aink-faint); }
  .atl-strip-meta { font-size: 11.5px; color: var(--aink-faint); font-variant-numeric: tabular-nums; margin-left: auto; }

  .atl-strip { display: flex; gap: 6px; padding: 10px 14px; overflow-x: auto; height: 138px; align-items: center; }
  .atl-strip::-webkit-scrollbar { height: 6px; }
  .atl-strip::-webkit-scrollbar-thumb { background: var(--aline); border-radius: 3px; }
  .atl-thumb { flex: 0 0 auto; width: 100px; height: 100px; border-radius: 6px; overflow: hidden; position: relative; cursor: pointer; background: var(--aline-2); border: 2px solid transparent; transition: all .12s; }
  .atl-thumb:hover { border-color: var(--aink-faint); transform: translateY(-1px); }
  .atl-thumb.active { border-color: var(--aaccent-deep); box-shadow: 0 4px 14px rgba(201,120,150,0.3); }
  .atl-thumb img { width: 100%; height: 100%; object-fit: cover; }
  .atl-thumb-ico { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--aink-faint); }
  .atl-thumb-ico svg { width: 22px; height: 22px; }
  .atl-thumb-name { position: absolute; bottom: 0; left: 0; right: 0; padding: 4px 6px; background: linear-gradient(to top, rgba(0,0,0,0.7), transparent); color: #fff; font-size: 10.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .atl-thumb-badge { position: absolute; top: 4px; right: 4px; padding: 1px 5px; border-radius: 4px; background: rgba(0,0,0,0.6); color: #fff; font-size: 9.5px; font-weight: 600; backdrop-filter: blur(4px); }
  .atl-thumb-check { position: absolute; top: 4px; left: 4px; width: 16px; height: 16px; border-radius: 50%; background: rgba(255,255,255,0.9); border: 1.5px solid #fff; opacity: 0; display: flex; align-items: center; justify-content: center; }
  .atl-thumb:hover .atl-thumb-check, .atl-thumb.selected .atl-thumb-check { opacity: 1; }
  .atl-thumb.selected .atl-thumb-check { background: var(--aaccent-deep); border-color: var(--aaccent-deep); }
  .atl-thumb.selected .atl-thumb-check svg { color: #fff; }
  .atl-thumb-check svg { width: 9px; height: 9px; color: transparent; }

  /* Browse-grid view (when libView === 'grid') */
  .atl-browse { flex: 1; min-height: 0; overflow-y: auto; padding: 14px 18px 24px; background: var(--apanel); }
  .atl-grid { display: grid; gap: 10px; }
  .atl-grid.s { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
  .atl-grid.m { grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); }
  .atl-grid.l { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
  .atl-gtile { aspect-ratio: 1; border-radius: 8px; overflow: hidden; position: relative; cursor: pointer; background: var(--aline-2); border: 2px solid transparent; transition: transform .12s, border-color .12s, box-shadow .12s; }
  .atl-gtile:hover { border-color: var(--aink-faint); transform: translateY(-1px); box-shadow: 0 6px 18px rgba(0,0,0,0.08); }
  .atl-gtile.active { border-color: var(--aaccent-deep); }
  .atl-gtile.selected { border-color: var(--aaccent-deep); box-shadow: 0 0 0 2px var(--aaccent-tint); }
  .atl-gtile img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .atl-gtile .gtile-ico { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--aink-faint); background: var(--apanel-2); }
  .atl-gtile .gtile-ico svg { width: 36px; height: 36px; }
  .atl-gtile .gtile-name { position: absolute; left: 0; right: 0; bottom: 0; padding: 18px 8px 6px; background: linear-gradient(to top, rgba(0,0,0,0.78), transparent); color: #fff; font-size: 11.5px; font-weight: 500; line-height: 1.25; }
  .atl-gtile .gtile-meta { font-size: 10px; opacity: 0.78; margin-top: 1px; font-variant-numeric: tabular-nums; }
  .atl-gtile .gtile-badge { position: absolute; top: 6px; right: 6px; padding: 1.5px 6px; border-radius: 4px; background: rgba(0,0,0,0.6); color: #fff; font-size: 10px; font-weight: 600; backdrop-filter: blur(4px); }
  .atl-gtile .gtile-check { position: absolute; top: 6px; left: 6px; width: 18px; height: 18px; border-radius: 50%; background: rgba(255,255,255,0.92); border: 1.5px solid #fff; opacity: 0; display: flex; align-items: center; justify-content: center; transition: opacity .12s; }
  .atl-gtile:hover .gtile-check, .atl-gtile.selected .gtile-check { opacity: 1; }
  .atl-gtile.selected .gtile-check { background: var(--aaccent-deep); border-color: var(--aaccent-deep); }
  .atl-gtile.selected .gtile-check svg { color: #fff; }
  .atl-gtile .gtile-check svg { width: 11px; height: 11px; color: transparent; }
  .atl-gtile.video::before { content: ''; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 36px; height: 36px; border-radius: 50%; background: rgba(0,0,0,0.55); pointer-events: none; opacity: 0; transition: opacity .12s; }
  .atl-gtile.video::after { content: ''; position: absolute; top: 50%; left: 50%; transform: translate(-44%, -50%); width: 0; height: 0; border-left: 11px solid #fff; border-top: 7px solid transparent; border-bottom: 7px solid transparent; pointer-events: none; opacity: 0; transition: opacity .12s; }
  .atl-gtile.video:hover::before, .atl-gtile.video:hover::after { opacity: 1; }
  .atl-gtile-empty { grid-column: 1 / -1; padding: 60px 20px; text-align: center; color: var(--aink-faint); font-size: 12.5px; }
  .atl-grid-section-h { font-size: 10.5px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--aink-faint); margin: 14px 2px 8px; grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; }
  .atl-grid-section-h:first-child { margin-top: 0; }
  .atl-grid-section-h .ct { font-weight: 500; color: var(--aink-faint); text-transform: none; letter-spacing: 0; font-size: 11px; }
  .atl-lib-alert { padding: 7px 14px; border-bottom: 1px solid rgba(176,116,16,0.18); background: rgba(176,116,16,0.08); color: #8d5d0f; font-size: 11.5px; }
  .atl-lib-state { min-height: 220px; display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--aink-faint); font-size: 12.5px; }
  .atl-spinner { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--aline); border-top-color: var(--aaccent-deep); animation: atl-spin .8s linear infinite; }
  .atl-skel-grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); }
  .atl-skel-tile { aspect-ratio: 1; border-radius: 8px; border: 1px solid var(--aline); background: var(--apanel-2); overflow: hidden; position: relative; }
  .atl-skel-line { height: 10px; border-radius: 999px; background: var(--aline-2); margin-top: 8px; overflow: hidden; position: relative; }
  .atl-skel-tile::after, .atl-skel-line::after { content: ''; position: absolute; inset: 0; transform: translateX(-100%); background: linear-gradient(90deg, transparent, rgba(255,255,255,0.42), transparent); animation: atl-shimmer 1.2s infinite; }
  .atl-loadmore { display: flex; justify-content: center; padding: 16px; }
  @keyframes atl-spin { to { transform: rotate(360deg); } }
  @keyframes atl-shimmer { to { transform: translateX(100%); } }

  /* View-mode segmented control */
  .atl-segctl { display: inline-flex; border: 1px solid var(--aline); border-radius: 6px; overflow: hidden; height: 24px; background: var(--apanel-2); }
  .atl-segctl button { background: transparent; border: 0; height: 22px; padding: 0 8px; font-size: 11.5px; color: var(--aink-soft); cursor: pointer; display: inline-flex; align-items: center; gap: 5px; }
  .atl-segctl button svg { width: 11px; height: 11px; }
  .atl-segctl button.on { background: var(--apanel); color: var(--aink); font-weight: 600; box-shadow: inset 0 0 0 1px var(--aaccent-tint); }
  .atl-segctl button + button { border-left: 1px solid var(--aline); }
  .atl-sizectl { display: inline-flex; gap: 1px; background: var(--aline); padding: 1px; border-radius: 5px; }
  .atl-sizectl button { width: 20px; height: 20px; border: 0; background: var(--apanel-2); color: var(--aink-faint); font-size: 11px; cursor: pointer; border-radius: 3px; }
  .atl-sizectl button.on { background: var(--aink); color: var(--apanel); }

  /* Inspector */
  .atl-insp-head { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 14px; }
  .atl-insp-name { font-size: 13.5px; font-weight: 600; word-break: break-word; line-height: 1.3; }
  .atl-insp-rel { font-size: 11px; color: var(--aink-faint); margin-top: 2px; }
  .atl-insp-actions { display: flex; gap: 4px; margin-left: auto; }
  .atl-insp-divider { height: 1px; background: var(--aline); margin: 14px 0; }
  .atl-insp-row { display: grid; grid-template-columns: 80px 1fr; gap: 4px 10px; font-size: 12px; padding: 3px 0; }
  .atl-insp-row dt { color: var(--aink-faint); }
  .atl-insp-row dd { color: var(--aink); margin: 0; word-break: break-all; }
  .atl-insp-hash { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 10.5px; padding: 7px 9px; background: var(--apanel); border: 1px solid var(--aline); border-radius: 5px; word-break: break-all; line-height: 1.45; cursor: pointer; }
  .atl-insp-hash:hover { background: var(--aline-2); }
  .atl-insp-server { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border: 1px solid var(--aline); border-radius: 6px; margin-bottom: 5px; background: var(--apanel); font-size: 11.5px; }
  .atl-insp-server .atl-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--aok); flex-shrink: 0; }
  .atl-insp-server .atl-tag { font-size: 9.5px; padding: 1px 5px; border-radius: 3px; background: var(--aaccent-tint); color: var(--aaccent-deep); font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
  .atl-btn { height: 26px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--aline); background: var(--apanel); color: var(--aink); font-size: 12px; font-weight: 500; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; flex-shrink: 0; }
  .atl-btn svg { width: 12px; height: 12px; }
  .atl-btn:hover { background: var(--aline-2); }
  .atl-btn.primary { background: var(--aink); border-color: var(--aink); color: var(--abg); }
  .atl-btn.primary:hover { background: var(--aink-soft); border-color: var(--aink-soft); }
  .atl-btn.danger { color: var(--adanger); border-color: rgba(181,72,54,0.3); }
  .atl-btn.danger:hover { background: rgba(181,72,54,0.06); }
  .atl-btn.accent { background: var(--aaccent-deep); border-color: var(--aaccent-deep); color: #fff; }

  /* Other views (single-pane) */
  .atl-view { flex: 1; min-height: 0; overflow-y: auto; padding: 24px 28px; }
  .atl-pagehead { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
  .atl-pagetitle { font-size: 22px; font-weight: 600; letter-spacing: -0.015em; }
  .atl-pagesub { font-size: 12.5px; color: var(--aink-soft); margin-top: 3px; }

  /* Upload */
  .atl-drop { border: 1.5px dashed var(--aline); border-radius: 12px; padding: 44px 28px; text-align: center; background: var(--apanel); }
  .atl-drop.over { border-color: var(--aaccent-deep); background: var(--aaccent-tint); }
  .atl-drop-title { font-size: 15px; font-weight: 600; }
  .atl-drop-sub { color: var(--aink-soft); font-size: 12px; margin: 4px 0 14px; }
  .atl-upload-row { display: grid; grid-template-columns: 28px 1fr 130px 78px 76px 90px 64px; gap: 10px; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--aline-2); font-size: 12.5px; }
  .atl-upload-row:hover { background: var(--apanel-2); }
  .atl-upload-row .ico { width: 28px; height: 28px; border-radius: 5px; background: var(--aline-2); color: var(--aink-faint); display: flex; align-items: center; justify-content: center; }
  .atl-upload-row .ico svg { width: 13px; height: 13px; }
  .atl-upload-bar { height: 3px; background: var(--aline); border-radius: 999px; overflow: hidden; }
  .atl-upload-fill { height: 100%; background: var(--aaccent-deep); border-radius: 999px; transition: width .2s; }

  /* Strip-metadata controls */
  .atl-strip-banner { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border: 1px solid var(--aline); border-radius: 8px; background: var(--apanel); margin-top: 14px; font-size: 12.5px; }
  .atl-strip-banner .lab { font-weight: 600; }
  .atl-strip-banner .sub { color: var(--aink-faint); font-size: 11.5px; margin-top: 1px; }
  .atl-switch { position: relative; width: 32px; height: 18px; border: 0; padding: 0; border-radius: 999px; background: var(--aline); cursor: pointer; flex-shrink: 0; transition: background .15s; }
  .atl-switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: white; transition: transform .15s; box-shadow: 0 1px 2px rgba(0,0,0,0.2); }
  .atl-switch.on { background: var(--aaccent-deep); }
  .atl-switch.on::after { transform: translateX(14px); }
  .atl-switch.sm { width: 26px; height: 15px; }
  .atl-switch.sm::after { width: 11px; height: 11px; }
  .atl-switch.sm.on::after { transform: translateX(11px); }
  .atl-strip-tag { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.04em; text-transform: uppercase; }
  .atl-strip-tag.on { background: var(--aaccent-tint); color: var(--aaccent-deep); }
  .atl-strip-tag.off { background: var(--aline-2); color: var(--aink-faint); }

  /* Metadata block in inspector */
  .atl-meta-head { display: flex; align-items: center; gap: 6px; }
  .atl-meta-head .pill { font-size: 9.5px; font-weight: 600; padding: 1.5px 5px; border-radius: 3px; letter-spacing: 0.05em; text-transform: uppercase; }
  .atl-meta-head .pill.warn { background: #fff4e5; color: #b45309; }
  .atl-meta-head .pill.ok { background: var(--aline-2); color: var(--aink-faint); }
  .atl-meta-grid { display: grid; grid-template-columns: 78px 1fr; gap: 3px 10px; font-size: 11.5px; padding: 4px 0; }
  .atl-meta-grid dt { color: var(--aink-faint); }
  .atl-meta-grid dd { font-variant-numeric: tabular-nums; word-break: break-word; }
  .atl-meta-warn { display: flex; gap: 8px; align-items: flex-start; padding: 8px 10px; background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; border-radius: 6px; font-size: 11.5px; line-height: 1.4; margin: 8px 0; }
  .atl-meta-warn svg { width: 13px; height: 13px; flex-shrink: 0; margin-top: 1px; }
  .atl-meta-sections { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
  .atl-meta-sections .sec { font-size: 10.5px; padding: 2px 6px; border-radius: 4px; background: var(--aline-2); color: var(--aink-soft); font-family: ui-monospace, Menlo, monospace; }
  .atl-meta-empty { font-size: 11.5px; color: var(--aink-faint); padding: 6px 0; font-style: italic; }
  .atl-gps-map { width: 100%; height: 80px; border-radius: 6px; border: 1px solid var(--aline); background:
    radial-gradient(circle at 50% 50%, var(--aaccent-deep) 0 4px, transparent 5px),
    linear-gradient(180deg, #e8edf2 0%, #dde3eb 100%);
    background-repeat: no-repeat; background-position: center; margin-top: 6px; position: relative; overflow: hidden; }
  .atl-gps-map::before { content: ''; position: absolute; inset: 0; background-image:
    linear-gradient(0deg, var(--aline) 1px, transparent 1px),
    linear-gradient(90deg, var(--aline) 1px, transparent 1px);
    background-size: 22px 22px; opacity: 0.45; }
  .atl-gps-coord { position: absolute; bottom: 4px; left: 6px; font-size: 10px; font-family: ui-monospace, Menlo, monospace; background: rgba(255,255,255,0.85); padding: 1px 5px; border-radius: 3px; color: var(--aink-soft); }

  /* Profile */
  .atl-prof-grid { display: grid; grid-template-columns: 280px 1fr; gap: 32px; }
  .atl-prof-preview { background: var(--apanel); border: 1px solid var(--aline); border-radius: 10px; overflow: hidden; }
  .atl-prof-banner { height: 80px; background-size: cover; background-position: center; }
  .atl-prof-av { width: 64px; height: 64px; border-radius: 50%; border: 3px solid var(--apanel); margin: -32px auto 8px; display: block; object-fit: cover; }
  .atl-prof-name { text-align: center; font-size: 15px; font-weight: 600; }
  .atl-prof-nip05 { text-align: center; font-size: 12px; color: var(--aaccent-deep); margin-top: 2px; }
  .atl-prof-about { padding: 12px 14px 16px; font-size: 12px; color: var(--aink-soft); line-height: 1.5; text-align: center; }
  .atl-prof-stats { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid var(--aline-2); }
  .atl-prof-stat { padding: 10px 0; text-align: center; font-size: 11px; color: var(--aink-faint); border-right: 1px solid var(--aline-2); }
  .atl-prof-stat:last-child { border-right: 0; }
  .atl-prof-stat b { display: block; color: var(--aink); font-size: 13px; font-weight: 600; }
  .atl-formgrid { display: flex; flex-direction: column; gap: 12px; }
  .atl-field { display: flex; flex-direction: column; gap: 5px; }
  .atl-field label { font-size: 11.5px; font-weight: 600; color: var(--aink-soft); }
  .atl-input { height: 32px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--aline); background: var(--apanel); color: var(--aink); font-size: 12.5px; outline: none; }
  .atl-input:focus { border-color: var(--aaccent); }
  .atl-textarea { padding: 8px 10px; min-height: 72px; resize: vertical; border-radius: 6px; border: 1px solid var(--aline); background: var(--apanel); color: var(--aink); font-size: 12.5px; outline: none; line-height: 1.5; }
  .atl-textarea:focus { border-color: var(--aaccent); }
  .atl-fieldhelp { font-size: 11px; color: var(--aink-faint); }

  /* Servers */
  .atl-tablecard { background: var(--apanel); border: 1px solid var(--aline); border-radius: 10px; overflow: hidden; }
  .atl-srv-row { display: grid; grid-template-columns: 18px 28px 1fr 120px 100px 36px 60px 60px; gap: 12px; align-items: center; padding: 10px 14px; border-bottom: 1px solid var(--aline-2); font-size: 12.5px; }
  .atl-srv-row:last-child { border-bottom: 0; }
  .atl-srv-row:hover { background: var(--apanel-2); }
  .atl-srv-row .grip { color: var(--aink-faint); cursor: grab; }
  .atl-srv-row .ico { width: 28px; height: 28px; border-radius: 6px; background: var(--aaccent-tint); color: var(--aaccent-deep); display: flex; align-items: center; justify-content: center; }
  .atl-srv-row .ico svg { width: 13px; height: 13px; }
  .atl-srv-row .name { font-weight: 600; display: flex; align-items: center; gap: 7px; }
  .atl-srv-row .url { font-size: 11px; color: var(--aink-faint); font-family: 'JetBrains Mono', ui-monospace, monospace; margin-top: 2px; }
  .atl-srv-row .meta { color: var(--aink-soft); font-variant-numeric: tabular-nums; }

  /* Settings */
  .atl-set-card { background: var(--apanel); border: 1px solid var(--aline); border-radius: 10px; padding: 4px 16px; margin-bottom: 18px; }
  .atl-set-row { padding: 14px 0; border-bottom: 1px solid var(--aline-2); display: flex; align-items: flex-start; gap: 18px; }
  .atl-set-row:last-child { border-bottom: 0; }
  .atl-set-name { font-size: 12.5px; font-weight: 500; }
  .atl-set-desc { font-size: 11.5px; color: var(--aink-soft); margin-top: 2px; max-width: 480px; line-height: 1.5; }
  .atl-set-spacer { flex: 1; }
  .atl-toggle { width: 32px; height: 18px; border-radius: 999px; background: var(--aline); border: 0; padding: 0; position: relative; transition: background .15s; flex-shrink: 0; }
  .atl-toggle.on { background: var(--aaccent-deep); }
  .atl-toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform .15s; box-shadow: 0 1px 2px rgba(0,0,0,0.2); }
  .atl-toggle.on::after { transform: translateX(14px); }

  /* Login */
  .atl-login { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: radial-gradient(ellipse at top, var(--aaccent-tint) 0%, var(--abg) 60%); }
  .atl-login-card { width: 420px; max-width: 90vw; background: var(--apanel); border: 1px solid var(--aline); border-radius: 16px; padding: 36px 36px 30px; box-shadow: 0 20px 60px rgba(0,0,0,0.06); }
  .atl-login-mark { display: flex; align-items: center; gap: 9px; margin-bottom: 24px; }
  .atl-login-title { font-size: 22px; font-weight: 600; letter-spacing: -0.01em; margin-bottom: 6px; }
  .atl-login-sub { font-size: 13px; color: var(--aink-soft); margin-bottom: 22px; }
  .atl-login-btn { width: 100%; height: 40px; border-radius: 8px; padding: 0 14px; display: flex; align-items: center; gap: 9px; font-size: 13px; font-weight: 500; margin-bottom: 8px; border: 1px solid var(--aline); background: var(--apanel); color: var(--aink); }
  .atl-login-btn:hover { background: var(--aline-2); }
  .atl-login-btn:disabled { opacity: 0.55; cursor: wait; }
  .atl-login-btn.primary { background: var(--aink); border-color: var(--aink); color: var(--abg); }
  .atl-login-btn.primary:hover { background: var(--aink-soft); border-color: var(--aink-soft); }
  .atl-login-alert { border: 1px solid rgba(181,72,54,0.28); background: rgba(181,72,54,0.06); color: var(--adanger); border-radius: 8px; padding: 9px 11px; font-size: 12px; line-height: 1.45; margin: -8px 0 12px; }
  .atl-login-fine { font-size: 11px; color: var(--aink-faint); margin-top: 18px; line-height: 1.5; padding-top: 16px; border-top: 1px solid var(--aline-2); }

  /* Collections — chips, popover, breadcrumb, mini icons */
  .atl-iconbtn-mini { width: 18px; height: 18px; border-radius: 4px; border: 0; background: transparent; color: var(--aink-faint); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
  .atl-iconbtn-mini:hover { background: var(--aline-2); color: var(--aink); }
  .atl-iconbtn-mini svg { width: 11px; height: 11px; }
  .atl-crumb { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 4px 0 9px; border-radius: 6px; background: var(--aaccent-tint); color: var(--aaccent-deep); font-size: 12px; font-weight: 600; }
  .atl-crumb-x { width: 18px; height: 18px; border: 0; background: transparent; color: inherit; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
  .atl-crumb-x:hover { background: rgba(0,0,0,0.08); }
  .atl-crumb-x svg { width: 10px; height: 10px; }
  .atl-pop { position: absolute; top: calc(100% + 4px); left: 0; min-width: 220px; background: var(--apanel); border: 1px solid var(--aline); border-radius: 8px; box-shadow: 0 12px 28px rgba(0,0,0,0.14); padding: 4px; z-index: 100; }
  .atl-pop-h { font-size: 10.5px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--aink-faint); padding: 8px 10px 6px; }
  .atl-pop-row { width: 100%; display: flex; align-items: center; gap: 8px; padding: 6px 9px; border-radius: 5px; border: 0; background: transparent; color: var(--aink); font-size: 12.5px; cursor: pointer; }
  .atl-pop-row:hover { background: var(--aline-2); }
  .atl-pop-row svg { width: 12px; height: 12px; }
  .atl-pop-state { width: 16px; height: 16px; display: inline-flex; align-items: center; justify-content: center; color: var(--aaccent-deep); }
  .atl-pop-state svg { width: 12px; height: 12px; }
  .atl-pop-divider { height: 1px; background: var(--aline-2); margin: 4px 0; }
  .atl-insp-chips { display: flex; flex-wrap: wrap; gap: 5px; }
  .atl-insp-chip { display: inline-flex; align-items: center; gap: 5px; height: 22px; padding: 0 4px 0 8px; border-radius: 999px; border: 1px solid var(--aaccent); background: var(--aaccent-tint); color: var(--aaccent-deep); font-size: 11.5px; font-weight: 600; cursor: pointer; }
  .atl-insp-chip:hover { background: color-mix(in oklab, var(--aaccent-tint), var(--aink) 6%); }
  .atl-insp-chip-x { width: 14px; height: 14px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
  .atl-insp-chip-x:hover { background: rgba(0,0,0,0.1); }
  .atl-insp-chip-x svg { width: 9px; height: 9px; }
  .atl-insp-chip.add { border: 1px dashed var(--aline); background: transparent; color: var(--aink-soft); padding: 0 9px; }
  .atl-insp-chip.add:hover { background: var(--aline-2); color: var(--aink); }
  .atl-insp-chip.add svg { width: 10px; height: 10px; }

  /* Collections view */
  .atl-coll-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
  .atl-coll-card { background: var(--apanel); border: 1px solid var(--aline); border-radius: 10px; overflow: hidden; cursor: pointer; transition: transform .15s, box-shadow .15s, border-color .15s; }
  .atl-coll-card:hover { border-color: var(--aaccent); transform: translateY(-1px); box-shadow: 0 6px 18px rgba(0,0,0,0.06); }
  .atl-coll-conflict { padding: 6px 10px; background: rgba(176,116,16,0.1); color: #8d5d0f; font-size: 11px; font-weight: 600; }
  .atl-coll-cover { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; height: 120px; background: var(--aline-2); }
  .atl-coll-cover-cell { background: var(--aaccent-tint) center/cover no-repeat; display: flex; align-items: center; justify-content: center; color: var(--aaccent-deep); font-size: 18px; }
  .atl-coll-cover-cell.empty { background: var(--apanel-2); color: var(--aink-faint); }
  .atl-coll-meta { padding: 11px 13px 13px; }
  .atl-coll-title { display: flex; align-items: center; gap: 7px; font-size: 13.5px; font-weight: 600; letter-spacing: -0.005em; }
  .atl-coll-title input { font: inherit; color: inherit; background: transparent; border: 0; outline: 0; padding: 0; flex: 1; min-width: 0; border-bottom: 1px dashed var(--aaccent); }
  .atl-coll-desc { font-size: 12px; color: var(--aink-faint); margin-top: 4px; line-height: 1.4; min-height: 16px; }
  .atl-coll-foot { display: flex; align-items: center; gap: 8px; margin-top: 10px; font-size: 11.5px; color: var(--aink-faint); }
  .atl-coll-foot .ct { font-variant-numeric: tabular-nums; }
  .atl-coll-foot .kind { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 10px; padding: 1px 5px; border-radius: 3px; background: var(--aline-2); color: var(--aink-soft); }
  .atl-coll-card-new { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 28px; border: 1.5px dashed var(--aline); border-radius: 10px; cursor: pointer; color: var(--aink-faint); min-height: 230px; background: transparent; }
  .atl-coll-card-new:hover { border-color: var(--aaccent); color: var(--aaccent-deep); background: var(--aaccent-tint); }
  .atl-coll-card-new .ico { width: 36px; height: 36px; border-radius: 8px; background: var(--aline-2); color: var(--aink-soft); display: flex; align-items: center; justify-content: center; }
  .atl-coll-card-new:hover .ico { background: var(--apanel); color: var(--aaccent-deep); }
  .atl-coll-card-new .ico svg { width: 16px; height: 16px; }
  .atl-coll-actions { display: flex; gap: 4px; margin-left: auto; }

  /* Servers — overhauled */
  .srv-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; }
  .srv-stat { background: var(--apanel); border: 1px solid var(--aline); border-radius: 10px; padding: 12px 14px; }
  .srv-stat-lab { font-size: 10.5px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--aink-faint); }
  .srv-stat-val { font-size: 22px; font-weight: 600; letter-spacing: -0.015em; margin-top: 4px; display: flex; align-items: baseline; gap: 6px; }
  .srv-stat-sub { font-size: 11px; color: var(--aink-faint); font-weight: 400; letter-spacing: 0; }
  .srv-stat-bar { height: 3px; background: var(--aline-2); border-radius: 999px; margin-top: 8px; overflow: hidden; }
  .srv-stat-fill { height: 100%; background: var(--aaccent-deep); border-radius: 999px; }

  .srv-add-panel { background: var(--apanel); border: 1px solid var(--aaccent); border-radius: 10px; padding: 14px 16px; margin-bottom: 14px; box-shadow: 0 4px 14px rgba(0,0,0,0.05); }
  .srv-add-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
  .srv-add-form { display: flex; gap: 8px; }
  .srv-suggest { height: 22px; padding: 0 8px; border-radius: 999px; border: 1px solid var(--aline); background: var(--apanel-2); font-size: 11px; color: var(--aink-soft); cursor: pointer; font-family: 'JetBrains Mono', monospace; }
  .srv-suggest:hover { border-color: var(--aaccent); color: var(--aaccent-deep); }
  .srv-caps { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin-top: 5px; }
  .srv-cap { padding: 1px 5px; border-radius: 4px; border: 1px solid var(--aline); color: var(--aink-faint); font-size: 9.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
  .srv-cap.on { border-color: rgba(74,141,104,0.28); background: rgba(74,141,104,0.08); color: var(--aok); }
  .srv-cap.warn { border-color: rgba(176,116,16,0.3); background: rgba(176,116,16,0.08); color: #b07410; }
  .srv-reason { font-size: 10.5px; color: var(--aink-faint); }

  .srv-usebar { height: 2px; background: var(--aline-2); border-radius: 999px; margin-top: 5px; max-width: 240px; overflow: hidden; }
  .srv-usefill { height: 100%; background: var(--aaccent-deep); border-radius: 999px; }

  .srv-foot { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 18px; }
  .srv-foot-card { background: var(--apanel-2); border: 1px solid var(--aline-2); border-radius: 10px; padding: 12px 14px; }
  .srv-foot-h { display: flex; align-items: center; gap: 6px; font-size: 10.5px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--aink-faint); margin-bottom: 6px; }
  .srv-foot-h svg { width: 11px; height: 11px; }
  .srv-foot-v { font-size: 14px; font-weight: 600; }
  .srv-foot-sub { font-size: 11px; color: var(--aink-soft); margin-top: 3px; line-height: 1.4; }
  .srv-foot-actions { margin-top: 10px; }
  .srv-event-panel { margin-top: 14px; background: var(--apanel); border: 1px solid var(--aline); border-radius: 10px; padding: 14px 16px; }

  @media (max-width: 980px) {
    .atl-head { overflow-x: auto; scrollbar-width: none; }
    .atl-head::-webkit-scrollbar { display: none; }
    .atl-tabs { flex: 0 0 auto; }
    .atl-pubkey-pill { display: none; }
    .atl-lib { grid-template-columns: 164px 1fr; }
    .atl-pane-r { display: none; }
    .atl-prof-grid,
    .srv-grid,
    .srv-foot { grid-template-columns: 1fr; }
  }

  @media (max-width: 640px) {
    .atl-root { min-width: 0; overflow: hidden; }
    .atl-head { height: auto; min-height: 48px; gap: 8px; padding: 8px 10px; }
    .atl-brand { flex: 0 0 auto; }
    .atl-storage-stat { display: none; }
    .atl-tab { padding: 0 9px; }
    .atl-tab span { display: none; }
    .atl-lib { grid-template-columns: 1fr; }
    .atl-pane-l { display: none; }
    .atl-strip-bar { height: auto; min-height: 42px; flex-wrap: wrap; padding: 8px 10px; }
    .atl-search { max-width: none; flex-basis: 100%; order: 2; }
    .atl-strip { height: 116px; padding: 8px 10px; }
    .atl-thumb { width: 86px; height: 86px; }
    .atl-browse { padding: 12px 10px 18px; }
    .atl-grid.s,
    .atl-grid.m,
    .atl-grid.l { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .atl-view { padding: 18px 14px; }
    .atl-pagehead { align-items: flex-start; flex-direction: column; }
    .atl-upload-row { grid-template-columns: 28px 1fr 68px; }
    .atl-upload-row > :nth-child(3),
    .atl-upload-row > :nth-child(4),
    .atl-upload-row > :nth-child(5),
    .atl-upload-row > :nth-child(7) { display: none; }
    .atl-coll-grid { grid-template-columns: 1fr; }
    .atl-login-card { width: calc(100vw - 28px); }
  }

  /* Toast */
  .atl-toast { position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%); background: var(--aink); color: var(--abg); padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 500; z-index: 200; display: flex; align-items: center; gap: 7px; }
  .atl-toast svg { width: 12px; height: 12px; color: #7ed4a3; }
`;

function ensureAtelierStyles() {
  if (document.getElementById('atelier-styles')) return;
  const style = document.createElement('style');
  style.id = 'atelier-styles';
  style.textContent = ATELIER_STYLES;
  document.head.appendChild(style);
}

export function AtelierApp({ dark, accent, view: initialView, loggedIn: initialLoggedIn, forceOnboarding, onboardStartStep }) {
  React.useEffect(ensureAtelierStyles, []);
  const {
    session,
    logIn,
    setSession,
    logOut,
    profile,
    setProfile,
    settings,
    setSettings,
    servers,
    setServers,
    serverPreferenceEvent,
    setServerPreferenceEvent,
    relays,
    setRelays,
    relayListEvent,
    setRelayListEvent,
    blobs,
    setBlobs,
    lists,
    setLists,
    uploadJobs,
    setUploadJobs,
    resetLocalState,
    restoreSnapshot,
  } = useAtelierStore({ initialLoggedIn: initialLoggedIn !== false, initialSettings: { dark, accent } });
  const user = profile;
  const effectiveDark = settings.dark;
  const effectiveAccent = settings.accent || accent || '#e8a4b8';
  const [view, setView] = React.useState(initialView || 'library');
  const [onboarding, setOnboarding] = React.useState(!!forceOnboarding);
  React.useEffect(() => { setOnboarding(!!forceOnboarding); }, [forceOnboarding]);
  const [filter, setFilter] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const [activeIdx, setActiveIdx] = React.useState(0);
  const [selected, setSelected] = React.useState(new Set());
  const [toast, setToast] = React.useState(null);
  const [authState, setAuthState] = React.useState({ busy: false, error: null });
  const [dragOver, setDragOver] = React.useState(false);
  const [activeList, setActiveList] = React.useState(null); // list id, or null = all
  const [serverFilter, setServerFilter] = React.useState('all');
  const [dateFilter, setDateFilter] = React.useState('all');
  const [visibleCount, setVisibleCount] = React.useState(60);
  const [libraryState, setLibraryState] = React.useState({ loading: false, error: null, lastLoadedAt: null });
  const [detailRefreshing, setDetailRefreshing] = React.useState(false);
  const [showAddTo, setShowAddTo] = React.useState(false);
  const [libView, setLibView] = React.useState('grid'); // 'grid' (browse) or 'focus' (filmstrip + preview)
  const [gridSize, setGridSize] = React.useState('m'); // 's' | 'm' | 'l'
  const showToast = (m) => { setToast(m); setTimeout(() => setToast(null), 1700); };
  const readonly = session.readonly;
  const readonlyToast = () => showToast('Read-only mode: sign in with NIP-07 or NIP-46 to make changes.');
  const signEvent = async (event) => {
    if (session.mode === 'nip07' && window.nostr?.signEvent) return window.nostr.signEvent(event);
    return null;
  };
  const copyText = async (text, label = 'Text') => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied`);
    } catch {
      showToast(`Unable to copy ${label.toLowerCase()}`);
    }
  };
  const openDownload = (blob) => {
    if (!blob?.url) return;
    const anchor = document.createElement('a');
    anchor.href = blob.url;
    anchor.download = blob.name || blob.hash;
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    showToast(`Download started for ${blob.name}`);
  };
  const removeLocalBlobs = (hashes) => {
    if (readonly) return readonlyToast();
    const hashSet = new Set(hashes);
    setBlobs(prev => prev.filter(blob => !hashSet.has(blob.hash)));
    setLists(prev => prev.map(list => ({ ...list, hashes: list.hashes.filter(hash => !hashSet.has(hash)) })));
    setSelected(prev => {
      const next = new Set(prev);
      hashes.forEach(hash => next.delete(hash));
      return next;
    });
    showToast(`Removed ${hashes.length} blob${hashes.length === 1 ? '' : 's'} from local library`);
  };
  const mirrorLocalBlobs = async (hashes) => {
    if (readonly) return readonlyToast();
    const activeServers = servers.filter(server => server.status !== 'offline' && server.capabilities?.mirror !== false);
    const targetBlobs = blobs.filter(blob => hashes.includes(blob.hash));
    if (!targetBlobs.length) return;
    const tasks = [];
    for (const blob of targetBlobs) {
      const existing = new Set(blob.servers || [blob.server]);
      for (const server of activeServers) {
        if (!existing.has(server.name)) tasks.push({ blob, server });
      }
    }
    if (!tasks.length) {
      showToast('Selected blobs already have all active replicas');
      return;
    }
    showToast(`Mirroring ${targetBlobs.length} blob${targetBlobs.length === 1 ? '' : 's'} to ${tasks.length} replica target${tasks.length === 1 ? '' : 's'}`);
    const results = await Promise.allSettled(tasks.map(({ blob, server }) => mirrorBlobToServer({
      blob,
      targetServer: server,
      pubkey: session.pubkey || profile.pubkey,
      signEvent,
    }).then((mirrored) => ({ hash: blob.hash, server, mirrored }))));
    const fulfilled = results.filter(result => result.status === 'fulfilled').map(result => result.value);
    if (fulfilled.length) {
      setBlobs(prev => prev.map(blob => {
        const additions = fulfilled.filter(result => result.hash === blob.hash);
        if (!additions.length) return blob;
        const serversSet = new Set(blob.servers || [blob.server]);
        const replicas = [...(blob.replicas || [])];
        additions.forEach(({ server, mirrored }) => {
          serversSet.add(server.name);
          replicas.push({ server: server.name, url: mirrored.url, available: true, checkedAt: new Date().toISOString(), type: mirrored.type, size: mirrored.size });
        });
        return { ...blob, servers: Array.from(serversSet), replicas };
      }));
    }
    const failed = results.length - fulfilled.length;
    showToast(failed ? `Mirrored ${fulfilled.length}; ${failed} failed` : `Mirrored ${fulfilled.length} replica${fulfilled.length === 1 ? '' : 's'}`);
  };

  // Membership helpers
  const listsForBlob = React.useCallback((hash) => lists.filter(l => l.hashes.includes(hash)), [lists]);
  const toggleBlobInList = (listId, hashes) => {
    if (readonly) {
      readonlyToast();
      return;
    }
    setLists(prev => prev.map(l => {
      if (l.id !== listId) return l;
      const allIn = hashes.every(h => l.hashes.includes(h));
      const next = allIn ? l.hashes.filter(h => !hashes.includes(h)) : Array.from(new Set([...l.hashes, ...hashes]));
      return { ...l, hashes: next, eventUpdatedAt: Math.floor(Date.now() / 1000) };
    }));
  };

  const filtered = React.useMemo(() => {
    let r = blobs;
    if (activeList) {
      const set = new Set(lists.find(l => l.id === activeList)?.hashes || []);
      r = r.filter(b => set.has(b.hash));
    }
    if (serverFilter !== 'all') r = r.filter(b => (b.servers || [b.server]).includes(serverFilter));
    if (dateFilter !== 'all') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - Number(dateFilter));
      r = r.filter(b => new Date(b.uploaded) >= cutoff);
    }
    if (filter !== 'all') r = r.filter(b => ATELIER_FORMAT.kindOf(b) === filter);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(b => b.name.toLowerCase().includes(q) || b.hash.includes(q) || b.type.toLowerCase().includes(q) || (b.servers || [b.server]).some(server => server.toLowerCase().includes(q)));
    }
    return [...r].sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded));
  }, [filter, search, activeList, serverFilter, dateFilter, blobs, lists]);

  React.useEffect(() => { setVisibleCount(60); setActiveIdx(0); }, [filter, search, activeList, serverFilter, dateFilter]);
  const visibleBlobs = React.useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  React.useEffect(() => { if (activeIdx >= visibleBlobs.length) setActiveIdx(0); }, [activeIdx, visibleBlobs.length]);

  const counts = React.useMemo(() => {
    const c = { all: blobs.length, image: 0, video: 0, audio: 0, pdf: 0, file: 0 };
    blobs.forEach(b => c[ATELIER_FORMAT.kindOf(b)]++);
    return c;
  }, [blobs]);

  const totalUsed = servers.reduce((s, x) => s + x.used, 0);
  const totalQuota = servers.reduce((s, x) => s + x.quota, 0);

  const active = visibleBlobs[activeIdx];

  const refreshLibrary = async () => {
    setLibraryState((current) => ({ loading: true, error: null, lastLoadedAt: current.lastLoadedAt }));
    try {
      const { blobs: nextBlobs, errors } = await loadBlossomLibrary({ servers, pubkey: session.pubkey });
      if (nextBlobs.length > 0) {
        setBlobs(nextBlobs);
        setSelected(new Set());
      }
      setLibraryState({
        loading: false,
        error: errors.length ? errors.join(' · ') : nextBlobs.length === 0 ? 'No blobs were returned by your configured servers.' : null,
        lastLoadedAt: new Date().toISOString(),
      });
      showToast(nextBlobs.length > 0 ? `Loaded ${nextBlobs.length} blobs` : 'No server blobs found');
    } catch (error) {
      setLibraryState((current) => ({ loading: false, error: error.message || 'Unable to load Blossom library.', lastLoadedAt: current.lastLoadedAt }));
    }
  };

  const refreshActiveBlob = async () => {
    if (!active) return;
    setDetailRefreshing(true);
    try {
      const refreshed = await refreshBlobReplicas(active, servers);
      setBlobs(prev => prev.map(blob => blob.hash === refreshed.hash ? refreshed : blob));
      showToast('Blob details refreshed');
    } catch (error) {
      showToast(error.message || 'Unable to refresh blob details');
    } finally {
      setDetailRefreshing(false);
    }
  };

  const handleLogin = async (mode, authInput = '') => {
    setAuthState({ busy: true, error: null });
    try {
      if (mode === 'nip07') {
        const pubkey = await requestNip07PublicKey();
        setProfile((current) => profileFromNostrPublicKey(pubkey, current));
        setSession({ loggedIn: true, mode: 'nip07', pubkey, readonly: false });
        setAuthState({ busy: false, error: null });
        return;
      }
      if (mode === 'nip46') {
        const { session: nextSession, profile: nextProfile } = await connectNip46Bunker(authInput, {
          baseProfile: profile,
          timeoutMs: 30000,
        });
        setProfile(nextProfile);
        setSession(nextSession);
        setAuthState({ busy: false, error: null });
        return;
      }
      if (mode === 'readonly') {
        const nextProfile = profileFromReadonlyNpub(authInput, profile);
        setProfile(nextProfile);
        setSession({ loggedIn: true, mode: 'readonly', pubkey: nextProfile.pubkey, readonly: true });
        setAuthState({ busy: false, error: null });
        return;
      }
      logIn('demo');
    } catch (error) {
      setAuthState({ busy: false, error: error.message || 'Unable to sign in.' });
      return;
    }
    setAuthState({ busy: false, error: null });
  };

  const handleLogout = () => {
    logOut();
    setAuthState({ busy: false, error: null });
    setActiveList(null);
    setSelected(new Set());
    setShowAddTo(false);
    setView('library');
  };

  if (!session.loggedIn) return <AtelierLogin onLogin={handleLogin} authError={authState.error} authBusy={authState.busy} dark={effectiveDark}/>;
  if (onboarding) return <AtelierOnboarding dark={effectiveDark} accent={effectiveAccent} startStep={onboardStartStep || 0} onDone={() => setOnboarding(false)} profile={profile} setProfile={setProfile} settings={settings} setSettings={setSettings} lists={lists} setLists={setLists}/>;

  return (
    <div className={`atl-root ${effectiveDark ? 'dark' : ''}`} style={{ '--aaccent': effectiveAccent, '--aaccent-deep': shadeColor(effectiveAccent, -18), '--aaccent-tint': lightenTint(effectiveAccent) }}>
      <header className="atl-head">
        <div className="atl-brand">
          <span style={{ color: 'var(--aaccent-deep)' }}><PetalMark size={18}/></span>
          <span className="atl-brand-name">Atelier</span>
        </div>
        <div className="atl-tabs">
          <button className={`atl-tab ${view === 'library' ? 'active' : ''}`} onClick={() => setView('library')}>{PI.library}<span>Library</span></button>
          <button className={`atl-tab ${view === 'collections' ? 'active' : ''}`} onClick={() => setView('collections')}>{PI.folder}<span>Collections</span></button>
          <button className={`atl-tab ${view === 'upload' ? 'active' : ''}`} onClick={() => setView('upload')}>{PI.upload}<span>Upload</span></button>
          <button className={`atl-tab ${view === 'profile' ? 'active' : ''}`} onClick={() => setView('profile')}>{PI.user}<span>Profile</span></button>
          <button className={`atl-tab ${view === 'servers' ? 'active' : ''}`} onClick={() => setView('servers')}>{PI.server}<span>Servers</span></button>
          <button className={`atl-tab ${view === 'relays' ? 'active' : ''}`} onClick={() => setView('relays')}>{PI.bolt}<span>Relays</span></button>
          <button className={`atl-tab ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>{PI.settings}<span>Settings</span></button>
        </div>
        <div className="atl-spacer"/>
        <span className="atl-storage-stat" style={{ fontSize: 11.5, color: 'var(--aink-faint)', whiteSpace: 'nowrap' }}>{ATELIER_FORMAT.fmtMB(totalUsed)} / {ATELIER_FORMAT.fmtMB(totalQuota)}</span>
        {readonly && <span className="atl-readonly-pill">{PI.user}<span>Read-only</span></span>}
        <span className="atl-pubkey-pill"><span className="atl-dot"/>{user.npubShort || 'No account'}</span>
        {user.picture
          ? <img src={user.picture} style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }} alt={`${user.display_name || 'Profile'} avatar`}/>
          : <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--aline-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--aink-faint)' }}>{PI.user}</span>}
      </header>

      <div className="atl-body">
        {view === 'library' && (
          <div className="atl-lib">
            <aside className="atl-pane-l">
              <div className="atl-section-h">Filter</div>
              {[
                { id: 'all', label: 'All blobs', icon: PI.library },
                { id: 'image', label: 'Images', icon: PI.library },
                { id: 'video', label: 'Video', icon: PI.play },
                { id: 'audio', label: 'Audio', icon: PI.audio },
                { id: 'pdf', label: 'Docs', icon: PI.pdf },
                { id: 'file', label: 'Other', icon: PI.file },
              ].map(f => (
                <button key={f.id} className={`atl-rowbtn ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>
                  {f.icon}<span>{f.label}</span><span className="ct">{counts[f.id]}</span>
                </button>
              ))}
              <div className="atl-section-h" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Collections</span>
                <button className="atl-iconbtn-mini" title="New collection" disabled={readonly} onClick={() => readonly ? readonlyToast() : setView('collections')}>{PI.plus}</button>
              </div>
              <button className={`atl-rowbtn ${activeList === null ? 'active' : ''}`} onClick={() => setActiveList(null)}>
                {PI.library}<span>All blobs</span><span className="ct">{blobs.length}</span>
              </button>
              {lists.map(l => (
                <button key={l.id} className={`atl-rowbtn ${activeList === l.id ? 'active' : ''}`} onClick={() => setActiveList(l.id)}>
                  <span style={{ width: 13, fontSize: 12, lineHeight: 1, display: 'inline-flex', justifyContent: 'center' }}>{l.emoji}</span>
                  <span>{l.name}</span>
                  <span className="ct">{l.hashes.length}</span>
                </button>
              ))}
              <div className="atl-section-h">Servers</div>
              <button className={`atl-rowbtn ${serverFilter === 'all' ? 'active' : ''}`} onClick={() => setServerFilter('all')}>
                {PI.server}<span>All servers</span><span className="ct">{blobs.length}</span>
              </button>
              {servers.map(s => (
                <button key={s.url} className={`atl-rowbtn ${serverFilter === s.name ? 'active' : ''}`} onClick={() => setServerFilter(s.name)}>
                  <span className={`pt-dot ${s.status}`} style={{ width: 6, height: 6, borderRadius: '50%' }}/>
                  <span>{s.name}</span>
                  <span className="ct">{blobs.filter(b => (b.servers || [b.server]).includes(s.name)).length}</span>
                </button>
              ))}
              <div className="atl-section-h">Recent</div>
              <button className={`atl-rowbtn ${dateFilter === 'all' ? 'active' : ''}`} onClick={() => setDateFilter('all')}>{PI.upload}<span>All dates</span><span className="ct">{counts.all}</span></button>
              <button className={`atl-rowbtn ${dateFilter === '7' ? 'active' : ''}`} onClick={() => setDateFilter('7')}>{PI.upload}<span>Last 7 days</span><span className="ct">{blobs.filter(b => Date.now() - new Date(b.uploaded).getTime() <= 7 * 86400000).length}</span></button>
              <button className={`atl-rowbtn ${dateFilter === '30' ? 'active' : ''}`} onClick={() => setDateFilter('30')}>{PI.upload}<span>Last 30 days</span><span className="ct">{blobs.filter(b => Date.now() - new Date(b.uploaded).getTime() <= 30 * 86400000).length}</span></button>
            </aside>

            <div className="atl-pane-c">
              {libView === 'focus' && (
                <div className="atl-preview">
                  {active && (ATELIER_FORMAT.kindOf(active) === 'image' || ATELIER_FORMAT.kindOf(active) === 'video') ? (
                    <img className="atl-preview-img" src={active.url} alt={active.name}/>
                  ) : active ? (
                    <div className="atl-preview-card">
                      <div className="atl-preview-card-icon">{ATELIER_FORMAT.kindOf(active) === 'audio' ? PI.audio : ATELIER_FORMAT.kindOf(active) === 'pdf' ? PI.pdf : PI.file}</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{active.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--aink-faint)', marginTop: 3 }}>{active.type}</div>
                      <button className="atl-btn primary" style={{ marginTop: 16 }}>{PI.download}<span>Download</span></button>
                    </div>
                  ) : null}
                  <div className="atl-preview-floatbar">
                    <button className="atl-iconbtn" disabled={visibleBlobs.length === 0} onClick={() => setActiveIdx(i => (i - 1 + visibleBlobs.length) % visibleBlobs.length)}>{PI.arrowLeft}</button>
                    <span style={{ fontSize: 11.5, color: 'var(--aink-faint)', padding: '0 6px', fontVariantNumeric: 'tabular-nums' }}>{visibleBlobs.length ? activeIdx + 1 : 0} / {visibleBlobs.length}</span>
                    <button className="atl-iconbtn" disabled={visibleBlobs.length === 0} onClick={() => setActiveIdx(i => (i + 1) % visibleBlobs.length)}>{PI.arrowRight}</button>
                  </div>
                </div>
              )}

              <div className="atl-strip-wrap" style={libView === 'grid' ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', borderTop: 0 } : {}}>
                <div className="atl-strip-bar">
                  <div className="atl-search">
                    {PI.search}
                    <input placeholder="name or sha256…" value={search} onChange={e => setSearch(e.target.value)}/>
                  </div>
                  <button className="atl-btn" disabled={libraryState.loading} style={{ height: 24 }} onClick={refreshLibrary}>{PI.refresh}<span>{libraryState.loading ? 'Loading…' : 'Refresh'}</span></button>
                  {activeList && (() => {
                    const l = lists.find(x => x.id === activeList);
                    return l ? (
                      <span className="atl-crumb">
                        <span style={{ fontSize: 12 }}>{l.emoji}</span>
                        <span>{l.name}</span>
                        <button className="atl-crumb-x" onClick={() => setActiveList(null)} title="Clear">{PI.close}</button>
                      </span>
                    ) : null;
                  })()}
                  {serverFilter !== 'all' && (
                    <span className="atl-crumb">
                      <span>{serverFilter}</span>
                      <button className="atl-crumb-x" onClick={() => setServerFilter('all')} title="Clear">{PI.close}</button>
                    </span>
                  )}
                  {dateFilter !== 'all' && (
                    <span className="atl-crumb">
                      <span>Last {dateFilter} days</span>
                      <button className="atl-crumb-x" onClick={() => setDateFilter('all')} title="Clear">{PI.close}</button>
                    </span>
                  )}
                  {selected.size > 0 ? (
                    <>
                      <span style={{ fontSize: 12, color: 'var(--aaccent-deep)', fontWeight: 600 }}>{selected.size} selected</span>
                      <button className="atl-btn" onClick={() => setSelected(new Set())} style={{ height: 24 }}>Clear</button>
                      <div style={{ position: 'relative' }}>
                        <button className="atl-btn" disabled={readonly} style={{ height: 24 }} onClick={() => readonly ? readonlyToast() : setShowAddTo(v => !v)}>{PI.folderPlus}<span>Add to…</span></button>
                        {showAddTo && (
                          <>
                            <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setShowAddTo(false)}/>
                            <div className="atl-pop">
                              <div className="atl-pop-h">Add {selected.size} to collection</div>
                              {lists.map(l => {
                                const sel = Array.from(selected);
                                const allIn = sel.every(h => l.hashes.includes(h));
                                const someIn = !allIn && sel.some(h => l.hashes.includes(h));
                                return (
                                  <button key={l.id} className="atl-pop-row" onClick={() => { toggleBlobInList(l.id, sel); showToast(allIn ? `Removed from ${l.name}` : `Added to ${l.name}`); }}>
                                    <span style={{ fontSize: 12, width: 16, textAlign: 'center' }}>{l.emoji}</span>
                                    <span style={{ flex: 1, textAlign: 'left' }}>{l.name}</span>
                                    <span className="atl-pop-state" data-state={allIn ? 'all' : someIn ? 'some' : 'none'}>
                                      {allIn ? PI.check : someIn ? <span style={{ width: 8, height: 2, background: 'currentColor', display: 'block' }}/> : null}
                                    </span>
                                  </button>
                                );
                              })}
                              <div className="atl-pop-divider"/>
                              <button className="atl-pop-row" onClick={() => { setShowAddTo(false); setView('collections'); }}>{PI.plus}<span style={{ flex: 1, textAlign: 'left' }}>New collection…</span></button>
                            </div>
                          </>
                        )}
                      </div>
                      <button className="atl-btn" disabled={readonly} style={{ height: 24 }} onClick={() => mirrorLocalBlobs(Array.from(selected))}>{PI.copy}<span>Mirror</span></button>
                      <button className="atl-btn danger" disabled={readonly} style={{ height: 24 }} onClick={() => removeLocalBlobs(Array.from(selected))}>{PI.trash}<span>Remove</span></button>
                    </>
                  ) : null}
                  <div className="atl-strip-meta">{visibleBlobs.length} / {filtered.length} blobs</div>
                  <div className="atl-segctl" title="Browse mode">
                    <button className={libView === 'grid' ? 'on' : ''} onClick={() => setLibView('grid')} title="Grid — browse all blobs">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/><rect x="3" y="14" width="7" height="7" rx="1.2"/><rect x="14" y="14" width="7" height="7" rx="1.2"/></svg>
                      <span>Grid</span>
                    </button>
                    <button className={libView === 'focus' ? 'on' : ''} onClick={() => setLibView('focus')} title="Focus — large preview + filmstrip">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="13" rx="1.5"/><rect x="3" y="18" width="3.5" height="3" rx="0.5"/><rect x="8" y="18" width="3.5" height="3" rx="0.5"/><rect x="13" y="18" width="3.5" height="3" rx="0.5"/><rect x="18" y="18" width="3" height="3" rx="0.5"/></svg>
                      <span>Focus</span>
                    </button>
                  </div>
                  {libView === 'grid' && (
                    <div className="atl-sizectl" title="Tile size">
                      {['s','m','l'].map(sz => (
                        <button key={sz} className={gridSize === sz ? 'on' : ''} onClick={() => setGridSize(sz)} title={sz === 's' ? 'Small' : sz === 'm' ? 'Medium' : 'Large'}>
                          {sz.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {libraryState.error && <div className="atl-lib-alert" role="status">{libraryState.error}</div>}
                {libraryState.loading ? (
                  <LibrarySkeleton />
                ) : filtered.length === 0 ? (
                  <div className="atl-browse"><div className="atl-lib-state">{blobs.length === 0 ? 'No blobs have been loaded yet.' : 'No blobs match these filters.'}</div></div>
                ) : libView === 'focus' ? (
                  <div className="atl-strip">
                    {visibleBlobs.map((b, i) => {
                      const k = ATELIER_FORMAT.kindOf(b);
                      const isImg = k === 'image' || k === 'video';
                      return (
                        <div key={b.hash} className={`atl-thumb ${i === activeIdx ? 'active' : ''} ${selected.has(b.hash) ? 'selected' : ''}`}
                          onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) { const n = new Set(selected); n.has(b.hash) ? n.delete(b.hash) : n.add(b.hash); setSelected(n); } else setActiveIdx(i); }}>
                          {isImg ? <img src={b.thumb || b.url} alt=""/> : <div className="atl-thumb-ico">{k === 'audio' ? PI.audio : k === 'pdf' ? PI.pdf : PI.file}</div>}
                          <button className="atl-thumb-check" onClick={(e) => { e.stopPropagation(); const n = new Set(selected); n.has(b.hash) ? n.delete(b.hash) : n.add(b.hash); setSelected(n); }}>{PI.check}</button>
                          {k === 'video' && <span className="atl-thumb-badge">{ATELIER_FORMAT.fmtDur(b.duration)}</span>}
                          <div className="atl-thumb-name">{b.name}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <BrowseGrid
                    filtered={visibleBlobs}
                    totalCount={filtered.length}
                    activeIdx={activeIdx}
                    setActiveIdx={setActiveIdx}
                    selected={selected}
                    setSelected={setSelected}
                    gridSize={gridSize}
                    onLoadMore={() => setVisibleCount(count => count + 60)}
                    onOpenFocus={(i) => { setActiveIdx(i); setLibView('focus'); }}
                  />
                )}
              </div>
            </div>

            <aside className="atl-pane-r">
              {active && (
                <>
                  <div className="atl-insp-head">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="atl-insp-name">{active.name}</div>
                      <div className="atl-insp-rel">{ATELIER_FORMAT.fmtRel(active.uploaded)}</div>
                    </div>
                    <div className="atl-insp-actions">
                      <button className="atl-iconbtn" title="Copy URL" aria-label="Copy URL" onClick={() => copyText(active.url, 'URL')}>{PI.link}</button>
                      <button className="atl-iconbtn" title="Download" aria-label="Download" onClick={() => openDownload(active)}>{PI.download}</button>
                      <button className="atl-iconbtn" title="Refresh blob details" disabled={detailRefreshing} onClick={refreshActiveBlob}>{PI.refresh}</button>
                      <button className="atl-iconbtn" title="Remove from library" aria-label="Remove from library" disabled={readonly} style={{ color: 'var(--adanger)' }} onClick={() => removeLocalBlobs([active.hash])}>{PI.trash}</button>
                    </div>
                  </div>
                  <dl className="atl-insp-row"><dt>Type</dt><dd>{active.type}</dd></dl>
                  <dl className="atl-insp-row"><dt>Size</dt><dd>{ATELIER_FORMAT.fmtBytes(active.size)}</dd></dl>
                  {active.w && <dl className="atl-insp-row"><dt>Dimensions</dt><dd>{active.w} × {active.h}</dd></dl>}
                  {active.duration && <dl className="atl-insp-row"><dt>Duration</dt><dd>{ATELIER_FORMAT.fmtDur(active.duration)}</dd></dl>}
                  {active.pages && <dl className="atl-insp-row"><dt>Pages</dt><dd>{active.pages}</dd></dl>}
                  <dl className="atl-insp-row"><dt>Uploaded</dt><dd>{ATELIER_FORMAT.fmtDate(active.uploaded)}</dd></dl>
                  <div className="atl-insp-divider"/>
                  <div className="atl-section-h" style={{ margin: '0 0 6px' }}>Collections</div>
                  <div className="atl-insp-chips">
                    {listsForBlob(active.hash).length === 0 && (
                      <span style={{ fontSize: 11.5, color: 'var(--aink-faint)' }}>Not in any collection</span>
                    )}
                    {listsForBlob(active.hash).map(l => (
                      <button key={l.id} className="atl-insp-chip" onClick={() => setActiveList(l.id)} title={`Filter by ${l.name}`}>
                        <span style={{ fontSize: 11 }}>{l.emoji}</span>
                        <span>{l.name}</span>
                        <span className="atl-insp-chip-x" onClick={(e) => { e.stopPropagation(); if (readonly) return readonlyToast(); toggleBlobInList(l.id, [active.hash]); showToast(`Removed from ${l.name}`); }}>{PI.close}</span>
                      </button>
                    ))}
                    <div style={{ position: 'relative' }}>
                      <button className="atl-insp-chip add" disabled={readonly} onClick={() => readonly ? readonlyToast() : setShowAddTo(v => !v)}>{PI.plus}<span>Add</span></button>
                      {showAddTo && (
                        <>
                          <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setShowAddTo(false)}/>
                          <div className="atl-pop" style={{ right: 0, left: 'auto' }}>
                            <div className="atl-pop-h">Add to collection</div>
                            {lists.map(l => {
                              const isIn = l.hashes.includes(active.hash);
                              return (
                                <button key={l.id} className="atl-pop-row" onClick={() => { toggleBlobInList(l.id, [active.hash]); showToast(isIn ? `Removed from ${l.name}` : `Added to ${l.name}`); }}>
                                  <span style={{ fontSize: 12, width: 16, textAlign: 'center' }}>{l.emoji}</span>
                                  <span style={{ flex: 1, textAlign: 'left' }}>{l.name}</span>
                                  <span className="atl-pop-state" data-state={isIn ? 'all' : 'none'}>{isIn ? PI.check : null}</span>
                                </button>
                              );
                            })}
                            <div className="atl-pop-divider"/>
                            <button className="atl-pop-row" onClick={() => { setShowAddTo(false); setView('collections'); }}>{PI.plus}<span style={{ flex: 1, textAlign: 'left' }}>New collection…</span></button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="atl-insp-divider"/>
                  <MetadataSection blob={active} showToast={showToast} readonly={readonly} readonlyToast={readonlyToast}/>
                  <div className="atl-insp-divider"/>
                  <div className="atl-section-h" style={{ margin: '0 0 6px' }}>SHA-256</div>
                  <button className="atl-insp-hash" style={{ width: '100%', textAlign: 'left' }} onClick={() => copyText(active.hash, 'Hash')}>{active.hash}</button>
                  <div className="atl-insp-divider"/>
                  <div className="atl-section-h" style={{ margin: '0 0 6px' }}>Replicas</div>
                  {(active.replicas?.length ? active.replicas : [{ server: active.server, available: true }]).map((replica) => (
                    <div key={`${replica.server}-${replica.url || active.hash}`} className="atl-insp-server">
                      <span className="atl-dot" style={{ background: replica.available === false ? 'var(--adanger)' : 'var(--aok)' }}/>
                      <span style={{ flex: 1 }}>{replica.server}</span>
                      {replica.status && <span className="atl-tag">{replica.status}</span>}
                      {replica.server === active.server && <span className="atl-tag">Origin</span>}
                    </div>
                  ))}
                  {active.detailRefreshedAt && <div style={{ fontSize: 11, color: 'var(--aink-faint)', marginTop: 6 }}>Refreshed {new Date(active.detailRefreshedAt).toLocaleString()}</div>}
                  <button className="atl-btn" disabled={readonly} onClick={() => mirrorLocalBlobs([active.hash])} style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>{PI.copy}<span>Mirror to all</span></button>
                </>
              )}
            </aside>
          </div>
        )}

        {view === 'upload' && <AtelierUpload session={session} profile={profile} blobs={blobs} setBlobs={setBlobs} dragOver={dragOver} setDragOver={setDragOver} servers={servers} uploadJobs={uploadJobs} setUploadJobs={setUploadJobs} settings={settings} showToast={showToast} readonly={readonly} readonlyToast={readonlyToast}/>}
        {view === 'collections' && <AtelierCollections session={session} profile={profile} servers={servers} lists={lists} setLists={setLists} blobs={blobs} onOpen={(id) => { setActiveList(id); setView('library'); }} showToast={showToast} readonly={readonly} readonlyToast={readonlyToast}/>}
        {view === 'profile' && <AtelierProfile session={session} profile={profile} setProfile={setProfile} servers={servers} blobs={blobs} setBlobs={setBlobs} uploadJobs={uploadJobs} setUploadJobs={setUploadJobs} settings={settings} showToast={showToast} readonly={readonly} readonlyToast={readonlyToast}/>}
        {view === 'servers' && <AtelierServers session={session} profile={profile} servers={servers} setServers={setServers} serverPreferenceEvent={serverPreferenceEvent} setServerPreferenceEvent={setServerPreferenceEvent} blobs={blobs} showToast={showToast} readonly={readonly} readonlyToast={readonlyToast}/>}
        {view === 'relays' && <AtelierRelays session={session} profile={profile} relays={relays} setRelays={setRelays} relayListEvent={relayListEvent} setRelayListEvent={setRelayListEvent} showToast={showToast} readonly={readonly} readonlyToast={readonlyToast}/>}
        {view === 'settings' && <AtelierSettings session={session} profile={profile} settings={settings} setSettings={setSettings} servers={servers} serverPreferenceEvent={serverPreferenceEvent} relays={relays} relayListEvent={relayListEvent} blobs={blobs} lists={lists} uploadJobs={uploadJobs} readonly={readonly} readonlyToast={readonlyToast} onLogout={handleLogout} onReset={resetLocalState} onRestore={restoreSnapshot} showToast={showToast}/>}
      </div>

      {toast && <div className="atl-toast" role="status" aria-live="polite">{PI.check}<span>{toast}</span></div>}
    </div>
  );
}

function LibrarySkeleton() {
  return (
    <div className="atl-browse" aria-busy="true" aria-label="Loading Blossom blobs">
      <div className="atl-skel-grid">
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index}>
            <div className="atl-skel-tile"/>
            <div className="atl-skel-line" style={{ width: `${55 + (index % 4) * 10}%` }}/>
          </div>
        ))}
      </div>
    </div>
  );
}

function BrowseGrid({ filtered, totalCount, activeIdx, setActiveIdx, selected, setSelected, gridSize, onLoadMore, onOpenFocus }) {
  const groups = React.useMemo(() => {
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(now); monthAgo.setDate(monthAgo.getDate() - 30);
    const buckets = new Map();
    const order = [];
    const push = (key, b, i) => {
      if (!buckets.has(key)) { buckets.set(key, []); order.push(key); }
      buckets.get(key).push({ b, i });
    };
    filtered.forEach((b, i) => {
      const d = new Date(b.uploaded);
      if (d.toISOString().slice(0, 10) === todayKey) return push('Today', b, i);
      if (d > weekAgo) return push('This week', b, i);
      if (d > monthAgo) return push('Earlier this month', b, i);
      const ym = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      push(ym, b, i);
    });
    return order.map(k => ({ key: k, items: buckets.get(k) }));
  }, [filtered]);
  const toggleSel = (hash) => {
    const n = new Set(selected);
    n.has(hash) ? n.delete(hash) : n.add(hash);
    setSelected(n);
  };
  if (filtered.length === 0) {
    return <div className="atl-browse"><div className="atl-grid"><div className="atl-gtile-empty">No blobs match these filters.</div></div></div>;
  }
  return (
    <div className="atl-browse">
      {groups.map(g => (
        <React.Fragment key={g.key}>
          <div className="atl-grid-section-h">
            <span>{g.key}</span>
            <span className="ct">{g.items.length}</span>
          </div>
          <div className={`atl-grid ${gridSize}`}>
            {g.items.map(({ b, i }) => {
              const k = ATELIER_FORMAT.kindOf(b);
              const isImg = k === 'image' || k === 'video';
              const sizeText = ATELIER_FORMAT.fmtBytes(b.size);
              return (
                <div
                  key={b.hash}
                  className={`atl-gtile ${k === 'video' ? 'video' : ''} ${i === activeIdx ? 'active' : ''} ${selected.has(b.hash) ? 'selected' : ''}`}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey) { toggleSel(b.hash); return; }
                    setActiveIdx(i);
                  }}
                  onDoubleClick={() => onOpenFocus(i)}
                  title={b.name}>
                  {isImg
                    ? <img src={b.thumb || b.url} alt="" loading="lazy"/>
                    : <div className="gtile-ico">{k === 'audio' ? PI.audio : k === 'pdf' ? PI.pdf : PI.file}</div>}
                  <button className="gtile-check" onClick={(e) => { e.stopPropagation(); toggleSel(b.hash); }}>{PI.check}</button>
                  {k === 'video' && <span className="gtile-badge">{ATELIER_FORMAT.fmtDur(b.duration)}</span>}
                  {k === 'audio' && <span className="gtile-badge">{ATELIER_FORMAT.fmtDur(b.duration)}</span>}
                  {k === 'pdf' && b.pages && <span className="gtile-badge">{b.pages}p</span>}
                  <div className="gtile-name">
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</div>
                    <div className="gtile-meta">{sizeText}{b.w ? ` · ${b.w}×${b.h}` : ''}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </React.Fragment>
      ))}
      {filtered.length < totalCount && (
        <div className="atl-loadmore">
          <button className="atl-btn" onClick={onLoadMore}>Load more ({totalCount - filtered.length} remaining)</button>
        </div>
      )}
    </div>
  );
}

function MetadataSection({ blob, showToast, readonly, readonlyToast }) {
  const [stripped, setStripped] = React.useState(false);
  const exif = React.useMemo(() => blob.metadata || null, [blob.hash, blob.metadata]);
  const isImage = blob.type && blob.type.startsWith('image/');
  if (!isImage) {
    return (
      <>
        <div className="atl-section-h" style={{ margin: '0 0 6px' }}>Metadata</div>
        <div className="atl-meta-empty">Metadata view is available for images.</div>
      </>
    );
  }
  if (!exif) return null;
  const cam = exif.camera;
  const expSummary = cam ? `${exif.shutter}s · f/${exif.aperture} · ISO ${exif.iso}` : null;
  return (
    <>
      <div className="atl-meta-head" style={{ marginBottom: 6 }}>
        <div className="atl-section-h" style={{ margin: 0 }}>Metadata</div>
        <div style={{ flex: 1 }}/>
        {stripped
          ? <span className="atl-meta-head pill ok" style={{ padding: '1.5px 5px' }}>Cleaned</span>
          : exif.sensitive
            ? <span className="atl-meta-head pill warn" style={{ padding: '1.5px 5px' }}>Contains GPS</span>
            : <span className="atl-meta-head pill ok" style={{ padding: '1.5px 5px' }}>{ATELIER_FORMAT.fmtBytes(exif.bytes)}</span>}
      </div>

      {stripped ? (
        <div className="atl-meta-empty">All EXIF, GPS and XMP segments removed. New blob hash will be assigned on re-upload.</div>
      ) : (
        <>
          {exif.sensitive && (
            <div className="atl-meta-warn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
              <span>This image embeds GPS coordinates. Anyone with the URL can read where it was taken.</span>
            </div>
          )}
          {cam && (
            <>
              <dl className="atl-meta-grid"><dt>Camera</dt><dd>{cam.make} {cam.model}</dd></dl>
              <dl className="atl-meta-grid"><dt>Lens</dt><dd>{cam.lens}</dd></dl>
              <dl className="atl-meta-grid"><dt>Exposure</dt><dd>{expSummary}</dd></dl>
              <dl className="atl-meta-grid"><dt>Focal</dt><dd>{exif.focal}mm</dd></dl>
              <dl className="atl-meta-grid"><dt>Taken</dt><dd>{new Date(exif.taken).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</dd></dl>
            </>
          )}
          {exif.software && <dl className="atl-meta-grid"><dt>Software</dt><dd>{exif.software}</dd></dl>}
          {exif.colorSpace && <dl className="atl-meta-grid"><dt>Color</dt><dd>{exif.colorSpace}</dd></dl>}
          {exif.bytes != null && <dl className="atl-meta-grid"><dt>Metadata</dt><dd>{ATELIER_FORMAT.fmtBytes(exif.bytes)}</dd></dl>}
          {exif.gps && (
            <>
              <dl className="atl-meta-grid"><dt>Location</dt><dd>{exif.gps.label}</dd></dl>
              <div className="atl-gps-map" title={exif.gps.label}>
                <span className="atl-gps-coord">{exif.gps.lat.toFixed(4)}°, {exif.gps.lng.toFixed(4)}°</span>
              </div>
            </>
          )}
          <div className="atl-meta-sections">
            {exif.sections.map(s => <span key={s} className="sec">{s}</span>)}
          </div>
        </>
      )}

      <button
        className="atl-btn"
        disabled={readonly}
        style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
        onClick={() => {
          if (readonly) return readonlyToast();
          setStripped(s => !s);
          showToast(stripped ? 'Metadata view restored' : 'Metadata strip preview enabled');
        }}>
        {PI.shield}<span>{stripped ? 'Undo strip' : 'Strip & re-upload'}</span>
      </button>
    </>
  );
}

function AtelierUpload({ session, profile, blobs, setBlobs, dragOver, setDragOver, servers, uploadJobs, setUploadJobs, settings, showToast, readonly, readonlyToast }) {
  const [stripDefault, setStripDefault] = React.useState(settings.autoOptimize);
  const inputRef = React.useRef(null);
  const fileRefs = React.useRef(new Map());
  const cancelled = React.useRef(new Set());
  const activeServers = servers.filter(s => s.status !== 'offline');
  const primary = activeServers.find(s => s.primary) || activeServers[0];
  const mirrorTargets = settings.mirror ? activeServers.filter(s => s.url !== primary?.url && s.capabilities?.mirror !== false) : [];
  const toggleStrip = (i) => {
    if (readonly) return readonlyToast();
    setUploadJobs(prev => prev.map((u, j) => j === i ? { ...u, strip: !u.strip } : u));
  };
  const patchJob = (id, patch) => setUploadJobs(prev => prev.map(job => job.id === id ? { ...job, ...patch } : job));
  const appendBlob = (blob) => {
    setBlobs(prev => {
      const without = prev.filter(item => item.hash !== blob.hash);
      return [blob, ...without];
    });
  };
  const signEvent = async (event) => {
    if (session.mode === 'nip07' && window.nostr?.signEvent) return window.nostr.signEvent(event);
    return null;
  };
  const handleFiles = async (fileList) => {
    if (readonly) return readonlyToast();
    if (!primary) {
      showToast('Add an online Blossom server before uploading.');
      return;
    }
    const files = Array.from(fileList || []);
    for (const file of files) {
      const job = createUploadJob(file, { strip: stripDefault && file.type.startsWith('image/') });
      cancelled.current.delete(job.id);
      setUploadJobs(prev => [job, ...prev]);
      try {
        validateUploadFile(file);
        patchJob(job.id, { state: 'hashing', progress: 4 });
        const metadata = await inspectImageMetadata(file);
        const shouldStrip = job.strip && file.type.startsWith('image/');
        if (settings.requireCleanImages && metadata.sensitive && !shouldStrip) {
          patchJob(job.id, { state: 'failed', progress: 100, metadata, error: 'Image contains sensitive metadata. Enable stripping or change the privacy policy.' });
          continue;
        }
        const prepared = shouldStrip ? await stripImageMetadata(file) : { file, strippedBytes: 0, changed: false };
        const uploadFile = prepared.file;
        fileRefs.current.set(job.id, uploadFile);
        patchJob(job.id, {
          metadata,
          stripBytes: prepared.strippedBytes || undefined,
          size: uploadFile.size,
          progress: 8,
        });
        const hash = await sha256File(uploadFile);
        if (cancelled.current.has(job.id)) {
          patchJob(job.id, { state: 'cancelled', progress: 100, error: 'Cancelled' });
          continue;
        }
        if (blobs.some(blob => blob.hash === hash)) {
          patchJob(job.id, { hash, state: 'failed', progress: 100, error: 'Duplicate blob already exists in the library.' });
          continue;
        }
        patchJob(job.id, { hash, state: 'uploading', progress: 18 });
        const result = await uploadAndMirrorFile({
          file: uploadFile,
          hash,
          server: primary,
          mirrors: mirrorTargets,
          pubkey: session.pubkey || profile.pubkey,
          signEvent,
        });
        const successfulMirrors = result.mirrorResults.filter(item => item.status === 'fulfilled').length;
        const failedMirrors = result.mirrorResults.filter(item => item.status === 'rejected');
        appendBlob({ ...result.blob, metadata: prepared.changed ? { present: false, sensitive: false, bytes: 0, sections: [], type: metadata.type } : metadata });
        patchJob(job.id, {
          state: failedMirrors.length ? 'done' : 'done',
          progress: 100,
          hash,
          serverResults: [
            { server: primary.name, state: 'done' },
            ...result.mirrorResults.map((item, index) => item.status === 'fulfilled'
              ? { server: mirrorTargets[index].name, state: 'done' }
              : { server: mirrorTargets[index].name, state: 'failed', error: item.reason?.message || 'Mirror failed' }),
          ],
        });
        showToast(`Uploaded ${file.name}${successfulMirrors ? ` · mirrored to ${successfulMirrors}` : ''}`);
      } catch (error) {
        patchJob(job.id, { state: 'failed', progress: 100, error: error.message || 'Upload failed' });
      }
    }
  };
  const cancelJob = (id) => {
    cancelled.current.add(id);
    patchJob(id, { state: 'cancelled', progress: 100, error: 'Cancelled' });
  };
  const retryJob = (job) => {
    const file = fileRefs.current.get(job.id);
    if (!file) {
      showToast('Select the file again to retry.');
      return;
    }
    setUploadJobs(prev => prev.filter(item => item.id !== job.id));
    handleFiles([file]);
  };
  const canStrip = (t) => t.startsWith('image/');
  const stripCount = uploadJobs.filter(u => u.strip && canStrip(u.type)).length;
  const stripEligible = uploadJobs.filter(u => canStrip(u.type)).length;
  return (
    <div className="atl-view">
      <div className="atl-pagehead">
        <div><div className="atl-pagetitle">Upload</div><div className="atl-pagesub">Blobs are addressed by sha256 and replicated across active servers.</div></div>
      </div>
      <div className={`atl-drop ${dragOver ? 'over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); if (!readonly) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (readonly) return readonlyToast(); handleFiles(e.dataTransfer.files); }}>
        <div style={{ width: 44, height: 44, margin: '0 auto 12px', borderRadius: 10, background: 'var(--aaccent-tint)', color: 'var(--aaccent-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{PI.upload}</div>
        <div className="atl-drop-title">Drop files here, or click to browse</div>
        <div className="atl-drop-sub">Up to 100 MB per blob · Primary: {primary?.name || 'none'} · {mirrorTargets.length} mirror targets</div>
        <input ref={inputRef} type="file" multiple style={{ display: 'none' }} onChange={(event) => { handleFiles(event.target.files); event.target.value = ''; }}/>
        <button className="atl-btn primary" disabled={readonly} onClick={readonly ? readonlyToast : () => inputRef.current?.click()}>{PI.upload}<span>Choose files</span></button>
      </div>
      <div className="atl-strip-banner">
        <button
          type="button"
          className={`atl-switch ${stripDefault ? 'on' : ''}`}
          role="switch"
          aria-checked={stripDefault}
          aria-label="Strip metadata before upload"
          onClick={() => { if (readonly) return readonlyToast(); setStripDefault(v => !v); setUploadJobs(prev => prev.map(u => canStrip(u.type) ? { ...u, strip: !stripDefault } : u)); }}
        />
        <div style={{ flex: 1 }}>
          <div className="lab">Strip metadata before upload</div>
          <div className="sub">Removes EXIF, GPS, IPTC and XMP from images client-side. Blob hash changes after stripping. Default for new images.</div>
        </div>
        <span className="atl-strip-tag on" style={{ background: 'var(--aline-2)', color: 'var(--aink-soft)' }}>{stripCount}/{stripEligible} images</span>
      </div>
      <div className="atl-tablecard" style={{ marginTop: 14 }}>
        <div className="atl-upload-row" style={{ background: 'var(--apanel-2)', fontWeight: 600, color: 'var(--aink-faint)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          <span/><span>File</span><span>Progress</span><span style={{ textAlign: 'center' }}>Strip</span><span style={{ textAlign: 'right' }}>Size</span><span style={{ textAlign: 'right' }}>Status</span><span style={{ textAlign: 'right' }}>Action</span>
        </div>
        {uploadJobs.map((u, i) => {
          const k = u.type.startsWith('image/') ? PI.library : u.type.startsWith('video/') ? PI.play : u.type.startsWith('audio/') ? PI.audio : PI.file;
          const eligible = canStrip(u.type);
          const stripped = u.strip && eligible;
          return (
            <div key={i} className="atl-upload-row">
              <div className="ico">{k}</div>
              <div>
                <div style={{ fontWeight: 500 }}>{u.name}</div>
                <div style={{ fontSize: 11, color: 'var(--aink-faint)' }}>
                  {u.type}
                  {u.metadata?.present && <span style={{ color: u.metadata.sensitive ? '#b07410' : 'var(--aink-faint)', marginLeft: 6 }}>· metadata {ATELIER_FORMAT.fmtBytes(u.metadata.bytes)}</span>}
                  {u.metadata?.sensitive && <span style={{ color: '#b07410', marginLeft: 6 }}>· sensitive</span>}
                  {stripped && u.state === 'done' && u.stripBytes && <span style={{ color: 'var(--aaccent-deep)', marginLeft: 6 }}>· stripped {ATELIER_FORMAT.fmtBytes(u.stripBytes)}</span>}
                  {stripped && u.state !== 'done' && <span style={{ color: 'var(--aaccent-deep)', marginLeft: 6 }}>· will strip metadata</span>}
                </div>
              </div>
              <div>
                {u.state === 'uploading' || u.state === 'hashing' ? <div className="atl-upload-bar"><div className="atl-upload-fill" style={{ width: `${u.progress}%` }}/></div> : u.state === 'queued' ? <span style={{ color: 'var(--aink-faint)' }}>Queued</span> : u.state === 'failed' ? <span style={{ color: 'var(--adanger)', fontWeight: 600 }}>Failed</span> : <span style={{ color: 'var(--aok)', fontWeight: 600 }}>✓ Stored × {Math.max(1, u.serverResults?.filter(r => r.state === 'done').length || 1)}</span>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                {eligible
                  ? <button type="button" className={`atl-switch sm ${u.strip ? 'on' : ''}`} role="switch" aria-checked={u.strip} aria-label={`${u.strip ? 'Disable' : 'Enable'} metadata stripping for ${u.name}`} onClick={() => toggleStrip(i)} title={u.strip ? 'Will strip metadata' : 'Will keep metadata'}/>
                  : <span style={{ fontSize: 10, color: 'var(--aink-faint)' }}>—</span>}
              </div>
              <div style={{ textAlign: 'right', color: 'var(--aink-soft)', fontVariantNumeric: 'tabular-nums' }}>{ATELIER_FORMAT.fmtBytes(u.size)}</div>
              <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: u.state === 'done' ? 'var(--aok)' : u.state === 'failed' ? 'var(--adanger)' : 'var(--aink-soft)' }}>{u.state === 'uploading' || u.state === 'hashing' ? `${Math.round(u.progress)}%` : u.state === 'done' ? 'Done' : u.state === 'failed' ? (u.error || 'Failed') : '—'}</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                {['hashing', 'queued', 'uploading'].includes(u.state)
                  ? <button className="atl-iconbtn-mini" title="Cancel" onClick={() => cancelJob(u.id)}>{PI.close}</button>
                  : u.state === 'failed'
                    ? <button className="atl-iconbtn-mini" title="Retry" onClick={() => retryJob(u)}>{PI.refresh}</button>
                    : <span style={{ color: 'var(--aink-faint)', fontSize: 11 }}>—</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AtelierProfile({ session, profile, setProfile, servers, blobs, setBlobs, uploadJobs, setUploadJobs, settings, showToast, readonly, readonlyToast }) {
  const [eventText, setEventText] = React.useState(() => profile.profileEvent ? JSON.stringify(profile.profileEvent, null, 2) : '');
  const [eventError, setEventError] = React.useState('');
  const [checkingNip05, setCheckingNip05] = React.useState(false);
  const [uploadingMedia, setUploadingMedia] = React.useState(null);
  const avatarInputRef = React.useRef(null);
  const bannerInputRef = React.useRef(null);
  const activeServers = servers.filter(s => s.status !== 'offline');
  const primary = activeServers.find(s => s.primary) || activeServers[0];
  const fieldErrors = React.useMemo(() => validateProfileFields(profile), [profile]);
  const errorCount = Object.keys(fieldErrors).length;
  const eventPubkey = session.pubkey || (/^[0-9a-f]{64}$/i.test(profile.pubkey) ? profile.pubkey : `${'0'.repeat(63)}1`);
  const profileUpdated = profile.profileUpdatedAt ? new Date(profile.profileUpdatedAt * 1000).toLocaleString() : null;

  const set = (k, v) => {
    if (readonly) return readonlyToast();
    setProfile(p => ({ ...p, [k]: v, nip05Verified: k === 'nip05' ? false : p.nip05Verified }));
  };
  const patchJob = (id, patch) => setUploadJobs(prev => prev.map(job => job.id === id ? { ...job, ...patch } : job));
  const appendBlob = (blob) => {
    setBlobs(prev => [blob, ...prev.filter(item => item.hash !== blob.hash)]);
  };
  const signEvent = async (event) => {
    if (session.mode === 'nip07' && window.nostr?.signEvent) return window.nostr.signEvent(event);
    return null;
  };
  const publishProfile = async () => {
    if (readonly) return readonlyToast();
    if (errorCount) {
      showToast('Fix profile field errors before publishing.');
      return;
    }
    try {
      const draft = createProfileEvent(profile, eventPubkey);
      const signed = await signEvent(draft);
      const event = signed || draft;
      setProfile(p => ({
        ...p,
        profileEvent: event,
        profileUpdatedAt: event.created_at,
        profilePublishedAt: new Date().toISOString(),
      }));
      setEventText(JSON.stringify(event, null, 2));
      showToast(signed ? 'Profile metadata signed' : 'Profile metadata event drafted');
    } catch (error) {
      showToast(error.message || 'Unable to create profile event.');
    }
  };
  const applyEvent = () => {
    try {
      const nextProfile = parseProfileEvent(eventText, profile);
      setProfile(nextProfile);
      setEventError('');
      showToast('Kind 0 metadata loaded');
    } catch (error) {
      setEventError(error.message || 'Invalid profile event.');
    }
  };
  const checkNip05 = async () => {
    setCheckingNip05(true);
    try {
      const ok = await verifyNip05(profile, eventPubkey);
      setProfile(p => ({ ...p, nip05Verified: ok }));
      showToast(ok ? 'NIP-05 matched this public key' : 'NIP-05 did not match this public key');
    } catch (error) {
      showToast(error.message || 'Unable to verify NIP-05');
    } finally {
      setCheckingNip05(false);
    }
  };
  const uploadProfileImage = async (file, field) => {
    if (readonly) return readonlyToast();
    if (!primary) {
      showToast('Add an online Blossom server before uploading profile media.');
      return;
    }
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Choose an image file for profile media.');
      return;
    }
    const job = createUploadJob(file, { strip: settings.autoOptimize });
    setUploadJobs(prev => [job, ...prev]);
    setUploadingMedia(field);
    try {
      validateUploadFile(file, { maxBytes: 15 * 1024 * 1024 });
      const prepared = settings.autoOptimize ? await stripImageMetadata(file) : { file, changed: false, strippedBytes: 0 };
      const uploadFile = prepared.file;
      patchJob(job.id, { state: 'hashing', progress: 8, size: uploadFile.size, stripBytes: prepared.strippedBytes || undefined });
      const hash = await sha256File(uploadFile);
      patchJob(job.id, { hash, state: 'uploading', progress: 30 });
      const result = await uploadAndMirrorFile({
        file: uploadFile,
        hash,
        server: primary,
        mirrors: [],
        pubkey: eventPubkey,
        signEvent,
      });
      appendBlob(result.blob);
      setProfile(p => ({ ...p, [field]: result.blob.url }));
      patchJob(job.id, { state: 'done', progress: 100, hash, serverResults: [{ server: primary.name, state: 'done' }] });
      showToast(`${field === 'picture' ? 'Avatar' : 'Banner'} uploaded`);
    } catch (error) {
      patchJob(job.id, { state: 'failed', progress: 100, error: error.message || 'Upload failed' });
      showToast(error.message || 'Upload failed');
    } finally {
      setUploadingMedia(null);
    }
  };
  return (
    <div className="atl-view">
      <div className="atl-pagehead">
        <div><div className="atl-pagetitle">Profile</div><div className="atl-pagesub">Published as kind 0 metadata. Live preview reflects your changes.</div></div>
        <button className="atl-btn accent" disabled={readonly || errorCount > 0} onClick={publishProfile}>Publish to relays</button>
      </div>
      <div className="atl-prof-grid">
        <div>
          <div className="atl-prof-preview">
            <div className="atl-prof-banner" style={profile.banner ? { backgroundImage: `url(${profile.banner})` } : { background: 'var(--aline-2)' }}/>
            {profile.picture
              ? <img src={profile.picture} className="atl-prof-av" alt=""/>
              : <div className="atl-prof-av" style={{ background: 'var(--apanel-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--aink-faint)' }}>{PI.user}</div>}
            <div className="atl-prof-name">{profile.display_name}</div>
            <div className="atl-prof-nip05">{profile.nip05}{profile.nip05Verified ? ' ✓' : ''}</div>
            <div className="atl-prof-about">{profile.about}</div>
            <div className="atl-prof-stats">
              <div className="atl-prof-stat"><b>{profile.followers.toLocaleString()}</b>followers</div>
              <div className="atl-prof-stat"><b>{profile.following}</b>following</div>
              <div className="atl-prof-stat"><b>{profile.notes.toLocaleString()}</b>notes</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--aink-faint)', textAlign: 'center', marginTop: 10 }}>Live preview</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
            <input ref={avatarInputRef} aria-label="Avatar image" type="file" accept="image/*" style={{ display: 'none' }} onChange={(event) => { uploadProfileImage(event.target.files?.[0], 'picture'); event.target.value = ''; }}/>
            <input ref={bannerInputRef} aria-label="Banner image" type="file" accept="image/*" style={{ display: 'none' }} onChange={(event) => { uploadProfileImage(event.target.files?.[0], 'banner'); event.target.value = ''; }}/>
            <button className="atl-btn" disabled={readonly || uploadingMedia === 'picture'} title="Upload avatar" onClick={() => readonly ? readonlyToast() : avatarInputRef.current?.click()}>{PI.upload}<span>{uploadingMedia === 'picture' ? 'Uploading…' : 'Avatar'}</span></button>
            <button className="atl-btn" disabled={readonly || uploadingMedia === 'banner'} title="Upload banner" onClick={() => readonly ? readonlyToast() : bannerInputRef.current?.click()}>{PI.upload}<span>{uploadingMedia === 'banner' ? 'Uploading…' : 'Banner'}</span></button>
          </div>
        </div>
        <div className="atl-formgrid">
          <div className="atl-field"><label>Display name</label><input className="atl-input" aria-label="Display name" disabled={readonly} value={profile.display_name} onChange={e => set('display_name', e.target.value)}/></div>
          <div className="atl-field"><label>Username (slug)</label><input className="atl-input" aria-label="Username (slug)" disabled={readonly} value={profile.name} onChange={e => set('name', e.target.value)}/>{fieldErrors.name && <span className="atl-fieldhelp" role="alert" style={{ color: 'var(--adanger)' }}>{fieldErrors.name}</span>}</div>
          <div className="atl-field"><label>About</label><textarea className="atl-textarea" aria-label="About" disabled={readonly} value={profile.about} onChange={e => set('about', e.target.value)}/><span className="atl-fieldhelp" style={{ color: fieldErrors.about ? 'var(--adanger)' : 'var(--aink-faint)' }}>{fieldErrors.about || `${profile.about.length} / 500`}</span></div>
          <div className="atl-field">
            <label>NIP-05</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="atl-input" aria-label="NIP-05" disabled={readonly} value={profile.nip05} onChange={e => set('nip05', e.target.value)}/>
              <button className="atl-btn" disabled={checkingNip05 || Boolean(fieldErrors.nip05) || !profile.nip05} onClick={checkNip05}>{checkingNip05 ? 'Checking…' : 'Verify'}</button>
            </div>
            <span className="atl-fieldhelp" style={{ color: fieldErrors.nip05 ? 'var(--adanger)' : profile.nip05Verified ? 'var(--aok)' : 'var(--aink-faint)' }}>{fieldErrors.nip05 || (profile.nip05Verified ? 'Verified against this public key.' : 'Not verified yet.')}</span>
          </div>
          <div className="atl-field"><label>Lightning address</label><input className="atl-input" aria-label="Lightning address" disabled={readonly} value={profile.lud16} onChange={e => set('lud16', e.target.value)}/>{fieldErrors.lud16 && <span className="atl-fieldhelp" role="alert" style={{ color: 'var(--adanger)' }}>{fieldErrors.lud16}</span>}</div>
          <div className="atl-field"><label>Website</label><input className="atl-input" aria-label="Website" disabled={readonly} value={profile.website} onChange={e => set('website', e.target.value)}/>{fieldErrors.website && <span className="atl-fieldhelp" role="alert" style={{ color: 'var(--adanger)' }}>{fieldErrors.website}</span>}</div>
          <div className="atl-field"><label>Avatar URL</label><input className="atl-input" aria-label="Avatar URL" disabled={readonly} value={profile.picture} onChange={e => set('picture', e.target.value)}/>{fieldErrors.picture && <span className="atl-fieldhelp" role="alert" style={{ color: 'var(--adanger)' }}>{fieldErrors.picture}</span>}</div>
          <div className="atl-field"><label>Banner URL</label><input className="atl-input" aria-label="Banner URL" disabled={readonly} value={profile.banner} onChange={e => set('banner', e.target.value)}/>{fieldErrors.banner && <span className="atl-fieldhelp" role="alert" style={{ color: 'var(--adanger)' }}>{fieldErrors.banner}</span>}</div>
          <div className="atl-field"><label>Public key (npub)</label><div className="atl-insp-hash">{profile.pubkey}</div></div>
          <div className="atl-tablecard" style={{ padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ fontWeight: 600, flex: 1 }}>Kind 0 metadata event</div>
              <button className="atl-btn" onClick={() => setEventText(profile.profileEvent ? JSON.stringify(profile.profileEvent, null, 2) : JSON.stringify(createProfileEvent(profile, eventPubkey), null, 2))}>{PI.copy}<span>Fill</span></button>
              <button className="atl-btn primary" onClick={applyEvent}>{PI.check}<span>Apply event</span></button>
            </div>
            <textarea className="atl-textarea" style={{ minHeight: 118, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11 }} value={eventText} onChange={e => setEventText(e.target.value)} placeholder='Paste a Nostr kind 0 event JSON here.'/>
            {eventError && <div className="atl-fieldhelp" role="alert" style={{ color: 'var(--adanger)', marginTop: 6 }}>{eventError}</div>}
            <div className="atl-fieldhelp" style={{ marginTop: 6 }}>{profileUpdated ? `Loaded metadata updated ${profileUpdated}.` : 'No remote profile event loaded yet.'}</div>
          </div>
          {uploadJobs.some(job => job.name && ['uploading', 'hashing'].includes(job.state)) && <div className="atl-fieldhelp">Profile uploads share the global upload queue.</div>}
        </div>
      </div>
    </div>
  );
}

function AtelierServers({ session, profile, servers, setServers, serverPreferenceEvent, setServerPreferenceEvent, blobs, showToast, readonly, readonlyToast }) {
  const [adding, setAdding] = React.useState(false);
  const [newUrl, setNewUrl] = React.useState('');
  const [newUrlError, setNewUrlError] = React.useState('');
  const [checking, setChecking] = React.useState(new Set());
  const [eventText, setEventText] = React.useState(() => serverPreferenceEvent ? JSON.stringify(serverPreferenceEvent, null, 2) : '');
  const [eventError, setEventError] = React.useState('');

  React.useEffect(() => {
    if (serverPreferenceEvent) setEventText(JSON.stringify(serverPreferenceEvent, null, 2));
  }, [serverPreferenceEvent]);

  const move = (url, dir) => {
    setServers(prev => moveServerRecord(prev, url, dir));
  };
  const setPrimary = (url) => {
    setServers(prev => markPrimaryServer(prev, url));
    showToast('Primary set');
  };
  const remove = (url) => {
    try {
      setServers(p => removeServerRecord(p, url));
      showToast('Server removed');
    } catch (error) {
      showToast(error.message || 'Unable to remove server');
    }
  };
  const addServer = () => {
    if (!newUrl.trim()) return;
    try {
      setServers(p => addServerRecord(p, newUrl));
      setNewUrl('');
      setNewUrlError('');
      setAdding(false);
      showToast('Server added');
    } catch (error) {
      setNewUrlError(error.message || 'Unable to add server.');
    }
  };
  const checkServer = async (url) => {
    setChecking(prev => new Set(prev).add(url));
    try {
      const target = servers.find(s => s.url === url);
      if (!target) return;
      const checked = await inspectBlossomServer(target);
      setServers(prev => prev.map(s => s.url === url ? checked : s));
      showToast(`${target.name} checked`);
    } catch (error) {
      showToast(error.message || 'Health check failed');
    } finally {
      setChecking(prev => {
        const next = new Set(prev);
        next.delete(url);
        return next;
      });
    }
  };
  const checkAllServers = async () => {
    if (servers.length === 0) return;
    setChecking(new Set(servers.map(s => s.url)));
    const checked = await Promise.all(servers.map(server => inspectBlossomServer(server)));
    setServers(checked);
    setChecking(new Set());
    showToast('Server health updated');
  };
  const publishServerList = async () => {
    if (readonly) return readonlyToast();
    if (servers.length === 0) {
      showToast('Add at least one Blossom server before publishing.');
      return;
    }
    const pubkey = session.pubkey || profile.pubkey;
    const event = createServerPreferenceEvent(servers, pubkey);
    let nextEvent = event;
    if (session.mode === 'nip07' && window.nostr?.signEvent) {
      nextEvent = await window.nostr.signEvent(event);
    }
    setServerPreferenceEvent(nextEvent);
    setEventText(JSON.stringify(nextEvent, null, 2));
    setEventError('');
    showToast(nextEvent.sig ? 'Server list signed' : 'Server list event drafted');
  };
  const applyServerListEvent = () => {
    try {
      const nextServers = parseServerPreferenceEvent(eventText);
      setServers(nextServers);
      setServerPreferenceEvent(JSON.parse(eventText));
      setEventError('');
      showToast('Server list applied');
    } catch (error) {
      setEventError(error.message || 'Unable to parse server list event.');
    }
  };

  const totalUsed = servers.reduce((s, x) => s + x.used, 0);
  const totalQuota = servers.reduce((s, x) => s + x.quota, 0);
  const onlineCount = servers.filter(s => s.status === 'online').length;
  const avgLatency = Math.round(servers.reduce((s, x) => s + x.latency, 0) / Math.max(1, servers.length));
  const mirrorCount = servers.filter(s => s.capabilities?.mirror).length;
  const mediaCount = servers.filter(s => s.capabilities?.media).length;
  const uploadCount = servers.filter(s => s.capabilities?.upload).length;
  const lastCheckedAt = servers.map(s => s.lastCheckedAt).filter(Boolean).sort().at(-1);

  const replicaCounts = servers.map((s) => {
    return blobs.filter((blob) => (blob.servers || [blob.server]).includes(s.name) || blob.replicas?.some((replica) => replica.server === s.name && replica.available !== false)).length;
  });

  return (
    <div className="atl-view">
      <div className="atl-pagehead">
        <div>
          <div className="atl-pagetitle">Servers</div>
          <div className="atl-pagesub">Storage providers, ranked. Published as a kind 10063 event so other clients can find your blobs. The first server is your primary for new uploads.</div>
        </div>
        <button className="atl-btn" disabled={checking.size > 0} onClick={checkAllServers}>{PI.refresh}<span>{checking.size > 0 ? 'Checking…' : 'Check all'}</span></button>
        <button className="atl-btn primary" onClick={() => setAdding(v => !v)}>{PI.plus}<span>Add server</span></button>
      </div>

      {/* Summary stats */}
      <div className="srv-stats">
        <div className="srv-stat">
          <div className="srv-stat-lab">Servers</div>
          <div className="srv-stat-val">{servers.length}<span className="srv-stat-sub">{onlineCount} online</span></div>
        </div>
        <div className="srv-stat">
          <div className="srv-stat-lab">Used / Quota</div>
          <div className="srv-stat-val">{ATELIER_FORMAT.fmtMB(totalUsed)}<span className="srv-stat-sub">of {ATELIER_FORMAT.fmtMB(totalQuota)}</span></div>
          <div className="srv-stat-bar"><div className="srv-stat-fill" style={{ width: (totalQuota > 0 ? Math.min(100, (totalUsed / totalQuota) * 100) : 0) + '%' }}/></div>
        </div>
        <div className="srv-stat">
          <div className="srv-stat-lab">Avg. latency</div>
          <div className="srv-stat-val">{avgLatency}<span className="srv-stat-sub">ms · across all</span></div>
        </div>
        <div className="srv-stat">
          <div className="srv-stat-lab">Capabilities</div>
          <div className="srv-stat-val">{uploadCount}/{servers.length}<span className="srv-stat-sub">upload · {mirrorCount} mirror · {mediaCount} media</span></div>
        </div>
      </div>

      {adding && (
        <div className="srv-add-panel">
          <div className="srv-add-head">
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Add a Blossom server</div>
              <div style={{ fontSize: 11.5, color: 'var(--aink-soft)', marginTop: 2 }}>Atelier will probe <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5 }}>GET /</code> for a BUD-01 descriptor, then republish your kind 10063 list.</div>
            </div>
            <button className="atl-iconbtn" onClick={() => setAdding(false)} title="Cancel">{PI.close}</button>
          </div>
          <div className="srv-add-form">
            <input className="atl-input" style={{ flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} value={newUrl} onChange={e => { setNewUrl(e.target.value); setNewUrlError(''); }} placeholder="https://your-blossom-server.example" autoFocus onKeyDown={e => { if (e.key === 'Enter') addServer(); }}/>
            <button className="atl-btn primary" disabled={!newUrl.trim()} onClick={addServer}>{PI.plus}<span>Add</span></button>
          </div>
          {newUrlError && <div className="atl-fieldhelp" role="alert" style={{ color: 'var(--adanger)', marginTop: 7 }}>{newUrlError}</div>}
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--aink-faint)' }}>Try:</span>
            {['https://blossom.primal.net', 'https://cdn.satellite.earth', 'https://blossom.band', 'https://nostr.download'].map(s => (
              <button key={s} className="srv-suggest" onClick={() => setNewUrl(s)}>{s.replace('https://', '')}</button>
            ))}
          </div>
        </div>
      )}

      <div className="atl-tablecard">
        <div className="atl-srv-row" style={{ background: 'var(--apanel-2)', fontWeight: 600, color: 'var(--aink-faint)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          <span/><span/><span>Server</span><span style={{ textAlign: 'right' }}>Storage</span><span style={{ textAlign: 'right' }}>Latency</span><span/><span/><span/>
        </div>
        {servers.map((s, i) => (
          <div key={s.url} className="atl-srv-row">
            <span className="grip" style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <button className="atl-iconbtn-mini" disabled={i === 0} onClick={() => move(s.url, -1)} title="Move up" style={{ opacity: i === 0 ? 0.3 : 1 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" width="9" height="9"><path d="M6 15l6-6 6 6"/></svg>
              </button>
              <button className="atl-iconbtn-mini" disabled={i === servers.length - 1} onClick={() => move(s.url, 1)} title="Move down" style={{ opacity: i === servers.length - 1 ? 0.3 : 1 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" width="9" height="9"><path d="M6 9l6 6 6-6"/></svg>
              </button>
            </span>
            <div className="ico">{PI.server}</div>
            <div>
              <div className="name">
                {s.name}
                {s.primary && <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: 'var(--aaccent-deep)', color: '#fff', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Primary</span>}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 400, color: s.status === 'online' ? 'var(--aok)' : '#b07410', whiteSpace: 'nowrap' }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }}/>{s.status}</span>
                <span style={{ fontSize: 10.5, color: 'var(--aink-faint)', fontWeight: 400, whiteSpace: 'nowrap' }}>· {replicaCounts[i]} / {blobs.length} blobs</span>
              </div>
              <div className="url">{s.url}</div>
              <div className="srv-caps">
                {['retrieve', 'upload', 'mirror', 'media'].map(cap => (
                  <span key={cap} className={`srv-cap ${s.capabilities?.[cap] ? 'on' : ''}`}>{cap}</span>
                ))}
                {s.capabilities?.requiresAuth && <span className="srv-cap warn">auth</span>}
                {s.lastReason && <span className="srv-reason">{s.lastReason}</span>}
              </div>
              <div className="srv-usebar"><div className="srv-usefill" style={{ width: Math.min(100, (s.used / s.quota) * 100) + '%' }}/></div>
            </div>
            <div className="meta" style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 600, color: 'var(--aink)' }}>{ATELIER_FORMAT.fmtMB(s.used)}</div>
              <div style={{ fontSize: 10.5, color: 'var(--aink-faint)' }}>of {ATELIER_FORMAT.fmtMB(s.quota)}</div>
            </div>
            <div className="meta" style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 600, color: s.latency < 100 ? 'var(--aok)' : s.latency < 300 ? 'var(--aink)' : '#b07410' }}>{s.latency}<span style={{ fontWeight: 400, color: 'var(--aink-faint)', fontSize: 10 }}> ms</span></div>
              {s.lastCheckedAt && <div style={{ fontSize: 10.5, color: 'var(--aink-faint)' }}>{new Date(s.lastCheckedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
            </div>
            <button className="atl-iconbtn" disabled={checking.has(s.url)} title="Check server" onClick={() => checkServer(s.url)}>{PI.refresh}</button>
            {i !== 0 ? (
              <button className="atl-iconbtn" title="Make primary" onClick={() => setPrimary(s.url)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><path d="M12 2l2.5 6.5L21 9l-5 4.5L17.5 21 12 17l-5.5 4L8 13.5 3 9l6.5-.5z"/></svg>
              </button>
            ) : <span/>}
            <button className="atl-iconbtn" style={{ color: 'var(--adanger)' }} disabled={servers.length <= 1} onClick={() => remove(s.url)} title={servers.length <= 1 ? 'Need at least one server' : 'Remove'}>{PI.trash}</button>
          </div>
        ))}
      </div>

      <div className="srv-foot">
        <div className="srv-foot-card">
          <div className="srv-foot-h">{PI.refresh}<span>kind 10063 · last published</span></div>
          <div className="srv-foot-v">{serverPreferenceEvent?.created_at ? new Date(serverPreferenceEvent.created_at * 1000).toLocaleString() : 'Not published'}</div>
          <div className="srv-foot-sub">BUD-03 server lists are replaceable kind 10063 events with ordered server tags.</div>
          <div className="srv-foot-actions">
            <button className="atl-btn" disabled={readonly} onClick={publishServerList}>{PI.upload}<span>Publish list</span></button>
          </div>
        </div>
        <div className="srv-foot-card">
          <div className="srv-foot-h">{PI.shield}<span>BUD-04 mirroring</span></div>
          <div className="srv-foot-v">{mirrorCount}/{servers.length} capable</div>
          <div className="srv-foot-sub">Mirroring uses PUT /mirror when a server advertises or allows the endpoint.</div>
        </div>
        <div className="srv-foot-card">
          <div className="srv-foot-h">{PI.refresh}<span>Health check</span></div>
          <div className="srv-foot-v">{onlineCount}/{servers.length} responding</div>
          <div className="srv-foot-sub">{lastCheckedAt ? `Last checked ${new Date(lastCheckedAt).toLocaleString()}.` : 'Run Check all to probe BUD endpoints.'}</div>
        </div>
      </div>
      <div className="srv-event-panel">
        <div className="srv-add-head">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Server list event</div>
            <div style={{ fontSize: 11.5, color: 'var(--aink-soft)', marginTop: 2 }}>Paste a kind 10063 event to read its server tags, or publish the current order above.</div>
          </div>
          <button className="atl-btn" onClick={() => setEventText(serverPreferenceEvent ? JSON.stringify(serverPreferenceEvent, null, 2) : JSON.stringify(createServerPreferenceEvent(servers, session.pubkey || profile.pubkey), null, 2))}>{PI.copy}<span>Fill</span></button>
        </div>
        <textarea className="atl-textarea" style={{ width: '100%', minHeight: 110, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11 }} value={eventText} onChange={e => { setEventText(e.target.value); setEventError(''); }}/>
        {eventError && <div className="atl-fieldhelp" role="alert" style={{ color: 'var(--adanger)', marginTop: 6 }}>{eventError}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="atl-btn primary" onClick={applyServerListEvent}>{PI.check}<span>Apply event</span></button>
        </div>
      </div>
    </div>
  );
}

function AtelierRelays({ session, profile, relays, setRelays, relayListEvent, setRelayListEvent, showToast, readonly, readonlyToast }) {
  const [adding, setAdding] = React.useState(false);
  const [newUrl, setNewUrl] = React.useState('');
  const [newUrlError, setNewUrlError] = React.useState('');
  const [eventText, setEventText] = React.useState(() => relayListEvent ? JSON.stringify(relayListEvent, null, 2) : '');
  const [eventError, setEventError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [publishResults, setPublishResults] = React.useState([]);

  React.useEffect(() => {
    if (relayListEvent) setEventText(JSON.stringify(relayListEvent, null, 2));
  }, [relayListEvent]);

  const pubkey = session.pubkey || profile.pubkey;
  const readCount = relays.filter(relay => relay.read).length;
  const writeCount = relays.filter(relay => relay.write).length;
  const publishTargets = relayPublishUrls(relays);
  const readTargets = relayReadUrls(relays);
  const lastPublished = relayListEvent?.created_at ? new Date(relayListEvent.created_at * 1000).toLocaleString() : 'Not published';

  const addRelay = () => {
    if (!newUrl.trim()) return;
    try {
      setRelays(prev => addRelayRecord(prev, newUrl));
      setNewUrl('');
      setNewUrlError('');
      setAdding(false);
      showToast('Relay added');
    } catch (error) {
      setNewUrlError(error.message || 'Unable to add relay.');
    }
  };
  const removeRelay = (url) => {
    setRelays(prev => removeRelayRecord(prev, url));
    showToast('Relay removed');
  };
  const moveRelay = (url, direction) => {
    setRelays(prev => moveRelayRecord(prev, url, direction));
  };
  const toggleRelayMode = (url, key) => {
    setRelays(prev => prev.map((relay) => {
      if (relay.url !== url) return relay;
      const next = { ...relay, [key]: !relay[key] };
      if (!next.read && !next.write) {
        showToast('Each relay needs read, write, or both enabled.');
        return relay;
      }
      return next;
    }));
  };
  const fillRelayEvent = () => {
    setEventText(relayListEvent ? JSON.stringify(relayListEvent, null, 2) : JSON.stringify(createRelayListEvent(relays, pubkey), null, 2));
    setEventError('');
  };
  const applyRelayEvent = () => {
    try {
      const event = JSON.parse(eventText);
      setRelays(parseRelayListEvent(event));
      setRelayListEvent(event);
      setEventError('');
      showToast('Relay list applied');
    } catch (error) {
      setEventError(error.message || 'Unable to parse relay list event.');
    }
  };
  const loadRelayList = async () => {
    if (!pubkey) {
      showToast('Sign in before loading a relay list.');
      return;
    }
    setBusy(true);
    try {
      const event = await fetchRelayListEvent(pubkey, relays);
      if (!event) {
        showToast('No kind 10002 relay list found.');
        return;
      }
      setRelays(parseRelayListEvent(event));
      setRelayListEvent(event);
      setEventText(JSON.stringify(event, null, 2));
      setEventError('');
      showToast('Relay list loaded');
    } catch (error) {
      showToast(error.message || 'Unable to load relay list.');
    } finally {
      setBusy(false);
    }
  };
  const publishRelayList = async () => {
    if (readonly) return readonlyToast();
    if (relays.length === 0) {
      showToast('Add at least one relay before publishing.');
      return;
    }
    const event = createRelayListEvent(relays, pubkey);
    let nextEvent = event;
    setBusy(true);
    setPublishResults([]);
    try {
      if (session.mode === 'nip07' && window.nostr?.signEvent) {
        nextEvent = await window.nostr.signEvent(event);
      }
      setRelayListEvent(nextEvent);
      setEventText(JSON.stringify(nextEvent, null, 2));
      setEventError('');
      if (!nextEvent.sig) {
        showToast('Relay list event drafted');
        return;
      }
      const results = await publishRelayListEvent(nextEvent, relays);
      setPublishResults(results);
      const ok = results.filter(result => result.ok).length;
      showToast(`Relay list published to ${ok}/${results.length} relays`);
    } catch (error) {
      showToast(error.message || 'Unable to publish relay list.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="atl-view">
      <div className="atl-pagehead">
        <div>
          <div className="atl-pagetitle">Relays</div>
          <div className="atl-pagesub">Manage your Nostr relay preferences. This publishes a NIP-65 kind 10002 event with read/write relay markers.</div>
        </div>
        <button className="atl-btn" disabled={busy} onClick={loadRelayList}>{PI.download}<span>{busy ? 'Working…' : 'Load from relays'}</span></button>
        <button className="atl-btn primary" onClick={() => setAdding(v => !v)}>{PI.plus}<span>Add relay</span></button>
      </div>

      <div className="srv-stats">
        <div className="srv-stat">
          <div className="srv-stat-lab">Relays</div>
          <div className="srv-stat-val">{relays.length}<span className="srv-stat-sub">NIP-65 entries</span></div>
        </div>
        <div className="srv-stat">
          <div className="srv-stat-lab">Read relays</div>
          <div className="srv-stat-val">{readCount}<span className="srv-stat-sub">where clients can reach you</span></div>
        </div>
        <div className="srv-stat">
          <div className="srv-stat-lab">Write relays</div>
          <div className="srv-stat-val">{writeCount}<span className="srv-stat-sub">where you publish events</span></div>
        </div>
        <div className="srv-stat">
          <div className="srv-stat-lab">Latest event</div>
          <div className="srv-stat-val" style={{ fontSize: 14 }}>{lastPublished}<span className="srv-stat-sub">kind 10002</span></div>
        </div>
      </div>

      {adding && (
        <div className="srv-add-panel">
          <div className="srv-add-head">
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Add a Nostr relay</div>
              <div style={{ fontSize: 11.5, color: 'var(--aink-soft)', marginTop: 2 }}>Use a <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5 }}>wss://</code> relay URL. Bare hosts are normalized to secure WebSocket relays.</div>
            </div>
            <button className="atl-iconbtn" onClick={() => setAdding(false)} title="Cancel">{PI.close}</button>
          </div>
          <div className="srv-add-form">
            <input className="atl-input" style={{ flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} value={newUrl} onChange={e => { setNewUrl(e.target.value); setNewUrlError(''); }} placeholder="wss://relay.example.com" autoFocus onKeyDown={e => { if (e.key === 'Enter') addRelay(); }}/>
            <button className="atl-btn primary" disabled={!newUrl.trim()} onClick={addRelay}>{PI.plus}<span>Add</span></button>
          </div>
          {newUrlError && <div className="atl-fieldhelp" role="alert" style={{ color: 'var(--adanger)', marginTop: 7 }}>{newUrlError}</div>}
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--aink-faint)' }}>Try:</span>
            {DEFAULT_NOSTR_RELAYS.map(relay => (
              <button key={relay} className="srv-suggest" onClick={() => setNewUrl(relay)}>{relay.replace('wss://', '')}</button>
            ))}
          </div>
        </div>
      )}

      <div className="atl-tablecard">
        <div className="atl-srv-row" style={{ gridTemplateColumns: '34px 28px minmax(0, 1fr) 86px 86px 40px 40px 40px', background: 'var(--apanel-2)', fontWeight: 600, color: 'var(--aink-faint)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          <span/><span/><span>Relay</span><span style={{ textAlign: 'center' }}>Read</span><span style={{ textAlign: 'center' }}>Write</span><span/><span/><span/>
        </div>
        {relays.length === 0 ? (
          <div className="atl-lib-state" style={{ border: 0 }}>No Nostr relays configured yet.</div>
        ) : relays.map((relay, index) => (
          <div key={relay.url} className="atl-srv-row" style={{ gridTemplateColumns: '34px 28px minmax(0, 1fr) 86px 86px 40px 40px 40px' }}>
            <span className="grip" style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <button className="atl-iconbtn-mini" disabled={index === 0} onClick={() => moveRelay(relay.url, -1)} title="Move up" style={{ opacity: index === 0 ? 0.3 : 1 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" width="9" height="9"><path d="M6 15l6-6 6 6"/></svg>
              </button>
              <button className="atl-iconbtn-mini" disabled={index === relays.length - 1} onClick={() => moveRelay(relay.url, 1)} title="Move down" style={{ opacity: index === relays.length - 1 ? 0.3 : 1 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" width="9" height="9"><path d="M6 9l6 6 6-6"/></svg>
              </button>
            </span>
            <div className="ico">{PI.bolt}</div>
            <div>
              <div className="name">{relay.name}</div>
              <div className="url">{relay.url}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button className={`atl-toggle ${relay.read ? 'on' : ''}`} role="switch" aria-checked={relay.read} onClick={() => toggleRelayMode(relay.url, 'read')} aria-label={`Read ${relay.name}`}/>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button className={`atl-toggle ${relay.write ? 'on' : ''}`} role="switch" aria-checked={relay.write} onClick={() => toggleRelayMode(relay.url, 'write')} aria-label={`Write ${relay.name}`}/>
            </div>
            <button className="atl-iconbtn" title="Copy relay URL" onClick={() => copyToClipboard(relay.url, showToast)}>{PI.copy}</button>
            <span/>
            <button className="atl-iconbtn" style={{ color: 'var(--adanger)' }} onClick={() => removeRelay(relay.url)} title="Remove relay">{PI.trash}</button>
          </div>
        ))}
      </div>

      <div className="srv-foot">
        <div className="srv-foot-card">
          <div className="srv-foot-h">{PI.refresh}<span>kind 10002 · publish targets</span></div>
          <div className="srv-foot-v">{publishTargets.length}<span style={{ fontSize: 12, color: 'var(--aink-faint)', fontWeight: 500 }}> write relays</span></div>
          <div className="srv-foot-sub">{publishTargets.length ? publishTargets.join(' · ') : 'Enable write on at least one relay before publishing.'}</div>
          <div className="srv-foot-actions">
            <button className="atl-btn" disabled={readonly || busy} onClick={publishRelayList}>{PI.upload}<span>{busy ? 'Publishing…' : 'Publish relay list'}</span></button>
          </div>
        </div>
        <div className="srv-foot-card">
          <div className="srv-foot-h">{PI.download}<span>Load targets</span></div>
          <div className="srv-foot-v">{readTargets.length || DEFAULT_NOSTR_RELAYS.length}<span style={{ fontSize: 12, color: 'var(--aink-faint)', fontWeight: 500 }}> read relays</span></div>
          <div className="srv-foot-sub">{readTargets.length ? readTargets.join(' · ') : `Fallback: ${DEFAULT_NOSTR_RELAYS.join(' · ')}`}</div>
        </div>
        <div className="srv-foot-card">
          <div className="srv-foot-h">{PI.shield}<span>Outbox model</span></div>
          <div className="srv-foot-v">NIP-65</div>
          <div className="srv-foot-sub">Read relays are where others can reach you. Write relays are where clients should look for your events.</div>
        </div>
      </div>

      {publishResults.length > 0 && (
        <div className="srv-event-panel">
          <div className="srv-add-head">
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Publish results</div>
              <div style={{ fontSize: 11.5, color: 'var(--aink-soft)', marginTop: 2 }}>Relay acknowledgements for the latest kind 10002 publish attempt.</div>
            </div>
          </div>
          <div className="srv-caps" style={{ marginTop: 0 }}>
            {publishResults.map(result => (
              <span key={result.url} className={`srv-cap ${result.ok ? 'on' : 'warn'}`}>{result.ok ? 'ok' : 'fail'} · {result.url}</span>
            ))}
          </div>
        </div>
      )}

      <div className="srv-event-panel">
        <div className="srv-add-head">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Relay list event</div>
            <div style={{ fontSize: 11.5, color: 'var(--aink-soft)', marginTop: 2 }}>Paste a NIP-65 kind 10002 event to import its relay tags, or fill from the current local list.</div>
          </div>
          <button className="atl-btn" onClick={fillRelayEvent}>{PI.copy}<span>Fill</span></button>
        </div>
        <textarea className="atl-textarea" style={{ width: '100%', minHeight: 124, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11 }} value={eventText} onChange={e => { setEventText(e.target.value); setEventError(''); }}/>
        {eventError && <div className="atl-fieldhelp" role="alert" style={{ color: 'var(--adanger)', marginTop: 6 }}>{eventError}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="atl-btn primary" onClick={applyRelayEvent}>{PI.check}<span>Apply event</span></button>
        </div>
      </div>
    </div>
  );
}

async function copyToClipboard(text, showToast) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Relay URL copied');
  } catch {
    showToast('Unable to copy relay URL');
  }
}

function AtelierSettings({ session, profile, settings, setSettings, servers, serverPreferenceEvent, relays, relayListEvent, blobs, lists, uploadJobs, readonly, readonlyToast, onLogout, onReset, onRestore, showToast }) {
  const [backupText, setBackupText] = React.useState('');
  const [backupError, setBackupError] = React.useState('');
  const [confirmText, setConfirmText] = React.useState('');
  const toggle = (k) => {
    setSettings(s => ({ ...s, [k]: !s[k] }));
  };
  const setAccent = (value) => {
    setSettings(s => ({ ...s, accent: value }));
  };
  const exportBackup = () => {
    const backup = createAtelierBackup({
      session,
      profile,
      settings,
      servers,
      serverPreferenceEvent,
      relays,
      relayListEvent,
      blobs,
      collections: lists,
      uploadJobs,
    });
    setBackupText(JSON.stringify(backup, null, 2));
    setBackupError('');
    showToast('Backup exported');
  };
  const importBackup = () => {
    try {
      const backup = parseAtelierBackup(backupText);
      onRestore(backup.snapshot);
      setBackupError('');
      showToast('Backup restored');
    } catch (error) {
      setBackupError(error.message || 'Unable to import backup.');
    }
  };
  const signOutConfirmed = () => {
    if (confirmText !== 'SIGN OUT') {
      showToast('Type SIGN OUT to confirm.');
      return;
    }
    onLogout();
  };
  const resetConfirmed = () => {
    if (confirmText !== 'RESET') {
      showToast('Type RESET to confirm.');
      return;
    }
    onReset();
    showToast('Local Atelier data reset');
  };
  const groups = [
    { title: 'Uploads', rows: [
      { k: 'autoOptimize', name: 'Auto-optimize images', desc: 'Strip EXIF and re-encode large images via /media (BUD-05).' },
      { k: 'mirror', name: 'Mirror to all active servers', desc: 'Replicate every new blob using PUT /mirror (BUD-04).' },
    ]},
    { title: 'Privacy', rows: [
      { k: 'publishList', name: 'Publish server list publicly', desc: 'Allow other clients to discover where your blobs live (kind 10063).' },
      { k: 'metadataWarnings', name: 'Warn on embedded metadata', desc: 'Inspect image files for EXIF, XMP, IPTC, comments, and GPS before upload.' },
      { k: 'requireCleanImages', name: 'Block sensitive image metadata', desc: 'Fail image uploads that contain sensitive metadata unless stripping is enabled.' },
      { k: 'privacy', name: 'Hide previews from public clients', desc: 'Strip thumbnails from your timeline events when possible.' },
    ]},
    { title: 'Display', rows: [
      { k: 'showHashes', name: 'Show full sha256 hashes', desc: 'Replace short hash labels with full 64-char hex everywhere.' },
    ]},
  ];
  return (
    <div className="atl-view">
      <div className="atl-pagehead">
        <div><div className="atl-pagetitle">Settings</div><div className="atl-pagesub">Local preferences for this Atelier client.</div></div>
      </div>
      <div style={{ maxWidth: 720 }}>
        <div className="atl-section-h" style={{ margin: '4px 0 8px' }}>Theme</div>
        <div className="atl-set-card">
          <div className="atl-set-row">
            <div>
              <div className="atl-set-name">Dark mode</div>
              <div className="atl-set-desc">Persist the app color scheme for this account.</div>
            </div>
            <div className="atl-set-spacer"/>
            <button className={`atl-toggle ${settings.dark ? 'on' : ''}`} role="switch" aria-checked={settings.dark} onClick={() => toggle('dark')} aria-label="Dark mode"/>
          </div>
          <div className="atl-set-row">
            <div>
              <div className="atl-set-name">Accent color</div>
              <div className="atl-set-desc">Used for active controls, server pins, and publish actions.</div>
            </div>
            <div className="atl-set-spacer"/>
            <input aria-label="Accent color" type="color" value={settings.accent} onChange={(event) => setAccent(event.target.value)} style={{ width: 38, height: 26, border: '1px solid var(--aline)', borderRadius: 6, padding: 2, background: 'var(--apanel)' }}/>
          </div>
        </div>
        {groups.map(g => (
          <React.Fragment key={g.title}>
            <div className="atl-section-h" style={{ margin: '4px 0 8px' }}>{g.title}</div>
            <div className="atl-set-card">
              {g.rows.map(r => (
                <div key={r.k} className="atl-set-row">
                  <div>
                    <div className="atl-set-name">{r.name}</div>
                    <div className="atl-set-desc">{r.desc}</div>
                  </div>
                  <div className="atl-set-spacer"/>
                  <button className={`atl-toggle ${settings[r.k] ? 'on' : ''}`} role="switch" aria-checked={Boolean(settings[r.k])} onClick={() => toggle(r.k)} aria-label={r.name}/>
                </div>
              ))}
            </div>
          </React.Fragment>
        ))}
        <div className="atl-section-h" style={{ margin: '18px 0 8px' }}>Backup</div>
        <div className="atl-set-card" style={{ padding: 12 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button className="atl-btn" onClick={exportBackup}>{PI.download}<span>Export backup</span></button>
            <button className="atl-btn primary" disabled={!backupText.trim()} onClick={importBackup}>{PI.upload}<span>Import backup</span></button>
          </div>
          <textarea
            aria-label="Backup JSON"
            className="atl-textarea"
            style={{ minHeight: 132, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11 }}
            value={backupText}
            onChange={(event) => { setBackupText(event.target.value); setBackupError(''); }}
            placeholder="Export or paste an Atelier backup JSON document."
          />
          {backupError && <div className="atl-fieldhelp" role="alert" style={{ color: 'var(--adanger)', marginTop: 6 }}>{backupError}</div>}
        </div>
        <div className="atl-section-h" style={{ margin: '18px 0 8px' }}>Danger Zone</div>
        <div className="atl-set-card" style={{ padding: 12 }}>
          <div className="atl-set-desc" style={{ marginBottom: 8 }}>Type <b>SIGN OUT</b> before signing out, or <b>RESET</b> before clearing local Atelier data.</div>
          <input className="atl-input" aria-label="Confirmation phrase" value={confirmText} onChange={(event) => setConfirmText(event.target.value)} placeholder="Confirmation phrase" style={{ marginBottom: 8 }}/>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="atl-btn danger" disabled={confirmText !== 'SIGN OUT'} onClick={signOutConfirmed}>Sign out of Atelier</button>
            <button className="atl-btn danger" disabled={confirmText !== 'RESET'} onClick={resetConfirmed}>Reset local data</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AtelierLogin({ onLogin, authError, authBusy, dark }) {
  const [remoteSignerInput, setRemoteSignerInput] = React.useState('');
  const [readonlyInput, setReadonlyInput] = React.useState('');

  return (
    <div className={`atl-root ${dark ? 'dark' : ''}`}>
      <div className="atl-login">
        <div className="atl-login-card">
          <div className="atl-login-mark">
            <span style={{ color: 'var(--aaccent-deep)' }}><PetalMark size={22}/></span>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Atelier</span>
          </div>
          <div className="atl-login-title">Sign in with nostr</div>
          <div className="atl-login-sub">Atelier uses your nostr key to authorize uploads, deletes, and profile changes — never to read it.</div>
          {authError && <div className="atl-login-alert" role="alert">{authError}</div>}
          <button className="atl-login-btn primary" disabled={authBusy} onClick={() => onLogin('nip07')}><span style={{ display: 'inline-flex' }}>{PI.shield}</span><span>{authBusy ? 'Checking extension…' : 'Browser extension (NIP-07)'}</span></button>
          <div className="atl-field" style={{ gap: 6, marginBottom: 8 }}>
            <input
              className="atl-input"
              value={remoteSignerInput}
              onChange={(event) => setRemoteSignerInput(event.target.value)}
              placeholder="bunker://remote-signer-pubkey?relay=wss://..."
              style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11.5 }}
            />
            <button className="atl-login-btn" disabled={authBusy} onClick={() => onLogin('nip46', remoteSignerInput)}><span style={{ display: 'inline-flex' }}>{PI.bolt}</span><span>Connect remote signer (NIP-46)</span></button>
          </div>
          <div className="atl-field" style={{ gap: 6, marginBottom: 8 }}>
            <input
              className="atl-input"
              value={readonlyInput}
              onChange={(event) => setReadonlyInput(event.target.value)}
              placeholder="npub1..."
              style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11.5 }}
            />
            <button className="atl-login-btn" disabled={authBusy} onClick={() => onLogin('readonly', readonlyInput)}><span style={{ display: 'inline-flex' }}>{PI.user}</span><span>Read-only · paste npub</span></button>
          </div>
          <div className="atl-login-fine">Authorization happens with kind 24242 events signed by your extension. Your private key never leaves it.</div>
        </div>
      </div>
    </div>
  );
}

function AtelierCollections({ session, profile, servers, lists, setLists, blobs, onOpen, showToast, readonly, readonlyToast }) {
  const [editing, setEditing] = React.useState(null); // list id being inline-renamed
  const [eventText, setEventText] = React.useState('');
  const [eventError, setEventError] = React.useState('');
  const blobByHash = React.useMemo(() => {
    const m = new Map();
    blobs.forEach(b => m.set(b.hash, b));
    return m;
  }, [blobs]);

  const updateList = (id, patch) => {
    if (readonly) return readonlyToast();
    setLists(prev => prev.map(l => l.id === id ? { ...l, ...patch, eventUpdatedAt: Math.floor(Date.now() / 1000) } : l));
  };
  const removeList = (id) => {
    if (readonly) return readonlyToast();
    if (!confirm(`Delete this collection? Blobs are not deleted.`)) return;
    setLists(prev => prev.filter(l => l.id !== id));
    showToast('Collection deleted');
  };
  const newList = () => {
    if (readonly) return readonlyToast();
    const id = 'list-' + Date.now().toString(36);
    setLists(prev => [...prev, { id, d: id, name: 'Untitled list', emoji: '🌸', desc: '', kind: 30003, hashes: [], eventUpdatedAt: Math.floor(Date.now() / 1000) }]);
    setEditing(id);
    showToast('New collection');
  };
  const signEvent = async (event) => {
    if (session.mode === 'nip07' && window.nostr?.signEvent) return window.nostr.signEvent(event);
    return event;
  };
  const publishList = async (list) => {
    if (readonly) return readonlyToast();
    const event = createCollectionEvent(list, blobs, session.pubkey || profile.pubkey);
    const signed = await signEvent(event);
    setLists(prev => prev.map(item => item.id === list.id ? markCollectionPublished(item, signed) : item));
    showToast(signed.sig ? 'Collection signed' : 'Collection event drafted');
  };
  const copyShare = async (list) => {
    const relays = servers.filter(server => server.status !== 'offline').map(server => server.url);
    const ref = await collectionShareReference(list, session.pubkey || profile.pubkey, relays);
    await navigator.clipboard?.writeText(ref).catch(() => null);
    showToast('Collection reference copied');
  };
  const applyEvent = () => {
    try {
      setLists(prev => applyRemoteCollectionEvent(prev, eventText));
      setEventText('');
      setEventError('');
      showToast('Collection event applied');
    } catch (error) {
      setEventError(error.message || 'Unable to apply collection event.');
    }
  };

  return (
    <div className="atl-view">
      <div className="atl-pagehead">
        <div>
          <div className="atl-pagetitle">Collections</div>
          <div className="atl-pagesub">NIP-51 lists (kind 30003). A blob can live in zero or many lists. Lists publish to your relays as replaceable events keyed by the <code style={{ background: 'var(--aline-2)', padding: '1px 5px', borderRadius: 3, fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 11 }}>d</code> tag.</div>
        </div>
        <button className="atl-btn primary" disabled={readonly} onClick={newList}>{PI.plus}<span>New collection</span></button>
      </div>

      <div className="srv-event-panel" style={{ marginBottom: 14 }}>
        <div className="srv-add-head">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Remote collection event</div>
            <div style={{ fontSize: 11.5, color: 'var(--aink-soft)', marginTop: 2 }}>Paste a NIP-51 kind 30003 event to refresh or merge a collection.</div>
          </div>
          <button className="atl-btn primary" onClick={applyEvent}>{PI.check}<span>Apply</span></button>
        </div>
        <textarea className="atl-textarea" style={{ width: '100%', minHeight: 84, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11 }} value={eventText} onChange={e => { setEventText(e.target.value); setEventError(''); }}/>
        {eventError && <div className="atl-fieldhelp" role="alert" style={{ color: 'var(--adanger)', marginTop: 6 }}>{eventError}</div>}
      </div>

      <div className="atl-coll-grid">
        {lists.map(l => {
          const previews = l.hashes.map(h => blobByHash.get(h)).filter(Boolean);
          const cells = Array.from({ length: 6 }, (_, i) => previews[i]);
          return (
            <div key={l.id} className="atl-coll-card" onClick={(e) => { if (e.target.closest('input,button')) return; onOpen(l.id); }}>
              {l.conflict && <div className="atl-coll-conflict">Remote update waiting</div>}
              <div className="atl-coll-cover">
                {cells.map((b, i) => {
                  if (!b) return <div key={i} className="atl-coll-cover-cell empty">{i === 0 ? l.emoji : ''}</div>;
                  const k = ATELIER_FORMAT.kindOf(b);
                  if (k === 'image' || k === 'video') {
                    return <div key={i} className="atl-coll-cover-cell" style={{ backgroundImage: `url(${b.url})` }}/>;
                  }
                  return <div key={i} className="atl-coll-cover-cell">{k === 'audio' ? PI.audio : k === 'pdf' ? PI.pdf : PI.file}</div>;
                })}
              </div>
              <div className="atl-coll-meta">
                <div className="atl-coll-title">
                  <span style={{ fontSize: 14 }}>{l.emoji}</span>
                  {editing === l.id ? (
                    <input autoFocus value={l.name}
                      disabled={readonly}
                      onChange={(e) => updateList(l.id, { name: e.target.value })}
                      onBlur={() => setEditing(null)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditing(null); }}
                    />
                  ) : (
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
                  )}
                  <div className="atl-coll-actions">
                    <button className="atl-iconbtn-mini" disabled={readonly} title="Rename" onClick={(e) => { e.stopPropagation(); readonly ? readonlyToast() : setEditing(l.id); }}>{PI.edit}</button>
                    <button className="atl-iconbtn-mini" disabled={readonly} title="Publish event" onClick={(e) => { e.stopPropagation(); publishList(l); }}>{PI.upload}</button>
                    <button className="atl-iconbtn-mini" title="Copy reference" onClick={(e) => { e.stopPropagation(); copyShare(l); }}>{PI.link}</button>
                    <button className="atl-iconbtn-mini" disabled={readonly} title="Delete" onClick={(e) => { e.stopPropagation(); removeList(l.id); }}>{PI.trash}</button>
                  </div>
                </div>
                <div className="atl-coll-desc">{l.desc || <span style={{ fontStyle: 'italic', opacity: 0.7 }}>No description</span>}</div>
                <div className="atl-coll-foot">
                  <span className="ct">{l.hashes.length} {l.hashes.length === 1 ? 'blob' : 'blobs'}</span>
                  <span style={{ opacity: 0.5 }}>·</span>
                  <span className="kind">kind {l.kind}</span>
                  {l.publishedAt && <span className="kind">published</span>}
                  <span style={{ marginLeft: 'auto', color: 'var(--aaccent-deep)', fontWeight: 600 }}>Open →</span>
                </div>
                {l.conflict && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button className="atl-btn" onClick={(e) => { e.stopPropagation(); setLists(prev => applyRemoteCollectionEvent(prev.map(item => item.id === l.id ? { ...item, eventUpdatedAt: 0 } : item), l.conflict.remoteEvent)); }}>Use remote</button>
                    <button className="atl-btn" onClick={(e) => { e.stopPropagation(); updateList(l.id, { conflict: null }); }}>Keep local</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <button className="atl-coll-card-new" disabled={readonly} onClick={newList}>
          <div className="ico">{PI.folderPlus}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--aink)' }}>New collection</div>
          <div style={{ fontSize: 11.5 }}>Group blobs into a NIP-51 list</div>
        </button>
      </div>
    </div>
  );
}
