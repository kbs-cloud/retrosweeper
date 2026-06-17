# 🎛️ RetroSweeper (Incubator ID #13)

RetroSweeper is a cyberpunk-themed, multiplayer hazard-detection logic game inspired by the classic Windows *Minesweeper*. It incorporates modern SSO login integration, active presence lobbies, and global high-score cataloging.

---

## 🎨 Visual Design & Theme

- **Cyberpunk Terminal**: Soft dark background (`#05030d`) with neon green, cyan, and red elements.
- **Dynamic Board**: Brushed alloy plates that glow when hovered or clicked.
- **Neon Danger**: Mine numbers glow with tailored colors (1=Cyan, 2=Lime, 3=Crimson, 4=Purple).
- **Detonation Glitch**: Triggering a mine causes a full-screen CRT monitor glitch shake and locks the player's terminal for 5 seconds.
- **Holographic Beacons**: Placing a flag projects a glowing red warning hazard icon.

---

## 🕹️ Controls

- **Left Click / Tap**: Clears/Reveals target grid sector.
- **Right Click / Long Press**: Toggles holographic flag warning beacon.
- **Double Click (on numbers)**: Chord sweeps adjacent cells if flagged count matches cell value.

---

## 📊 Database Schema (SQLite)

In addition to user SSO authentication and session handling, RetroSweeper tracks multiplayer lobbies in `retrosweeper.db`:

```sql
CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  display_name TEXT,
  password_hash TEXT,
  is_google_linked INTEGER DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  email TEXT,
  expires_at TEXT,
  csrf_token TEXT
);

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  invite_code TEXT UNIQUE,
  owner_email TEXT,
  name TEXT,
  game_state TEXT, -- JSON layout: { grid, width, height, mineCount, players: [{ id, name, score, glitchUntil }], firstClick, status }
  created_at TEXT,
  updated_at TEXT
);
```

---

## 🏆 Achievements

RetroSweeper integrates with the KBS Cloud Hub Achievements catalog:

1. **`retrosweeper_flawless_sweep`**: Clear a board with zero incorrect flags.
2. **`retrosweeper_glitch_survivor`**: Clear a board after triggering at least one CRT glitch.

---

## 🚀 Execution & Scripts

- **`npm run dev`**: Spawns the backend Express engine concurrently with Vite.
- **`npm run build`**: Compiles the game state module and bundles client static files.
- **`npm run test`**: Runs Vitest unit specs and Playwright E2E browser tests.
- **`./deploy.sh`**: Deploys application to `/servers/retrosweeper` and sets up the systemd service.
