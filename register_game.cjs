const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = '/servers/cloud/hub.db';
console.log(`Connecting to Hub database at ${dbPath}...`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to Hub database:', err.message);
    process.exit(1);
  }
  console.log('Connected successfully.');
});

db.serialize(() => {
  // 1. Register RetroSweeper Application
  const appId = 'retrosweeper';
  
  db.get('SELECT id FROM apps WHERE id = ?', [appId], (err, row) => {
    if (err) {
      console.error('Error querying apps table:', err.message);
      process.exit(1);
    }

    if (row) {
      console.log(`Application "${appId}" is already registered in the Hub.`);
    } else {
      console.log(`Registering application "${appId}"...`);
      const now = new Date().toISOString();
      const appData = {
        id: appId,
        title: "RetroSweeper",
        developer: "KBS Cloud Games",
        publisher: "KBS Cloud",
        release_date: "June 2026",
        description: "Clear cyberpunk hazard fields, avoid glitch detonations, and compete with other sweepers in this retro-logic puzzle game.",
        full_description: "Welcome to RetroSweeper, a cyberpunk logic puzzle of hazard sweep and grid clearance. Decode neon indicators, set holographic warning beacons, and race your fellow sweepers to identify all active cyber-mines before they detonate.",
        tags: JSON.stringify(["Puzzle", "Logic", "Multiplayer", "Cyberpunk", "Retro"]),
        features: JSON.stringify([
          "Real-time multi-sweeper presence tracking",
          "Co-op and Speed-Sweep Versus logic",
          "CRT glitch screen detonation simulation",
          "KBS Cloud achievements integration"
        ]),
        system_requirements: JSON.stringify({
          os: "Ubuntu 22.04+, Windows 10/11, macOS 12+",
          cpu: "Intel Core i5 / AMD Ryzen 5 or better",
          memory: "4 GB RAM",
          graphics: "Integrated Graphics",
          storage: "100 MB available space"
        }),
        prod_url: "https://retrosweeper.kbs-cloud.com",
        dev_url: "http://localhost:19006", // Point dev_url to the production frontend port since it's the port the user will access locally
        github_url: "https://github.com/kbs-cloud/retrosweeper",
        download_url: "https://github.com/kbs-cloud/retrosweeper/releases",
        cover_image: "/retrosweeper_cover.png",
        icon: "🎛️",
        is_online: 1,
        is_multiplayer: 1,
        app_token: "retrosweeper_token_dev_777",
        created_at: now,
        updated_at: now
      };

      const fields = Object.keys(appData);
      const placeholders = fields.map(() => '?').join(', ');
      const sql = `INSERT INTO apps (${fields.join(', ')}) VALUES (${placeholders})`;
      
      db.run(sql, Object.values(appData), (insErr) => {
        if (insErr) {
          console.error('Failed to register application:', insErr.message);
          process.exit(1);
        }
        console.log(`Application "${appId}" registered successfully.`);
      });
    }
  });

  // 2. Register Achievements
  const achievements = [
    {
      id: 'retrosweeper_flawless_sweep',
      app_id: appId,
      title: "Flawless Sweep",
      description: "Cleared a RetroSweeper grid with zero incorrect flags.",
      icon: "🚩",
      xp_value: 100,
      hidden: 0
    },
    {
      id: 'retrosweeper_glitch_survivor',
      app_id: appId,
      title: "Glitch Survivor",
      description: "Successfully cleared a hazard field after surviving a cyber-mine CRT detonation.",
      icon: "💥",
      xp_value: 200,
      hidden: 0
    }
  ];

  achievements.forEach((ach) => {
    db.get('SELECT id FROM achievements WHERE id = ?', [ach.id], (err, row) => {
      if (err) {
        console.error(`Error querying achievements for ${ach.id}:`, err.message);
        return;
      }

      if (row) {
        console.log(`Achievement "${ach.id}" is already registered.`);
      } else {
        console.log(`Registering achievement "${ach.id}"...`);
        const now = new Date().toISOString();
        db.run(
          'INSERT INTO achievements (id, app_id, title, description, icon, xp_value, hidden, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [ach.id, ach.app_id, ach.title, ach.description, ach.icon, ach.xp_value, ach.hidden, now],
          (insErr) => {
            if (insErr) {
              console.error(`Failed to register achievement "${ach.id}":`, insErr.message);
            } else {
              console.log(`Achievement "${ach.id}" registered successfully.`);
            }
          }
        );
      }
    });
  });
});
