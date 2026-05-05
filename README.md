# Atelier

Atelier is a local-first Blossom client for managing personal media libraries on top of Nostr identity, Nostr relays, and Blossom servers. It is built with TanStack Start, React, TanStack Router, Vite, and Nitro.

The app focuses on giving users a practical workspace for uploading blobs, tracking replicas across Blossom servers, organizing files into collections, managing relay and server preferences, and exporting or restoring local state.

## Features

- Nostr account setup with NIP-07 extension login, NIP-46 bunker login, and read-only `npub` mode.
- Local media library with grid and focused views, filtering, multi-select actions, metadata inspection, and replica status.
- Blossom upload and mirroring flows using server descriptors, upload endpoints, mirror endpoints, and authorization headers when a signer is available.
- Collection management backed by Nostr addressable list events.
- Blossom server preference management using kind `10063` events.
- Relay list management using NIP-65 kind `10002` events with read/write relay markers.
- Profile metadata editing and NIP-05 verification support.
- Client-side metadata privacy checks and JPEG metadata stripping before upload.
- Versioned local persistence with JSON backup and restore.

## Tech Stack

- Runtime: Node.js, React 18, TanStack Start, TanStack Router, Nitro
- Build tooling: Vite
- Nostr protocol utilities: `nostr-tools`
- Tests: Node test runner and Playwright

## Getting Started

Install dependencies:

```sh
npm install
```

Start the development server:

```sh
npm run dev
```

Open `http://127.0.0.1:5173/`.

Build and run the production server:

```sh
npm run build
npm run start
```

## Scripts

- `npm run dev`: start the Vite development server.
- `npm run build`: create a production build.
- `npm run start`: run the Nitro production output from `.output/server/index.mjs`.
- `npm run preview`: serve a Vite preview build.
- `npm test`: run unit tests.
- `npm run test:unit`: run unit tests.
- `npm run test:e2e`: run browser smoke and responsive QA tests.
- `npm run test:responsive`: run only the responsive QA test.

`npm run test:e2e` expects the app to already be running at `APP_BASE_URL`, or `http://127.0.0.1:5173` by default. Responsive screenshots are written to `test-artifacts/responsive/`.

## Project Structure

```text
src/
  routes/                 TanStack Start routes
  lib/                    Protocol, persistence, schema, and state helpers
  atelier-app.jsx         Main application shell and surfaces
  atelier-onboarding.jsx  Onboarding flow
  atelier-shared.jsx      Shared UI helpers
tests/
  unit/                   Protocol and state unit tests
  e2e/                    Playwright browser tests
```

## Local State

Atelier stores application state in versioned `localStorage` keys. State is scoped by the active account where appropriate, including Blossom server preferences, relay preferences, library contents, collections, profile metadata, settings, and upload history.

Fresh app state starts empty. The app does not seed demo profile data, demo blobs, collections, upload queues, or selected Blossom servers at runtime.

Backups export a validated JSON snapshot of local state and can be restored from the Settings view.

## Protocol Coverage

Supported flows:

- Nostr login through NIP-07, NIP-46, or read-only public keys.
- Profile metadata through kind `0` events.
- Relay list metadata through NIP-65 kind `10002` events.
- Blossom server preferences through kind `10063` events.
- Blossom server descriptor and capability checks.
- Blob list loading, SHA-256 deduplication, and per-server replica refresh.
- Blob upload and mirroring requests.
- Nostr authorization headers for Blossom operations when a signer is available.

Current limitations:

- Relay publishing is prepared as signed or draft events, but relay-pool broadcasting is still tracked as follow-up work in GitHub issues.
- Delete actions remove blobs from the local library and local collections, not from remote Blossom servers.
- NIP-46 sessions are persisted as local client connection metadata for this prototype.
- Media optimization policy is represented in settings, but full server-side transform orchestration is not implemented.

## Review Helpers

The app supports deterministic review states through query parameters:

- `?onboarding=1&step=0` through `?onboarding=1&step=6`
- `?loggedOut=1`
- `?dark=1`
- `?accent=%23c97896`
- `?view=library`
- `?view=collections`
- `?view=upload`
- `?view=profile`
- `?view=servers`
- `?view=relays`
- `?view=settings`

## Development Workflow

Use GitHub issues as the source of truth for new work. Do not add a local TODO backlog to the repository.

Before opening a pull request or pushing a significant change, run:

```sh
npm test
npm run build
```

For UI changes, also run the app locally and execute:

```sh
npm run test:e2e
```
