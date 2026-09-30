# Sebas XP

A retro RPG tracker for real life. Log what you do (studying, lifting, internship apps, projects), earn XP, and level from 1 to 100 over one year.

It's a **Progressive Web App**: a website you install to your iPhone home screen or Mac Dock. It opens full screen and works offline, like any other app.

---

## 1. Preview it on your Mac

You need a tiny local server. Opening `index.html` directly won't work, because browsers block apps loaded from a file.

```bash
cd ~/Documents/sebas-xp
python3 tools/serve.py
```

Then open **http://localhost:8000**. Press `Ctrl+C` in Terminal to stop the server.

- Refresh the page to see any edit you make.
- To preview at phone size in Safari: Develop menu → Enter Responsive Design Mode. In Chrome: View → Developer → Developer Tools, then click the phone icon.
- Run the unit tests: `sh tests/run.sh` in Terminal, or open http://localhost:8000/tests/
- Preview all the pixel art: http://localhost:8000/tools/art.html

> Data you log on `localhost` is a separate save from the real app online. Use it for testing.

---

## 2. Put it online with GitHub Pages (free)

You only do this once. After that, updating is two clicks.

### Step 1: Make a GitHub account
Go to **github.com** → **Sign up**. Your username becomes part of your app's address: `https://USERNAME.github.io/sebas-xp/`.

> Pick a username you'll keep. Your saved XP is tied to the web address. If you ever rename your account or the repo, export a backup first (Setup → Export Backup) and import it at the new address.

### Step 2: Upload the code (pick one option)

**Option A, easiest: GitHub Desktop.** It creates the repository for you.
1. Download **GitHub Desktop** from desktop.github.com, open it, and sign in with your GitHub account.
2. **File → Add Local Repository…** → choose `Documents/sebas-xp` → **Add Repository**.
3. It says "This directory does not appear to be a Git repository." Click **create a repository**, keep the name `sebas-xp`, and click **Create Repository**.
4. Click **Publish repository** (top bar). **Uncheck "Keep this code private"**, then click **Publish Repository**.
   Free GitHub Pages needs a public repo. Only the code is public; your XP data never leaves your devices.

**Option B: Terminal** (or ask Claude Code: *"push this to GitHub, my username is ___"*)
1. On github.com, click **+** (top right) → **New repository**. Name it `sebas-xp`, choose **Public**, don't add a README/.gitignore/license, and click **Create repository**.
2. In Terminal (the two `git config` lines are one-time setup; use your own name and GitHub username):
```bash
git config --global user.name "Your Name"
git config --global user.email "USERNAME@users.noreply.github.com"
cd ~/Documents/sebas-xp
git init
git add .
git commit -m "Sebas XP v2"
git branch -M main
git remote add origin https://github.com/USERNAME/sebas-xp.git
git push -u origin main
```
If git asks for a password, it wants a **token**, not your GitHub password. To make one: GitHub → your profile picture → **Settings** → **Developer settings** (bottom of the left sidebar) → **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**. Name it "laptop", tick **repo**, click **Generate token**, and paste the token as the password. Your Mac remembers it after the first time.

### Step 3: Turn on GitHub Pages
1. On your repo page on github.com, click the **Settings** tab (top row, far right).
2. In the left sidebar, click **Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Under **Branch**, pick **main** and **/ (root)**, then click **Save**.
5. Wait 1–2 minutes and refresh. A box appears at the top: **"Your site is live at https://USERNAME.github.io/sebas-xp/"**.

### Updating the app later
- **GitHub Desktop:** type a short summary bottom-left → **Commit to main** → **Push origin**.
- **Terminal:** `git add . && git commit -m "what changed" && git push`

The site updates in about a minute. The installed app picks up new code the next time you open it with internet.

---

## 3. Install it

**iPhone** (must use **Safari**):
1. Open `https://USERNAME.github.io/sebas-xp/` in Safari.
2. Tap the **Share** button (square with an arrow) → scroll down → **Add to Home Screen** → **Add**.
3. From now on, open Sebas XP **from the home screen icon**.

