import { loadRockAssets } from "./rocks.js";
import { createRockInspector } from "./rock-inspector.js";
import { setupRadio } from "./radio.js";
import { createLake } from "./scene.js";
import {
  STONES,
  roundFinished,
  clamp,
  shot,
  simulate,
  category,
  compare,
  encodeChallenge,
  decodeChallenge,
} from "./simulation.js";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
let state = "loading",
  stone = "flat",
  mode = "standard",
  power = 0.65,
  heading = 0.65,
  tilt = 0,
  body = 0,
  targetClock = 0,
  lastHit = -1,
  prepStart = 0,
  playTime = 0,
  last = performance.now(),
  replay = null,
  ghost = null,
  challenge = null,
  records = {},
  lastEvent = -1,
  newBest = false,
  drag = null,
  toastTimer,
  storageOK = true,
  muted = false,
  audio = null,
  pausedForDialog = false;
const frameTimes = [];
let lake, inspector;
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#toast").hidden = true), 5500);
}
try {
  const raw = JSON.parse(localStorage.getItem("skip-stone-records-v1") || "{}");
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw).slice(0, 30)) {
      try {
        const s = shot(v);
        if (category(s) === k) records[k] = s;
      } catch {}
    }
  }
} catch {
  storageOK = false;
}
const currentInput = () => ({
  stone,
  mode,
  power,
  heading,
  tilt,
  body,
  phase: targetClock,
});
function best() {
  const s = records[category(currentInput())];
  return s ? simulate(s) : null;
}
function getGhost() {
  return challenge ? simulate(challenge.shot) : best();
}
const ghostName = () => (challenge ? challenge.name : "Your best");
function updateScore() {
  const g =
    replay && ghost && ["result", "flying", "paused"].includes(state)
      ? ghost
      : getGhost();
  $("#ghostScore").replaceChildren(
    document.createTextNode(
      challenge
        ? `${challenge.name.length > 12 ? challenge.name.slice(0, 12).toUpperCase() + "…" : challenge.name.toUpperCase()}'S BEST `
        : "YOUR BEST ",
    ),
  );
  const b = document.createElement("b");
  b.textContent = g?.skips ?? "—";
  $("#ghostScore").append(b);
}
function setState(value) {
  state = value;
  document.body.className = value;
  $("#game").dataset.state = value;
  $("#result").hidden = value !== "result";
  $("#launch").disabled = !["ready", "preparing"].includes(value);
  $("#power").disabled = !["ready", "preparing"].includes(value);
  $$("[data-stone]").forEach(
    (b) => (b.disabled = !!challenge || !["ready", "result"].includes(value)),
  );
  $("#throw").textContent =
    value === "preparing"
      ? "Release stone"
      : value === "paused"
        ? "Resume"
        : value === "flying"
          ? "Watching your throw…"
          : "Prepare throw ↗";
  $("#throw").disabled = value === "flying";
  $("#timing").disabled = !!challenge;
}
function setPower(v) {
  power = clamp(v, 0.1, 1);
  $("#power").value = String(Math.round(power * 100));
  $("#powerValue").textContent = `${Math.round(power * 100)}%`;
  const band = 0.23 - power * 0.12;
  $("#sweet").style.left = `${50 - band * 50}%`;
  $("#sweet").style.width = `${band * 100}%`;
}
function selectStone(v) {
  if (typeof v !== "string" || !Object.hasOwn(STONES, v))
    throw Error("Unknown stone.");
  if (challenge) throw Error("Leave this challenge to change stones.");
  if (!["ready", "result"].includes(state))
    throw Error("Finish or cancel your throw first.");
  stone = v;
  $$("[data-stone]").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.stone === v)),
  );
  reset();
}
function initChallenge() {
  challenge = null;
  const raw = new URLSearchParams(location.hash.slice(1)).get("challenge");
  if (raw) {
    try {
      challenge = decodeChallenge(raw);
      stone = challenge.shot.stone;
      mode = challenge.shot.mode;
      targetClock = challenge.shot.phase;
      $("#challengeBar span").textContent =
        `${challenge.name}'s challenge · ${stone} · ${mode}`;
    } catch (e) {
      toast(e.message);
    }
  }
  $("#challengeBar").hidden = !challenge;
  $("#timing").value = mode;
  $$("[data-stone]").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.stone === stone)),
  );
}
function reset() {
  drag = null;
  delete $("#game").dataset.pull;
  replay = null;
  ghost = null;
  playTime = 0;
  lastEvent = -1;
  lastHit = -1;
  $("#points").textContent = "0";
  lake?.setReplay(null, null);
  $("#score").textContent = "0";
  $("#feedback").textContent = "";
  $("#floating").textContent = "";
  $("#ghostLabel").textContent = "";
  $("#instruction").textContent =
    "Drag to aim. Pull back for power. Release both markers in the green.";
  tilt = body = 0;
  $("#needle").style.left = "50%";
  $("#bodyNeedle").style.left = "50%";
  $("#angleValue").textContent = "18°";
  $("#bodyValue").textContent = "Centered";
  $("#angleMeter").setAttribute("aria-valuenow", "0");
  $("#bodyMeter").setAttribute("aria-valuenow", "0");
  setState("ready");
  setPower(power);
  updateScore();
  $$(".share").forEach((b) => (b.disabled = !best()));
}
function prepare() {
  if (state === "result") reset();
  if (state !== "ready") return false;
  prepStart = performance.now();
  setState("preparing");
  $("#feedback").textContent = "Find the green.";
  $("#instruction").textContent = "Set power. Match angle + body. Release.";
  unlockAudio();
  return true;
}
function currentTilt(now) {
  const cycle = mode === "relaxed" ? 3200 : 1600;
  const raw = Math.sin(((now - prepStart) / cycle) * Math.PI * 2 - 1.2);
  const band = 0.23 - power * 0.12;
  return {
    raw,
    tilt:
      Math.abs(raw) <= band
        ? 0
        : (Math.sign(raw) * (Math.abs(raw) - band)) / (1 - band),
  };
}
function currentBody(now) {
  const cycle = mode === "relaxed" ? 4300 : 2450;
  const raw = Math.sin(((now - prepStart) / cycle) * Math.PI * 2 - 0.8);
  const band = 0.22;
  return {
    raw,
    body:
      Math.abs(raw) < band
        ? 0
        : (Math.sign(raw) * (Math.abs(raw) - band)) / (1 - band),
  };
}
function release() {
  if (state !== "preparing") return false;
  tilt = currentTilt(performance.now()).tilt;
  body = currentBody(performance.now()).body;
  const s = shot(currentInput());
  ghost = getGhost();
  replay = simulate(s);
  playTime = 0;
  lastEvent = -1;
  newBest = false;
  lake.setReplay(replay, ghost);
  setState("flying");
  $("#feedback").textContent =
    Math.abs(tilt) < 0.08 && Math.abs(body) < 0.12
      ? "Perfect alignment."
      : Math.abs(tilt) < 0.4
        ? "Almost level."
        : "A little too tilted.";
  $("#instruction").textContent =
    `${stone[0].toUpperCase() + stone.slice(1)} stone · ${Math.round(power * 100)}% power`;
  $$(".share").forEach((b) => (b.disabled = true));
  return true;
}
function finish() {
  if (!replay || state === "result") return;
  const prior = best();
  newBest = !prior || compare(replay, prior) > 0;
  if (newBest) {
    records[category(replay.input)] = replay.input;
    try {
      localStorage.setItem("skip-stone-records-v1", JSON.stringify(records));
    } catch {
      storageOK = false;
      toast(
        "Your best is saved for this session. Device storage is unavailable.",
      );
    }
  }
  $("#score").textContent = replay.skips;
  $("#resultEyebrow").textContent = newBest
    ? "NEW PERSONAL BEST"
    : "YOUR THROW";
  $("#resultCount").textContent =
    `${replay.skips} ${replay.skips === 1 ? "skip" : "skips"}`;
  let message = `${(replay.distanceCm / 100).toFixed(1)} m across the lake.`;
  if (challenge && ghost) {
    const c = compare(replay, ghost);
    message =
      c > 0
        ? `You beat ${challenge.name}${replay.skips > ghost.skips ? ` by ${replay.skips - ghost.skips}` : " on distance"}.`
        : c === 0
          ? `You matched ${challenge.name}.`
          : `${challenge.name} leads${ghost.skips > replay.skips ? ` by ${ghost.skips - replay.skips}` : " on distance"}.`;
  }
  $("#resultMessage").textContent =
    `${message} ${replay.points} boat points · ${replay.hits.length} ${replay.hits.length === 1 ? "hit" : "hits"}.`;
  $("#resultDetail").textContent =
    `${Math.abs(replay.input.tilt) < 0.08 ? "Clean release" : Math.abs(replay.input.tilt) < 0.4 ? "Nearly level" : "Try a flatter release"} · ${Math.round(replay.input.power * 100)}% · ${(replay.distanceCm / 100).toFixed(1)} m`;
  setState("result");
  $("#resultCount").focus({ preventScroll: true });
  $$(".share").forEach((b) => (b.disabled = false));
  updateScore();
}
function cancel() {
  if (state === "preparing") {
    drag = null;
    reset();
    return;
  }
  if (state === "flying") {
    setState("paused");
    $("#feedback").textContent = "Paused. Press Space to continue.";
  } else if (state === "paused") {
    setState("flying");
    $("#feedback").textContent = "";
  }
}
function unlockAudio() {
  if (muted) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") audio.resume().catch(() => {});
  } catch {
    muted = true;
    toast("Sound is unavailable in this browser.");
  }
}
function splashSound(energy) {
  if (muted || !audio || audio.state !== "running") return;
  const count = Math.floor(audio.sampleRate * 0.12),
    buffer = audio.createBuffer(1, count, audio.sampleRate),
    data = buffer.getChannelData(0);
  for (let i = 0; i < count; i++)
    data[i] = (Math.random() * 2 - 1) * (1 - i / count) ** 2;
  const src = audio.createBufferSource();
  src.buffer = buffer;
  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 900 + energy * 45;
  const gain = audio.createGain();
  gain.gain.value = 0.1;
  src.connect(filter).connect(gain).connect(audio.destination);
  src.start();
  src.onended = () => {
    src.disconnect();
    filter.disconnect();
    gain.disconnect();
  };
}
function pointSound(points) {
  if (muted || !audio || audio.state !== "running") return;
  const start = audio.currentTime;
  [660, 880, points >= 200 ? 1320 : 1100].forEach((frequency, i) => {
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    const at = start + i * 0.075;
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.12, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.18);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.19);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  });
}
$("#launch").addEventListener("pointerdown", (e) => {
  if (e.button !== 0 || drag) return;
  e.preventDefault();
  if (!prepare() && state !== "preparing") return;
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
  $("#launch").setPointerCapture(e.pointerId);
});
$("#launch").addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x,
    dy = e.clientY - drag.y;
  drag.moved ||= Math.hypot(dx, dy) > 9;
  if (!drag.moved) return;
  $("#game").dataset.pull = `${e.clientX},${e.clientY}`;
  heading = clamp(Math.atan2(-dx, Math.max(35, dy)), -0.4, 0.7);
  setPower(
    0.1 +
      (Math.hypot(dx, Math.max(0, dy)) / Math.min(innerHeight * 0.24, 180)) *
        0.9,
  );
});
$("#launch").addEventListener("pointerup", (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const moved = drag.moved;
  delete $("#game").dataset.pull;
  drag = null;
  if ($("#launch").hasPointerCapture(e.pointerId))
    $("#launch").releasePointerCapture(e.pointerId);
  if (moved) release();
  // A click enters preparation; only a deliberate drag releases the stone.
});
for (const type of ["pointercancel", "lostpointercapture"])
  $("#launch").addEventListener(type, () => {
    if (drag) {
      drag = null;
      if (state === "preparing") reset();
    }
  });
