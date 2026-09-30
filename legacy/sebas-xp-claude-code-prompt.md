# Prompt for Claude Code

Put this file and `sebas-xp.html` in a new empty folder, open that folder in Claude Code, and paste everything below the line.

---

I have a single-file HTML app called `sebas-xp.html` in this folder. It's a retro RPG-style personal XP tracker. I log real-life activities (studying, lifting, internship apps, engineering projects, etc.), earn XP, and level up from 1 to 100 over one year. It currently runs as a claude.ai artifact. I want to turn it into a real app I can install on my iPhone home screen and on my MacBook, and I want it improved overall.

Read the whole file first so you understand the leveling math, activity list, and UI before changing anything.

## How the current app works (do not break this)

- **Overall level 1 to 100**, 5 tiers of 20 levels: Apprentice (300 XP/level), Technician (450), Engineer (575), Senior Engineer (700), Chief Engineer (825). 56,175 total XP to reach 100. Target pace is 154 XP/day, start date 2026-09-29.
- **7 skill trees** (Academics, Engineering, Skills, Career, Fitness, Social, Discipline), each level 1 to 50 with a new rank every 10 levels. Each tree's cost per level is scaled by its expected yearly XP (the `T` values in `TREES`).
- **~150 activities** in `DEFAULT_ACTS`, some one-time.
- **Bonuses:** Perfect Day +25, 7-day streak of 100+ XP days +100, 30-day streak +500.
- **The game day resets at 4 AM local time.**
- **Other features:** favorites, custom activities, XP overrides, hidden activities, undo, a history chart, and CSV export.
- **Storage:** the app calls `window.claude.use('db')` and `window.claude.use('downloads')`. Those only exist inside claude.ai. Outside it, `db` is null and the app falls back to localStorage. Remove the claude.ai-specific code cleanly.
- **Style:** dark, muted retro pixel RPG, using the Press Start 2P and Pixelify Sans fonts. Keep this look. Do not make it brighter.

## Part 1: Make it a real installable app

1. Convert it into a **Progressive Web App** I can host for free on **GitHub Pages** and install to my iPhone home screen (Safari > Share > Add to Home Screen) and my Mac.
   - Add `manifest.json`, a service worker for full offline use, app icons (a pixel-art shield or XP-bar icon in the app's palette, all required sizes including apple-touch-icon), iOS meta tags, and standalone display mode.
   - Handle the iPhone notch and home bar with safe-area insets.
2. **Storage that doesn't lose my data.** Use IndexedDB (a small wrapper is fine) instead of localStorage, and request persistent storage.
   - Add **Export backup (JSON)** and **Import backup** buttons in Setup.
   - Add a "last backup" reminder that nudges me if I haven't exported in 7 days.
   - Keep the CSV export working with a normal download.
3. Walk me step by step through creating the GitHub repo, pushing, and turning on GitHub Pages. Assume I'm new to Git and GitHub. Tell me exactly what to click.
4. **Optional, ask me first:** cross-device sync between my phone and laptop with a free backend (Supabase or Firebase) and a simple login. Explain the tradeoffs before building it.

## Part 2: Make it better

Before building any of these, give me a short plan. Then implement them.

- **Character sheet screen:** avatar or pixel character that visually upgrades each tier, plus total stats (days active, best streak, most XP in a day, favorite activity, XP by tree as a pixel radar or bar chart).
- **Achievements / badges:** 30+ unlockable badges with pixel icons. Examples: first log, first 100-XP day, 7-day streak, each tier reached, each tree rank reached, 10 internship apps, first finished project, CSWA earned, 50 lifts.
- **Daily and weekly quests:** 3 rotating daily quests drawn from my own activities (e.g. "Log 2 study blocks", worth bonus XP) and 1 weekly boss quest (e.g. "Send 5 internship apps this week", +150).
- **Calendar heatmap:** GitHub-style yearly grid of daily XP.
- **Weekly recap screen:** XP this week vs last, best day, tree breakdown, and an honest callout of which tree I neglected.
- **Logging past days:** log an activity to yesterday or an earlier date, with a date picker. Right now I can only log to today.
- **Quantity logging:** e.g. "3 study blocks" in one tap with a stepper.
- **Better feel:** smoother level-up animation, screen shake on rank up, a longer 8-bit fanfare for tier rank ups, and haptic feedback where supported (`navigator.vibrate`, graceful no-op on iOS).
- **Notifications (if possible on iOS PWA):** an evening reminder if I'm under 100 XP. If iOS limits this, tell me what's actually possible instead of faking it.
- **Settings:** editable daily target, start date, and day-reset hour.

## Rules

- Split the code into sensible files (`index.html`, `styles.css`, `app.js`, and more modules if useful) or use a lightweight build setup like Vite. Keep it simple enough that I can understand and edit it. I'm a mechanical engineering student learning to code.
- Keep all the existing leveling math and XP values exactly the same unless I ask to change them.
- Test the leveling math with a few unit tests (level from XP, tree costs, streak and bonus logic, 4 AM day boundary).
- It must work well at phone width first.
- After each major step, tell me how to preview it locally in my browser.
- When you finish, give me a short summary of what changed and anything I need to do manually.