> On iPhone, the home screen app and a Safari tab keep **separate saves**. Install first, then log only in the installed app. The app shows a reminder if you open it in a Safari tab.

**Mac:**
- Safari: open the site → **File → Add to Dock**.
- Chrome: open the site → click the install icon at the right end of the address bar.

---

## 4. Your data (how progress is kept safe)

- Every log saves the moment you tap. The top-right of the HUD says **SAVED**.
- The save lives in the app's database on **that device** (IndexedDB), plus a second copy in local storage. If either one is ever lost, the app rebuilds it from the other on the next launch.
- The app asks the browser to mark its storage as permanent. The installed iPhone app gets this protection. Setup → Save File → "Protected" shows the status.
- **Backups:** Setup → **Export Backup** saves a `.json` file. On iPhone, pick **Save to Files** and put it in iCloud Drive. The app nags you if it's been 7+ days. A backup is the only copy that survives a lost phone, or clearing Safari's website data.
- **Restore or move data:** Setup → **Import Backup** → choose the file.
  - **Merge** adds anything missing and keeps what's there. Use it to combine phone + laptop logs.
  - **Replace** makes the device an exact copy of the backup. You can undo the last Replace from Setup.
- **Phone and laptop:** turn on **Cloud sync** (next section) and they stay in sync automatically. Without it, each device keeps its own save; to combine them, export on one and **Merge** on the other.
- Don't use "Clear History and Website Data" in Safari settings unless you have a fresh backup.

---

## 5. Cloud sync: phone ↔ laptop (free, about 10 minutes)

Sync uses **Supabase**, a free hosted database. Each device keeps its full save, so the app still works offline. Sync copies changes both ways: when you open the app, a couple of seconds after each log, and every minute while it's open. The HUD shows **SYNCED**, **SYNCING**, or **SAVED · OFFLINE**.