$("#launch").addEventListener("click", (e) => {
  if (e.detail === 0) {
    if (state === "preparing") release();
    else prepare();
  }
});
$("#power").addEventListener("input", (e) =>
  setPower(Number(e.target.value) / 100),
);
$$("[data-stone]").forEach((b) =>
  b.addEventListener("click", () => inspector?.open(b.dataset.stone)),
);
$("#throw").onclick = () => {
  if (state === "paused") cancel();
  else if (state === "preparing") release();
  else prepare();
};
$("#again").onclick = reset;
$("#reset").onclick = reset;
addEventListener("keydown", (e) => {
  if (e.repeat || document.querySelector("dialog[open]")) return;
  const k = e.key;
  if (k === "Escape") {
    e.preventDefault();
    cancel();
    return;
  }
  if (/^(INPUT|SELECT|TEXTAREA|BUTTON|A)$/.test(e.target.tagName)) return;
  if (k === " ") {
    e.preventDefault();
    if (state === "paused") cancel();
    else if (state === "preparing") release();
    else if (["ready", "result"].includes(state)) prepare();
    return;
  }
  if (
    /^[1-7]$/.test(k) &&
    !challenge &&
    ["ready", "result"].includes(state)
  ) {
    selectStone(Object.keys(STONES)[Number(k) - 1]);
    return;
  }
  if (["ready", "preparing"].includes(state)) {
    if (k === "ArrowLeft" || k === "ArrowRight") {
      e.preventDefault();
      heading = clamp(
        heading + (k === "ArrowRight" ? 0.035 : -0.035),
        -0.4,
        0.7,
      );
    }
    if (k === "ArrowUp" || k === "ArrowDown") {
      e.preventDefault();
      setPower(power + (k === "ArrowUp" ? 0.05 : -0.05));
    }
  }
});
addEventListener("blur", () => {
  if (state === "preparing") reset();
  else if (state === "flying") cancel();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (state === "preparing") reset();
    else if (state === "flying") cancel();
  }
  last = performance.now();
});
$("#sound").onclick = () => {
  muted = !muted;
  $("#sound").setAttribute(
    "aria-label",
    muted ? "Turn sound on" : "Turn sound off",
  );
  $("#sound .off").hidden = !muted;
  unlockAudio();
};
function openSettings() {
  if (state === "preparing") reset();
  pausedForDialog = state === "flying";
  if (pausedForDialog) cancel();
  $("#settingsDialog").showModal();
}
$("#settings").onclick = openSettings;
$("#settingsDialog").addEventListener("close", () => {
  if (pausedForDialog && state === "paused") cancel();
  pausedForDialog = false;
});
$$("dialog .close").forEach(
  (b) => (b.onclick = () => b.closest("dialog").close()),
);
$(".close-settings").onclick = () => $("#settingsDialog").close();
$("#timing").onchange = () => {
  if (challenge) return;
  mode = $("#timing").value;
  reset();
};
$("#still").onchange = () =>
  lake.setStationary(
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
      $("#still").checked,
  );
