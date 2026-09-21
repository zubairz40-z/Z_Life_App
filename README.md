# ZLife — Your life, organized.

A private, offline-first personal life manager that runs entirely in your browser. No account, no server, no tracking — your data never leaves your device.

- **Today** — tasks with priorities, due dates/times and reminders
- **Calendar** — deadlines, exams and important dates
- **Tuition** — students, scheduled lessons, and completion tracking
- **Money** — expenses/income, savings tracking and a built-in calculator
- **Fitness** — weight entries, trend chart and goal progress
- **Notes** — quick private notes with pinning and search
- **Settings** — theme, notifications, currency, JSON backup/restore, clear data

Built with vanilla HTML + JavaScript (ES modules), Tailwind CSS, IndexedDB (data), localStorage (settings only), and a service worker for offline use. No frameworks, no build step for the app itself.

**Timezone note:** "today" always means **today in Bangladesh Standard Time** (Asia/Dhaka, UTC+6) — dates, month views and reminders all follow the BD calendar regardless of the device timezone.

---

## Quick start (local)

Requires **Node 18+** (tested on Node 24).

```bash
npm install        # installs Tailwind + lucide-static (dev tools only; zero runtime deps)
npm run dev        # builds CSS, then serves at http://localhost:4173
```

Or serve without rebuilding:

```bash
npm start          # serve at http://localhost:4173
```

Open **http://localhost:4173** in any modern browser.

### Other scripts

| Command           | What it does                                              |
| ----------------- | --------------------------------------------------------- |
| `npm run build`   | Regenerate PNG icons + minified Tailwind CSS              |
| `npm test`        | Run the headless-Chrome end-to-end suite (33 checks)      |
| `npm run icons:embed` | Regenerate `js/icons.js` from `lucide-static`         |
| `npm run dev`     | `build:css` + serve                                       |

Screenshots from the E2E run land in `shots/` (`01-today-empty.png`, `02-tuition.png`, `03-money.png`, `04-fitness.png`, `05-notes.png`, `08-desktop-today.png`, …).

---

## Project structure

```
index.html            App shell (sidebar/bottom-nav, meta, manifest link)
manifest.webmanifest  PWA manifest (name, icons, standalone, theme)
sw.js                 Service worker — precaches the app shell, offline-first
src/input.css         Tailwind source (utility classes + component layer)
css/styles.css        Built Tailwind output (do not edit by hand)
js/                   ES modules: state, db, storage, router, ui, notifications,
                      icons (embedded), views/{today,calendar,tuition,money,fitness,notes,settings}
icons/                Generated PNG icons (192/512, maskable, apple-touch)
scripts/              Dev/test tooling: serve, e2e, icon generators, CSS build
testdata/             E2E import fixtures
```

---

## Testing the PWA

1. Start the server (`npm start`), open the app, then **hard-reload** once so the service worker installs.
2. In **Chrome DevTools → Application → Service Workers**: you should see an active `sw.js`. In **Application → Manifest**, the manifest should load with the app icons.
3. Test offline: DevTools → **Network → Offline** (or `Airplane Mode`), then reload. The app still boots from the service worker cache because all JS/CSS/icons are precached.
4. Hooks for a full Lighthouse PWA audit: run **Lighthouse → Progressive Web App** on `http://localhost:4173` (Serve Over HTTPS is the only scaffold-level flag; localhost counts as a secure context).

Reminders work like this: while ZLife is open (or in the background of the device), it checks for due reminders **on load, on tab focus, and every 30 seconds**. Each reminder fires once (tracked in localStorage) and always surfaces as an in-app toast; native notifications are shown when permission is granted and enabled. There is no server-side scheduling, by design.

---

## Deploying to Vercel

ZLife is fully static — no server code, no rewrites needed (routing is hash-based).

1. Push the folder to a Git repo (GitHub/GitLab/Bitbucket) — or deploy directly from the directory.
2. In Vercel: **Add New Project → Import** the repo.
3. Project settings:
   - **Framework Preset:** `Other`
   - **Root Directory:** `.`
   - **Build Command:** `npm run build` (with **Install Command:** `npm install`)
   - **Output Directory:** `.` (the prebuilt static site lives at the root)
4. Click **Deploy**.

Because the app is served over HTTPS, the service worker **will** install on Vercel, and on iOS the site becomes installable (see below). Update `sw.js`'s `CACHE` name (`'zlife-v2'`) whenever you ship a new version so clients pick up the fresh app shell.

> If you use the Vercel CLI instead: `npx vercel` (preview) → then `npx vercel --prod`.

---

## Installing on iPhone (Safari)

1. Open the deployed URL in **Safari** (Chrome/Firefox on iOS cannot install PWAs).
2. Optionally sign in nothing — there are no accounts.
3. **Allow notifications** inside the app first (Settings → Notifications → *Allow notifications*) — iOS requires this **before** installing.
4. Tap **Share** (the square-with-arrow button) → **Add to Home Screen** → **Add**.
5. Launch ZLife from your Home Screen. It opens **fullscreen (standalone)**, has a proper dock icon, and registers its own notification permission.

> If the icon looks wrong or it opens in a tab, delete the Home Screen icon, hard-refresh the site once in Safari, and re-add it.

### iOS notification limitations (important)

- Web Push on iOS requires iOS **16.4+**, the app **installed to the Home Screen**, and permission granted **from inside the installed app**. Until iOS 16.4, iPhones had no web notification support at all.
- Safari/WebKit **does not allow scheduled or "silent push"** notifications. ZLife cannot wake itself up to fire a reminder at 3pm while fully closed — so reminders are checked **only while the app is running** (foreground, or briefly in the app switcher). You get the toast + notification the moment you next open ZLife if one was missed.
- Permission is exposed in **Settings → ZLife → Notifications** and can be revoked anytime.
- For reliable closed-app reminders on iOS, a native app (or the built-in Reminders/Calendar) is the robust choice — this is a platform constraint, not a ZLife bug.

---

## Data & privacy

- **Everything stays on the device.** IndexedDB holds data; localStorage holds settings. There is no backend, analytics, or network calls except to load the app itself.
- Backup: **Settings → Data → Export** downloads a `ZLife-backup-YYYY-MM-DD.json` file with all records + settings.
- Restore: **Settings → Data → Import** — choose **Merge** (keep current data, add backup records) or **Replace** (wipes everything first; requires typing `DELETE` in the confirmation dialog).
- **Settings → Clear all data** also requires typing `DELETE`.
- Clearing the browser's site data removes everything; there is no cloud copy — keep a backup file somewhere safe (iCloud, email to yourself, etc.).