### Step 1: Create the Supabase project
1. Go to **supabase.com** → **Start your project** → **Continue with GitHub** (use the account from section 2).
2. Click **New project**. Name it `sebas-xp`. For **Database password**, click **Generate a password** and save it in your Passwords app (the app doesn't need it). Pick the **Region** closest to you (e.g. *West US*), then **Create new project**. Wait about 2 minutes.

### Step 2: Create the tables
1. In the left sidebar, click **SQL Editor** → **+ New query**.
2. Open `supabase/schema.sql` from this folder, copy all of it, paste it in, and click **Run**. You should see *"Success. No rows returned."*

### Step 3: Let the app sign in without email links
Left sidebar → **Authentication** → **Sign In / Providers** (on older dashboards: **Providers → Email**). Turn **off "Confirm email"** and click **Save**.
This matters on iPhone, because confirmation links open in Safari instead of the installed app.

### Step 4: Put your project's address in the app
1. Click **Connect** at the top of your project (or **Project Settings → API Keys**).
2. Copy the **Project URL** (`https://something.supabase.co`) and the **publishable key** (starts with `sb_publishable_`; older projects call it the **anon public** key).
3. Paste both into `js/config.js` at the bottom (`SYNC = { url: '…', key: '…' }`). Or give them to Claude Code: *"here's my Supabase URL and key, turn on sync"*.
4. Push the change to GitHub (section 2, "Updating the app later").

Both values are designed to be public. The database rules only let *your signed-in account* read or change your data.

### Step 5: Sign in on each device
1. **First device** (e.g. your iPhone app): Setup → **Cloud Sync** → enter an email and password (let iPhone save it) → **CREATE ACCOUNT**. Everything on that device uploads.
2. **Every other device:** Setup → Cloud Sync → **SIGN IN** with the same email and password. Its logs are combined with the cloud copy; nothing gets overwritten.

### Step 6: Lock it down
Back in Supabase: **Authentication → Sign In / Providers** → turn **off "Allow new users to sign up"** → **Save**. Your key is public, so without this anyone could make an account in your project. They still couldn't see your data, but this keeps the project yours alone.

### Good to know
- **Deletes and resets sync too.** Deleting a log (or Setup → Reset) on one device does the same on the others. Keep exporting backups; a backup is your undo button.
- Bonus XP, streak bonuses, and quest rewards aren't uploaded. Each device recalculates them from your logs, so every device shows the same level.
- **Free projects pause after about a week of no use.** Logging daily keeps yours awake. If it does pause, the app keeps working on each device; open the Supabase dashboard, click **Restore project**, and everything syncs again.
- Want to test sync without touching your real data? Run `python3 tools/mock_supabase.py`. Instructions are at the top of that file.

---

## 6. Evening reminders: what iPhone can and can't do

An iPhone web app **can't schedule its own notifications**. Web push on iOS needs a server that sends the message, and to only ping you when you're under 100 XP, that server would have to know your XP. That's only possible with cloud sync (a backend + login).

What you get instead:
- **In-app evening banner:** after 7 PM, if you're under 100 XP, Home shows how many XP keep your streak alive. You can turn it off in Setup.
- **A nightly ping from iOS itself.** It isn't XP-aware, but it's reliable:
  1. Open the **Shortcuts** app → **Automation** tab → **+** → **Time of Day**.
  2. Set **8:00 PM**, **Daily**, choose **Run Immediately** → **Next**.
  3. Tap **New Blank Automation** → **Add Action** → search **Show Notification** → type "Log your XP ⚔️" → **Done**.

  Or just make a repeating Reminder at 8 PM.

**With cloud sync set up**, a real XP-aware push notification becomes possible: a small scheduled Supabase function checks your XP at 8 PM and sends a web push only if you're under 100 (works on iPhone for home-screen apps, iOS 16.4+). It's not built yet; ask Claude Code if you want it.

---

## 7. Editing the app

| I want to… | Edit |
|---|---|
| Change an activity's XP or name, or add default activities | `js/config.js` → `DEFAULT_ACTS` (or use the ⋯ menu in the app) |
| Change quest rewards, bosses, bonus amounts | `js/config.js` → `QUEST_XP`, `BOSSES`, `BONUS` |
| Change colors | `styles.css` → the `:root` block at the top |
| Change the pixel art | `js/pixel.js` (preview at `/tools/art.html`) |
| Change the app icon | `tools/make_icons.py`, then run `python3 tools/make_icons.py` |
| Turn cloud sync on | `js/config.js` → `SYNC` (see section 5) |
| Change a screen's layout | `js/views/home.js`, `log.js`, `hero.js`, `history.js`, `setup.js` |

The leveling math (`js/leveling.js`) is covered by tests. After changing math, run `sh tests/run.sh` and make sure everything still says `ok`.

If you add a new JS file, also add it to the `APP_FILES` list in `sw.js` so it works offline from the first launch.

### How the code is organized
```
index.html          the page shell (meta tags for iPhone install, loads styles + app)
styles.css          all styling
manifest.json       app name, icons, colors for installing
sw.js               service worker: makes the app work offline
js/
  config.js         ← the numbers: XP values, trees, tiers, bonuses, quests
  leveling.js       levels, streaks, bonus rules (pure math, tested)
  rules.js          keeps bonus/quest XP in sync with your log (handles past days + undo)
  quests.js         daily quests + weekly bosses
  achievements.js   badge list
  stats.js          character sheet stats, weekly recap, heatmap
  dates.js          dates + the 4 AM day boundary
  storage.js        saving: IndexedDB + backup copy + JSON backups
  sync.js           cloud sync: sign-in + talking to Supabase
  syncmerge.js      rules for combining two devices' data (tested)
  state.js          what the app knows right now
  app.js            startup, logging, celebrations, button handling
  pixel.js          icons, crest, hero sprite, radar chart
  feel.js           8-bit sounds, vibration, screen shake
  ui.js             toasts, pop-ups
  views/            one file per screen
supabase/schema.sql the cloud database setup (paste into Supabase once)
tests/              unit tests (run.sh / index.html)
tools/              local server, fake Supabase for testing, icon generator, art preview
legacy/             the original single-file version, for reference
```