$("#leave").onclick = () => {
  history.replaceState(null, "", location.pathname + location.search);
  challenge = null;
  $("#challengeBar").hidden = true;
  reset();
};
addEventListener("hashchange", () => {
  initChallenge();
  reset();
});
let shareShot = null;
$$(".share").forEach(
  (b) =>
    (b.onclick = () => {
      const r = best();
      if (!r) return;
      shareShot = r.input;
      $("#shareSummary").textContent =
        `${r.skips} skips · ${(r.distanceCm / 100).toFixed(1)} m · ${stone} stone · ${mode} timing`;
      $("#linkFallback").hidden = true;
      $("#shareDialog").showModal();
    }),
);
function shareURL() {
  if (!shareShot) throw Error("Complete a throw first.");
  return `${location.origin}${location.pathname}#challenge=${encodeChallenge(shareShot, $("#playerName").value)}`;
}
$("#copy").onclick = async () => {
  const url = shareURL();
  $("#challengeLink").value = url;
  try {
    await navigator.clipboard.writeText(url);
    $("#copy").textContent = "Link copied ✓";
    setTimeout(() => ($("#copy").textContent = "Copy challenge link"), 2000);
  } catch {
    $("#linkFallback").hidden = false;
    $("#challengeLink").focus();
    $("#challengeLink").select();
  }
};
$("#nativeShare").onclick = async () => {
  const url = shareURL();
  if (!navigator.share) {
    $("#linkFallback").hidden = false;
    $("#challengeLink").value = url;
    return;
  }
  try {
    await navigator.share({
      title: "Skip a stone. Beat my best.",
      text: "One more throw.",
      url,
    });
  } catch (e) {
    if (e.name !== "AbortError") {
      $("#linkFallback").hidden = false;
      $("#challengeLink").value = url;
    }
  }
};
function gameState() {
  const fps = frameTimes.length
    ? 1000 / (frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length)
    : 0;
  const sorted = [...frameTimes].sort((a, b) => a - b);
  return {
    state,
    stone,
    mode,
    power,
    heading,
    tilt: state === "preparing" ? currentTilt(performance.now()).tilt : tilt,
    body: state === "preparing" ? currentBody(performance.now()).body : body,
    points: Number($("#points").textContent),
    camera: $("#still").checked ? "shore" : "stone",
    skips: Number($("#score").textContent),
    best: best()?.skips ?? null,
    challenge: challenge?.name ?? null,
    sound: muted ? "off" : "on",
    audioState: audio?.state ?? "not-started",
    storage: storageOK ? "device" : "session",
    fps: Math.round(fps),
    p95FrameMs: Math.round(sorted[Math.floor(sorted.length * 0.95)] || 0),
    renderCalls: lake?.renderer.info.render.calls ?? 0,
    gpuGeometries: lake?.renderer.info.memory.geometries ?? 0,
    gpuTextures: lake?.renderer.info.memory.textures ?? 0,
  };
}
function registerTools() {
  if (!document.modelContext?.registerTool) return;
  const lifecycle = new AbortController();
  const defs = [
    {
      name: "get_game_state",
      description:
        "Read current stone, power, release tilt, skips and replay state.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: () => gameState(),
    },
    {
      name: "configure_throw",
      description:
        "Choose stone, timing, power and heading before preparing a throw. Does not throw.",
      inputSchema: {
        type: "object",
        properties: {
          stone: { enum: Object.keys(STONES) },
          mode: { enum: ["standard", "relaxed"] },
          power: { type: "number", minimum: 0.1, maximum: 1 },
          heading: { type: "number", minimum: -0.4, maximum: 0.7 },
        },
        additionalProperties: false,
      },
      execute: (i) => {
        if (
          !i ||
          typeof i !== "object" ||
          Array.isArray(i) ||
          Object.keys(i).some(
            (k) => !["stone", "mode", "power", "heading"].includes(k),
          )
        )
          throw Error("Invalid configuration.");
        if (!["ready", "result"].includes(state))
          throw Error("Finish or cancel the current throw.");
        if (
          (i.stone !== undefined &&
            (typeof i.stone !== "string" || !Object.hasOwn(STONES, i.stone))) ||
          (i.mode !== undefined && !["standard", "relaxed"].includes(i.mode)) ||
          (i.power !== undefined &&
            (!Number.isFinite(i.power) || i.power < 0.1 || i.power > 1)) ||
          (i.heading !== undefined &&
            (!Number.isFinite(i.heading) ||
              i.heading < -0.4 ||
              i.heading > 0.7))
        )
          throw Error("Configuration out of range.");
        if (
          challenge &&
          ((i.stone && i.stone !== stone) || (i.mode && i.mode !== mode))
        )
          throw Error("This challenge fixes stone and timing.");
        if (i.stone && !challenge) selectStone(i.stone);
        if (i.mode) {
          mode = i.mode;
          $("#timing").value = mode;
        }
        if (i.power !== undefined) setPower(i.power);
        if (i.heading !== undefined) heading = i.heading;
        reset();
        return gameState();
      },
    },
    {
      name: "prepare_throw",
      description:
        "Begin the visible timing gauge for a throw; release separately when level.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      execute: () => {
        if (!prepare()) throw Error("Cannot prepare now.");
        return gameState();
      },
    },
    {
      name: "release_stone",
      description:
        "Release the prepared stone at its current visible tilt. Starts the throw.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      execute: () => {
        if (!release()) throw Error("Prepare a throw first.");
        return gameState();
      },
    },
    {
      name: "reset_throw",
      description:
        "Cancel the current throw or return from results, preserving best scores.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      execute: () => {
        reset();
        return gameState();
      },
    },
  ];
  for (const d of defs) {
    try {
      Promise.resolve(
        document.modelContext.registerTool(d, { signal: lifecycle.signal }),
      ).catch(() => {});
    } catch {}
  }
  addEventListener("pagehide", () => lifecycle.abort(), { once: true });
}
try {
  const rocks = await loadRockAssets();
  lake = await createLake($("#view"), rocks);
  inspector = createRockInspector(rocks, selectStone);
  setupRadio(toast);
  $("#loading").remove();
  initChallenge();
  reset();
  registerTools();
  if (!storageOK)
    toast(
      "Device storage is unavailable. Best throws will last for this session.",
    );
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  $("#still").checked = reduce;
  lake.setStationary(reduce);
  lake.renderer.domElement.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    if (state === "preparing") reset();
    if (state === "flying") cancel();
    toast("The lake paused. Restoring the graphics…");
  });
  lake.renderer.domElement.addEventListener("webglcontextrestored", () =>
    location.reload(),
  );
  function frame(now) {
    const elapsed = now - last;
    last = now;
    if (elapsed > 0 && !document.hidden) {
      frameTimes.push(elapsed);
      if (frameTimes.length > 240) frameTimes.shift();
    }
    if (["ready", "preparing"].includes(state))
      targetClock =
        (targetClock + Math.min(elapsed / 1000, 0.08) * 0.36) % 1000;
    if (state === "preparing") {
      const alignment = currentBody(now);
      body = alignment.body;
      $("#bodyNeedle").style.left = `${(alignment.raw + 1) * 50}%`;
      $("#bodyValue").textContent =
        body === 0 ? "Centered" : body < 0 ? "Lean left" : "Lean right";
      $("#bodyMeter").setAttribute("aria-valuenow", Math.round(body * 100));
      const t = currentTilt(now);
      tilt = t.tilt;
      $("#needle").style.left = `${(t.raw + 1) * 50}%`;
      $("#angleValue").textContent = `${Math.round(18 + tilt * 14)}°`;
      $("#angleMeter").setAttribute("aria-valuenow", Math.round(tilt * 100));
      $("#feedback").textContent =
        tilt === 0 && body === 0
          ? "Together. Let it fly."
          : "Find your alignment.";
    }
    if (state === "flying") {
      playTime += Math.min(elapsed / 1000, 0.08) * 0.36;
      for (let i = lastEvent + 1; i < replay.events.length; i++) {
        const ev = replay.events[i];
        if (ev.t > playTime) break;
        lastEvent = i;
        $("#score").textContent = ev.count;
        splashSound(ev.energy);
      }
      for (let i = lastHit + 1; i < replay.hits.length; i++) {
        const hit = replay.hits[i];
        if (hit.t > playTime) break;
        lastHit = i;
        $("#points").textContent = replay.hits
          .slice(0, i + 1)
          .reduce((sum, h) => sum + h.points, 0);
        $("#feedback").textContent = `Boat hit! +${hit.points}`;
        pointSound(hit.points);
      }
      const sampleIndex = Math.min(
        replay.samples.length - 1,
        Math.floor(playTime * 120),
      );
      const a = replay.samples[Math.max(0, sampleIndex - 1)],
        b = replay.samples[sampleIndex];
      $("#speedValue").textContent =
        `${Math.round(playTime >= replay.duration ? 0 : Math.hypot(b.x - a.x, b.z - a.z) * 120 * 2.237)} mph`;
      $("#flightAngle").textContent =
        `${Math.round(18 + replay.input.tilt * 14)}°`;
      $("#flightSkips").textContent = $("#score").textContent;
      if (roundFinished(replay, playTime))
        finish();
    }
    const coords = lake.render(
      reduce ? 0 : now / 1000,
      playTime,
      state,
      heading,
      power,
      stone,
      targetClock,
    );
    if (coords?.launch && ["ready", "preparing"].includes(state)) {
      $("#launch").style.left = `${coords.launch.x}px`;
      $("#launch").style.top = `${coords.launch.y}px`;
      $("#launch").style.width = `${coords.launch.width}px`;
      $("#launch").style.height = `${coords.launch.height}px`;
      $("#aimReadout").textContent =
        `${Math.round((heading * 180) / Math.PI)}° aim`;
      $("#aimReadout").style.left = `${coords.launch.x + 70}px`;
      $("#aimReadout").style.top = `${coords.launch.y - 70}px`;
    }
    if (coords && ["flying", "paused", "result"].includes(state)) {
      const count = Number($("#score").textContent);
      $("#floating").textContent = count
        ? `${state === "result" ? "⚑ You · " : ""}${count}`
        : "";
      $("#floating").style.left = `${coords.player.x}px`;
      $("#floating").style.top = `${coords.player.y}px`;
      $("#floating").hidden = !coords.player.visible;
      $("#ghostLabel").hidden = !coords.ghost;
      if (coords.ghost && ghost) {
        $("#ghostLabel").textContent =
          `${ghostName()} · ${state === "result" ? ghost.skips : ghost.events.filter((e) => e.kind === "skip" && e.t <= playTime).length}`;
        $("#ghostLabel").style.left = `${coords.ghost.x}px`;
        $("#ghostLabel").style.top = `${coords.ghost.y - 18}px`;
        $("#ghostLabel").hidden = !coords.ghost.visible;
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
} catch (e) {
  console.error("Lake initialization failed", e);
  $("#loading").replaceChildren();
  const p = document.createElement("p");
  p.textContent =
    "The lake could not load. Check your connection and try again.";
  const b = document.createElement("button");
  b.className = "primary";
  b.textContent = "Try again";
  b.onclick = () => location.reload();
  $("#loading").append(p, b);
}
