(() => {
  "use strict";

  const SUPABASE_URL = "https://yiqxylckxkjnmenmykik.supabase.co";
  const SUPABASE_KEY = "sb_publishable_8tH2zh33We3vWO7sk9vrtA_VUWQH9NX";
  const SCORE_TABLE = "travel_universe_scores";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const worlds = [
    { name: "Grasslands", need: 0, mult: 1, sky: "#87ceeb", ground: "#45a049" },
    { name: "Desert", need: 1000, mult: 2, sky: "#f1cf72", ground: "#c49a35" },
    { name: "Snow", need: 5000, mult: 4, sky: "#d8f0ff", ground: "#e7f7ff" },
    { name: "Volcano", need: 15000, mult: 7, sky: "#6f2d1f", ground: "#2c1b17" },
    { name: "City", need: 40000, mult: 12, sky: "#8892a0", ground: "#444" },
    { name: "Cyber", need: 100000, mult: 20, sky: "#10102f", ground: "#15206e" },
    { name: "Space", need: 250000, mult: 40, sky: "#050518", ground: "#333" },
    { name: "Nebula", need: 600000, mult: 80, sky: "#4b1d66", ground: "#251032" },
    { name: "Black Hole", need: 1500000, mult: 150, sky: "#050505", ground: "#141414" },
    { name: "Universe's End", need: 4000000, mult: 300, sky: "#000", ground: "#2a002a" }
  ];

  const skins = [
    { id: "blue", name: "Blue", color: "#2288ff", cost: 0 },
    { id: "gold", name: "Gold", color: "#ffd700", cost: 5000 },
    { id: "red", name: "Red", color: "#ff3333", cost: 15000 },
    { id: "lime", name: "Lime", color: "#66ff44", cost: 50000 },
    { id: "matrix", name: "Matrix", color: "#00ffaa", cost: 200000 },
    { id: "void", name: "Void", color: "#662299", cost: 1000000 }
  ];

  const boostDefs = [
    { id: "money", name: "2x Money (2 min)", cost: 2500, duration: 120 },
    { id: "speed", name: "2x Speed (1 min)", cost: 5000, duration: 60 },
    { id: "damage", name: "2x Damage (2 min)", cost: 7500, duration: 120 }
  ];

  const defaultSave = {
    money: 0,
    runDistance: 0,
    bestDistance: 0,
    totalDistance: 0,
    speedLevel: 0,
    incomeLevel: 0,
    rockLevel: 0,
    rebirths: 0,
    ownedSkins: ["blue"],
    skin: "blue",
    boosts: { money: 0, speed: 0, damage: 0 },
    usedCodes: [],
    playerName: "CubePlayer"
  };

  let save = loadSave();
  let pausedByCrush = false;
  let lastTime = performance.now();
  let zombieTimer = 0;
  let eventTimer = 35;
  let activeEvent = null;
  let bullets = [];
  let zombies = [];
  let particles = [];
  let screenShake = 0;

  const player = { x: 250, y: 390, size: 34 };
  const boulder = { x: 35, y: 374, radius: 54 };

  function loadSave() {
    try {
      const data = JSON.parse(localStorage.getItem("ttdu.save.v1"));
      return { ...structuredClone(defaultSave), ...(data || {}), boosts: { ...defaultSave.boosts, ...(data?.boosts || {}) } };
    } catch {
      return structuredClone(defaultSave);
    }
  }

  function persist() {
    localStorage.setItem("ttdu.save.v1", JSON.stringify(save));
  }

  function speedBase() { return 1 + save.speedLevel * 0.18; }
  function speedMultiplier() { return (1 + save.rebirths * 0.05) * (save.boosts.speed > 0 ? 2 : 1); }
  function actualSpeed() { return speedBase() * speedMultiplier(); }
  function incomeBase() { return 1 + save.incomeLevel * 2.5; }
  function currentWorldIndex() {
    let idx = 0;
    worlds.forEach((w, i) => { if (save.bestDistance >= w.need) idx = i; });
    return idx;
  }
  function moneyMultiplier() {
    const eventMult = activeEvent?.type === "money" ? 3 : 1;
    return worlds[currentWorldIndex()].mult * (save.boosts.money > 0 ? 2 : 1) * eventMult;
  }
  function incomePerSecond() { return incomeBase() * moneyMultiplier(); }
  function rockLimit() { return 250 + save.rockLevel * 175; }
  function rebirthNeed() { return Math.floor(1200 * Math.pow(1.72, save.rebirths)); }
  function speedCost() { return Math.floor(25 * Math.pow(1.55, save.speedLevel)); }
  function incomeCost() { return Math.floor(35 * Math.pow(1.58, save.incomeLevel)); }
  function rockCost() { return Math.floor(60 * Math.pow(1.62, save.rockLevel)); }
  function skinColor() { return skins.find(s => s.id === save.skin)?.color || "#2288ff"; }

  function spend(cost) {
    if (save.money < cost) return false;
    save.money -= cost;
    persist();
    return true;
  }

  function formatNumber(n) {
    if (n < 1000) return Math.floor(n).toLocaleString();
    const units = ["K", "M", "B", "T", "Qa", "Qi"];
    let value = n;
    let i = -1;
    while (value >= 1000 && i < units.length - 1) { value /= 1000; i++; }
    return value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2) + units[i];
  }

  function formatDistance(m) {
    if (m < 1000) return Math.floor(m) + " m";
    return (m / 1000).toFixed(m < 10000 ? 2 : 1) + " km";
  }

  function spawnZombie() {
    const world = currentWorldIndex();
    const hp = 1 + Math.floor(world / 2) + Math.floor(save.rebirths / 4);
    zombies.push({
      x: canvas.width + 40,
      y: 350 + Math.random() * 115,
      size: 26 + Math.random() * 10,
      hp,
      maxHp: hp,
      speed: 35 + world * 5 + Math.random() * 22,
      reward: (15 + world * 10) * worlds[world].mult
    });
  }

  function shoot(clientX, clientY) {
    if (pausedByCrush) return;
    const rect = canvas.getBoundingClientRect();
    const tx = (clientX - rect.left) * canvas.width / rect.width;
    const ty = (clientY - rect.top) * canvas.height / rect.height;
    const px = player.x + player.size / 2;
    const py = player.y + player.size / 2;
    const angle = Math.atan2(ty - py, tx - px);
    bullets.push({ x: px, y: py, vx: Math.cos(angle) * 650, vy: Math.sin(angle) * 650, life: 1.4 });
  }

  canvas.addEventListener("pointerdown", e => shoot(e.clientX, e.clientY));

  function crush() {
    pausedByCrush = true;
    screenShake = 14;
    save.runDistance = 0;
    zombies = [];
    bullets = [];
    persist();
    document.getElementById("crushMessage").hidden = false;
  }

  document.getElementById("continueBtn").addEventListener("click", () => {
    pausedByCrush = false;
    document.getElementById("crushMessage").hidden = true;
  });

  function triggerEvent() {
    const choices = [
      { type: "money", name: "Money Storm: 3x money", duration: 25 },
      { type: "speed", name: "Speed Surge: 50% faster", duration: 20 },
      { type: "zombies", name: "Zombie Parade: more zombies", duration: 22 },
      { type: "safe", name: "Rock Freeze: boulder pauses", duration: 18 }
    ];
    activeEvent = choices[Math.floor(Math.random() * choices.length)];
    const banner = document.getElementById("eventBanner");
    banner.textContent = activeEvent.name;
    banner.hidden = false;
    setTimeout(() => { banner.hidden = true; }, 3500);
  }

  function update(dt) {
    if (pausedByCrush) return;

    Object.keys(save.boosts).forEach(k => save.boosts[k] = Math.max(0, save.boosts[k] - dt));

    eventTimer -= dt;
    if (eventTimer <= 0) {
      triggerEvent();
      eventTimer = 45 + Math.random() * 35;
    }
    if (activeEvent) {
      activeEvent.duration -= dt;
      if (activeEvent.duration <= 0) activeEvent = null;
    }

    const eventSpeed = activeEvent?.type === "speed" ? 1.5 : 1;
    const distanceGain = actualSpeed() * eventSpeed * 18 * dt;
    save.runDistance += distanceGain;
    save.totalDistance += distanceGain;
    save.bestDistance = Math.max(save.bestDistance, save.runDistance);
    save.money += incomePerSecond() * dt;

    zombieTimer -= dt;
    const spawnRate = activeEvent?.type === "zombies" ? 0.45 : Math.max(0.8, 2.2 - currentWorldIndex() * 0.11);
    if (zombieTimer <= 0) {
      spawnZombie();
      zombieTimer = spawnRate;
    }

    const rockProgress = save.runDistance / rockLimit();
    if (activeEvent?.type !== "safe") {
      boulder.x = 35 + Math.min(175, rockProgress * 175);
    }
    if (save.runDistance >= rockLimit()) crush();

    bullets.forEach(b => { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; });
    bullets = bullets.filter(b => b.life > 0 && b.x < canvas.width + 20 && b.y > -20 && b.y < canvas.height + 20);

    zombies.forEach(z => {
      const angle = Math.atan2(player.y - z.y, player.x - z.x);
      z.x += Math.cos(angle) * z.speed * dt;
      z.y += Math.sin(angle) * z.speed * dt;
    });

    for (const b of bullets) {
      for (const z of zombies) {
        if (z.hp <= 0) continue;
        if (Math.hypot(b.x - z.x, b.y - z.y) < z.size / 2 + 5) {
          b.life = 0;
          z.hp -= save.boosts.damage > 0 ? 2 : 1;
          if (z.hp <= 0) {
            save.money += z.reward;
            for (let i = 0; i < 8; i++) particles.push({ x: z.x, y: z.y, vx: (Math.random()-.5)*150, vy: (Math.random()-.5)*150, life: .45 });
          }
        }
      }
    }
    zombies = zombies.filter(z => z.hp > 0 && z.x > -50);

    for (const z of zombies) {
      if (Math.abs(z.x - player.x) < (z.size + player.size) / 2 && Math.abs(z.y - player.y) < (z.size + player.size) / 2) {
        save.money = Math.max(0, save.money - Math.max(10, incomePerSecond() * 3));
        z.hp = 0;
        screenShake = 7;
      }
    }

    particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; });
    particles = particles.filter(p => p.life > 0);

    if (Math.random() < 0.02) persist();
  }

  function drawBackground(world) {
    ctx.fillStyle = world.sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = world.ground;
    ctx.fillRect(0, 420, canvas.width, 120);

    ctx.fillStyle = "rgba(255,255,255,.55)";
    for (let i = 0; i < 10; i++) {
      const x = (i * 170 - (save.runDistance * .5) % 170);
      ctx.fillRect(x, 455, 80, 5);
    }

    if (currentWorldIndex() >= 6) {
      ctx.fillStyle = "white";
      for (let i = 0; i < 60; i++) {
        const x = (i * 83) % canvas.width;
        const y = (i * 47) % 330;
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }

  function draw() {
    const world = worlds[currentWorldIndex()];
    ctx.save();
    if (screenShake > 0) {
      ctx.translate((Math.random()-.5)*screenShake, (Math.random()-.5)*screenShake);
      screenShake *= .84;
      if (screenShake < .2) screenShake = 0;
    }

    drawBackground(world);

    ctx.fillStyle = "#666";
    ctx.beginPath(); ctx.arc(boulder.x, boulder.y, boulder.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#333"; ctx.lineWidth = 5; ctx.stroke();

    ctx.fillStyle = skinColor();
    ctx.fillRect(player.x, player.y, player.size, player.size);
    ctx.strokeStyle = "black";
    ctx.strokeRect(player.x, player.y, player.size, player.size);

    ctx.fillStyle = "black";
    ctx.fillRect(player.x + 18, player.y + 11, 28, 7);

    bullets.forEach(b => {
      ctx.fillStyle = "#ffeb3b";
      ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI * 2); ctx.fill();
    });

    zombies.forEach(z => {
      ctx.fillStyle = "#3f9b45";
      ctx.fillRect(z.x - z.size/2, z.y - z.size/2, z.size, z.size);
      ctx.fillStyle = "#111";
      ctx.fillRect(z.x - 8, z.y - 8, 5, 5);
      ctx.fillRect(z.x + 3, z.y - 8, 5, 5);
      ctx.fillStyle = "#b00";
      ctx.fillRect(z.x - z.size/2, z.y - z.size/2 - 8, z.size, 4);
      ctx.fillStyle = "#0f0";
      ctx.fillRect(z.x - z.size/2, z.y - z.size/2 - 8, z.size * (z.hp/z.maxHp), 4);
    });

    particles.forEach(p => {
      ctx.fillStyle = "#ffe066";
      ctx.fillRect(p.x, p.y, 4, 4);
    });

    ctx.fillStyle = "rgba(0,0,0,.65)";
    ctx.fillRect(10, 10, 355, 84);
    ctx.fillStyle = "white";
    ctx.font = "18px Arial";
    ctx.fillText(world.name + "  x" + world.mult + " money", 20, 35);
    ctx.fillText("Rock reaches you at: " + formatDistance(rockLimit()), 20, 60);
    ctx.fillText("Run: " + formatDistance(save.runDistance), 20, 84);

    ctx.restore();
  }

  function updateUI() {
    const world = worlds[currentWorldIndex()];
    document.getElementById("money").textContent = "$" + formatNumber(save.money);
    document.getElementById("distance").textContent = formatDistance(save.runDistance);
    document.getElementById("speedStat").textContent = actualSpeed().toFixed(2);
    document.getElementById("worldStat").textContent = (currentWorldIndex()+1) + " - " + world.name;
    document.getElementById("rebirthStat").textContent = save.rebirths;
    document.getElementById("speedInfo").textContent = `Speed upgrade: $${formatNumber(speedCost())}`;
    document.getElementById("incomeInfo").textContent = `Money/sec upgrade: $${formatNumber(incomeCost())} — currently $${formatNumber(incomePerSecond())}/sec`;
    document.getElementById("rockInfo").textContent = `Rock distance upgrade: $${formatNumber(rockCost())} — crush point ${formatDistance(rockLimit())}`;
    document.getElementById("rebirthInfo").textContent = `Next rebirth requires ${formatDistance(rebirthNeed())} — permanent +5% speed`;
    const activeBoosts = Object.entries(save.boosts).filter(([,v]) => v > 0).map(([k,v]) => `${k}: ${Math.ceil(v)}s`).join(", ");
    document.getElementById("boostInfo").textContent = activeBoosts ? `Boosts: ${activeBoosts}` : "Boosts: none";
    document.getElementById("rebirthBtn").disabled = save.runDistance < rebirthNeed();
  }

  function loop(now) {
    const dt = Math.min(.05, (now - lastTime) / 1000);
    lastTime = now;
    update(dt);
    draw();
    updateUI();
    requestAnimationFrame(loop);
  }

  document.getElementById("upgradeSpeed").addEventListener("click", () => { const c=speedCost(); if(spend(c)){ save.speedLevel++; persist(); } });
  document.getElementById("upgradeIncome").addEventListener("click", () => { const c=incomeCost(); if(spend(c)){ save.incomeLevel++; persist(); } });
  document.getElementById("upgradeRock").addEventListener("click", () => { const c=rockCost(); if(spend(c)){ save.rockLevel++; persist(); } });
  document.getElementById("rebirthBtn").addEventListener("click", () => {
    if (save.runDistance < rebirthNeed()) return;
    save.rebirths++;
    save.runDistance = 0;
    zombies = [];
    bullets = [];
    persist();
  });

  function openDialog(id) { document.getElementById(id).showModal(); }
  document.getElementById("shopBtn").addEventListener("click", () => { renderShop(); openDialog("shopDialog"); });
  document.getElementById("codesBtn").addEventListener("click", () => openDialog("codesDialog"));
  document.getElementById("leaderboardBtn").addEventListener("click", () => { document.getElementById("playerName").value = save.playerName; openDialog("leaderboardDialog"); loadScores(); });
  document.getElementById("helpBtn").addEventListener("click", () => openDialog("helpDialog"));
  document.querySelectorAll("[data-close]").forEach(btn => btn.addEventListener("click", () => document.getElementById(btn.dataset.close).close()));

  function renderShop() {
    const skinList = document.getElementById("skinList");
    skinList.innerHTML = "";
    skins.forEach(skin => {
      const owned = save.ownedSkins.includes(skin.id);
      const item = document.createElement("div");
      item.className = "shop-item";
      item.innerHTML = `<b>${skin.name}</b><p>Cost: $${formatNumber(skin.cost)}</p>`;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = owned ? (save.skin === skin.id ? "Equipped" : "Equip") : "Buy";
      button.disabled = save.skin === skin.id;
      button.addEventListener("click", () => {
        if (!owned) {
          if (!spend(skin.cost)) return;
          save.ownedSkins.push(skin.id);
        }
        save.skin = skin.id;
        persist();
        renderShop();
      });
      item.appendChild(button);
      skinList.appendChild(item);
    });

    const boostList = document.getElementById("boostList");
    boostList.innerHTML = "";
    boostDefs.forEach(boost => {
      const item = document.createElement("div");
      item.className = "shop-item";
      item.innerHTML = `<b>${boost.name}</b><p>Cost: $${formatNumber(boost.cost)}</p>`;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Buy";
      button.addEventListener("click", () => {
        if (!spend(boost.cost)) return;
        save.boosts[boost.id] += boost.duration;
        persist();
        renderShop();
      });
      item.appendChild(button);
      boostList.appendChild(item);
    });
  }

  const codeRewards = {
    "FIRSTSTEP": { money: 2500, message: "+$2,500" },
    "BIGROCK": { money: 5000, rock: 1, message: "+$5,000 and +1 rock distance level" },
    "CUBEPOWER": { money: 10000, speed: 1, message: "+$10,000 and +1 speed level" }
  };

  document.getElementById("redeemCode").addEventListener("click", () => {
    const code = document.getElementById("codeInput").value.trim().toUpperCase();
    const out = document.getElementById("codeMessage");
    if (!codeRewards[code]) { out.textContent = "Invalid code."; return; }
    if (save.usedCodes.includes(code)) { out.textContent = "That code was already used."; return; }
    const r = codeRewards[code];
    save.money += r.money || 0;
    save.rockLevel += r.rock || 0;
    save.speedLevel += r.speed || 0;
    save.usedCodes.push(code);
    persist();
    out.textContent = "Redeemed: " + r.message;
  });

  async function loadScores() {
    const list = document.getElementById("leaderboardList");
    const msg = document.getElementById("leaderboardMessage");
    list.innerHTML = "";
    msg.textContent = "Loading...";
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${SCORE_TABLE}?select=name,distance,rebirths&order=distance.desc&limit=20`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      });
      if (!response.ok) throw new Error(await response.text());
      const rows = await response.json();
      rows.forEach(row => {
        const li = document.createElement("li");
        li.textContent = `${row.name} — ${formatDistance(Number(row.distance))} — ${row.rebirths} rebirths`;
        list.appendChild(li);
      });
      msg.textContent = rows.length ? "Top distances" : "No scores yet.";
    } catch (error) {
      msg.textContent = "Leaderboard table is not ready yet. See SUPABASE-SETUP.sql.";
      console.warn(error);
    }
  }

  async function submitScore() {
    const name = document.getElementById("playerName").value.trim().slice(0,20) || "CubePlayer";
    save.playerName = name;
    persist();
    const msg = document.getElementById("leaderboardMessage");
    msg.textContent = "Submitting...";
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${SCORE_TABLE}`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify({ name, distance: Math.floor(save.bestDistance), rebirths: save.rebirths, money: Math.floor(save.money) })
      });
      if (!response.ok) throw new Error(await response.text());
      msg.textContent = "Score submitted!";
      loadScores();
    } catch (error) {
      msg.textContent = "Could not submit. Make sure the Supabase SQL setup was run.";
      console.warn(error);
    }
  }

  document.getElementById("submitScore").addEventListener("click", submitScore);
  document.getElementById("refreshScores").addEventListener("click", loadScores);

  window.addEventListener("beforeunload", persist);
  setInterval(persist, 5000);
  requestAnimationFrame(loop);
})();
