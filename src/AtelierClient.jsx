'use client';

import React from 'react';
import { AtelierApp } from './atelier-app.jsx';
import {
  TweakColor,
  TweakSection,
  TweakSelect,
  TweakToggle,
  TweaksPanel,
  useTweaks,
} from './tweaks-panel.jsx';

const TWEAK_DEFAULTS = {
  dark: false,
  accent: '#e8a4b8',
  showOnboarding: false,
  loggedOut: false,
  onboardStep: 0,
  view: 'library',
};

function defaultsFromSearchParams(searchParams) {
  const getParam = (name) => {
    if (typeof searchParams?.get === 'function') return searchParams.get(name);
    return searchParams?.[name] == null ? null : String(searchParams[name]);
  };

  return {
    ...TWEAK_DEFAULTS,
    dark: getParam('dark') === '1',
    accent: getParam('accent') || TWEAK_DEFAULTS.accent,
    showOnboarding: getParam('onboarding') === '1',
    loggedOut: getParam('loggedOut') === '1',
    onboardStep: Number(getParam('step') || TWEAK_DEFAULTS.onboardStep),
    view: getParam('view') || TWEAK_DEFAULTS.view,
  };
}

export default function AtelierClient({ searchParams = {} }) {
  const [t, setTweak] = useTweaks(defaultsFromSearchParams(searchParams));

  React.useEffect(() => {
    window.__ATELIER_READY = true;
    return () => { window.__ATELIER_READY = false; };
  }, []);

  return (
    <>
      <main className="app-shell">
        <AtelierApp
          dark={t.dark}
          accent={t.accent}
          view={t.view}
          loggedIn={!t.loggedOut}
          forceOnboarding={t.showOnboarding}
          onboardStartStep={t.onboardStep || 0}
        />
      </main>
      <Tweaks t={t} setTweak={setTweak} />
    </>
  );
}

function Tweaks({ t, setTweak }) {
  return (
    <TweaksPanel title="Atelier tweaks">
      <TweakSection label="Theme" />
      <TweakToggle label="Dark mode" value={t.dark} onChange={(v) => setTweak('dark', v)} />
      <TweakColor label="Accent color" value={t.accent} onChange={(v) => setTweak('accent', v)} />
      <TweakSection label="Review state" />
      <TweakToggle label="Logged out (login screen)" value={t.loggedOut} onChange={(v) => setTweak('loggedOut', v)} />
      <TweakToggle label="Force onboarding" value={t.showOnboarding} onChange={(v) => setTweak('showOnboarding', v)} />
      <TweakSelect
        label="Jump to onboarding step"
        value={t.onboardStep || 0}
        options={[
          { value: 0, label: '1 · Welcome' },
          { value: 1, label: '2 · Servers' },
          { value: 2, label: '3 · Mirror & privacy' },
          { value: 3, label: '4 · First collection' },
          { value: 4, label: '5 · Profile basics' },
          { value: 5, label: '6 · Test upload' },
          { value: 6, label: '7 · All set' },
        ]}
        onChange={(v) => setTweak('onboardStep', Number(v))}
      />
    </TweaksPanel>
  );
}
