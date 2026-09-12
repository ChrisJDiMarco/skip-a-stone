// Replay rules are immutable once published. Bump RULES when tuning physics.
export const RULES = 2;
export const STONES = Object.freeze({
  flat: { retention: 0.893, stabilityLoss: 0.064, tolerance: 1, lift: 0.06 },
  thin: { retention: 0.91, stabilityLoss: 0.052, tolerance: 0.74, lift: 0.055 },
  heavy: {
    retention: 0.934,
    stabilityLoss: 0.105,
    tolerance: 0.85,
    lift: 0.045,
  },
  jade: { retention: 0.901, stabilityLoss: 0.07, tolerance: 1.12, lift: 0.057 },
  quartz: { retention: 0.916, stabilityLoss: 0.09, tolerance: 0.95, lift: 0.073 },
  obsidian: { retention: 0.926, stabilityLoss: 0.048, tolerance: 0.58, lift: 0.048 },
  granite: { retention: 0.92, stabilityLoss: 0.083, tolerance: 1.05, lift: 0.062 },
});
export const roundFinished = (replay, playTime) => !!replay && playTime > replay.duration + 0.22;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function shot(input) {
  if (
    !input ||
    typeof input.stone !== "string" ||
    !Object.hasOwn(STONES, input.stone) ||
    !["standard", "relaxed"].includes(input.mode)
  )
    throw Error("Unknown stone or timing mode.");
  for (const k of ["power", "heading", "tilt"])
    if (!Number.isFinite(input[k])) throw Error("Invalid throw.");
  for (const k of ["body", "phase"])
    if (input[k] !== undefined && !Number.isFinite(input[k]))
      throw Error("Invalid throw.");
  return Object.freeze({
    stone: input.stone,
    mode: input.mode,
    power: Math.round(clamp(input.power, 0.1, 1) * 1000) / 1000,
    heading: Math.round(clamp(input.heading, -0.4, 0.7) * 1000) / 1000,
    body: Math.round(clamp(input.body ?? 0, -1, 1) * 1000) / 1000,
    phase: Math.round(clamp(input.phase ?? 0, 0, 1000) * 1000) / 1000,
    tilt: Math.round(clamp(input.tilt, -1, 1) * 1000) / 1000,
  });
}
export function simulate(input) {
  const s = shot(input),
    p = STONES[s.stone],
    dt = 1 / 120;
  const quality = clamp(
    1 - Math.abs(s.tilt) / p.tolerance - Math.abs(s.body) * 0.45,
    0,
    1,
  );
  let speed = (9 + s.power * 26) * (s.stone === "heavy" ? 1.45 : 1),
    vx = Math.sin(s.heading + s.body * 0.12) * speed,
    vz = -Math.cos(s.heading + s.body * 0.12) * speed;
  let x = -3,
    y = 0.13,
    z = 3,
    vy = -0.3,
    stability = 0.25 + quality * 0.79;
  let t = 0,
    skips = 0,
    first = null,
    last = null,
    done = false;
  const hits = [];
  const samples = [{ t, x, y, z }],
    events = [];
  for (let i = 0; i < 1800 && !done; i++) {
    t += dt;
    x += vx * dt;
    z += vz * dt;
    vy -= 9.81 * dt;
    y += vy * dt;
    if (y <= 0.035 && vy < 0) {
      y = 0.035;
      speed = Math.hypot(vx, vz);
      if (!first) first = { x, z };
      last = { x, z };
      const incidence = Math.atan2(-vy, speed);
      const rebound =
        speed > 4.2 && stability > 0.23 && incidence < 0.46 + quality * 0.14;
      if (rebound) {
        skips++;
        const retain = p.retention - (1 - quality) * 0.115;
        vx *= retain;
        vz *= retain;
        vy = Math.max(0.4, speed * p.lift * stability + Math.abs(vy) * 0.12);
        stability -=
          p.stabilityLoss +
          (1 - quality) * 0.095 +
          Math.max(0, s.power - 0.78) * 0.045;
        events.push({ t, x, z, kind: "skip", count: skips, energy: speed });
      } else {
        events.push({ t, x, z, kind: "sink", count: skips, energy: speed });
        done = true;
      }
    }
    for (const target of TARGETS) {
      if (hits.some((h) => h.id === target.id)) continue;
      const boat = targetPosition(target, s.phase + t);
      if (y < 1.15 && Math.hypot(x - boat.x, z - boat.z) < target.radius) {
        hits.push({
          id: target.id,
          t,
          x: boat.x,
          z: boat.z,
          points: target.points,
        });
      }
    }
    samples.push({ t, x, y, z });
  }
  if (!done) {
    const q = samples.at(-1);
    events.push({
      t: q.t,
      x: q.x,
      z: q.z,
      kind: "sink",
      count: skips,
      energy: 0,
    });
  }
  return {
    input: s,
    hits,
    points: hits.reduce((sum, h) => sum + h.points, 0),
    samples,
    events,
    skips,
    distanceCm:
      first && last
        ? Math.round(Math.hypot(last.x - first.x, last.z - first.z) * 100)
        : 0,
    duration: t,
  };
}
export function positionAt(replay, t) {
  const a = replay.samples;
  const f = clamp(t * 120, 0, a.length - 1),
    i = Math.floor(f),
    j = Math.min(i + 1, a.length - 1),
    m = f - i;
  return {
    x: a[i].x + (a[j].x - a[i].x) * m,
    y: a[i].y + (a[j].y - a[i].y) * m,
    z: a[i].z + (a[j].z - a[i].z) * m,
  };
}
export const category = (s) => `${RULES}:calm:${s.stone}:${s.mode}`;
export const compare = (a, b) =>
  a.skips - b.skips || a.distanceCm - b.distanceCm;
export function encodeChallenge(s, name = "Friend") {
  const v = {
    v: 1,
    r: RULES,
    c: "calm",
    s: shot(s),
    n: String(name).trim().slice(0, 24) || "Friend",
  };
  const bytes = new TextEncoder().encode(JSON.stringify(v));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
export function decodeChallenge(raw) {
  if (
    typeof raw !== "string" ||
    raw.length > 2048 ||
    !raw.length ||
    !/^[A-Za-z0-9_-]+$/.test(raw)
  )
    throw Error("This challenge link is incomplete or invalid.");
  let v;
  try {
    v = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        Uint8Array.from(
          atob(raw.replaceAll("-", "+").replaceAll("_", "/")),
          (c) => c.charCodeAt(0),
        ),
      ),
    );
  } catch {
    throw Error("This challenge link is incomplete or invalid.");
  }
  if (
    !v ||
    typeof v !== "object" ||
    Array.isArray(v) ||
    Object.keys(v).some((k) => !["v", "r", "c", "s", "n"].includes(k))
  )
    throw Error("Invalid challenge.");
  if (v.v !== 1 || v.r !== RULES)
    throw Error(
      "This challenge uses a different game version. You can still play freely.",
    );
  if (v.c !== "calm" || typeof v.n !== "string" || v.n.length > 24 || !v.s)
    throw Error("Invalid challenge.");
  if (
    typeof v.s !== "object" ||
    Array.isArray(v.s) ||
    Object.keys(v.s).some(
      (k) =>
        ![
          "stone",
          "mode",
          "power",
          "heading",
          "tilt",
          "body",
          "phase",
        ].includes(k),
    )
  )
    throw Error("Invalid challenge throw.");
  for (const [k, a, b] of [
    ["power", 0.1, 1],
    ["heading", -0.4, 0.7],
    ["tilt", -1, 1],
    ["body", -1, 1],
    ["phase", 0, 1000],
  ])
    if (!Number.isFinite(v.s[k]) || v.s[k] < a || v.s[k] > b)
      throw Error("Invalid challenge throw.");
  return {
    name: v.n.replace(/[\x00-\x1f\x7f]/g, "").trim() || "Friend",
    shot: shot(v.s),
  };
}

// Shared paths make the visible boats and scored collisions agree exactly.
export const TARGETS = Object.freeze([
  {
    id: "coral",
    x: -3,
    z: -10,
    amplitude: 3,
    rate: 0.55,
    offset: 0,
    radius: 1.2,
    points: 100,
    color: 0xf57e63,
  },
  {
    id: "cream",
    x: 3,
    z: -20,
    amplitude: 4,
    rate: -0.42,
    offset: 1.7,
    radius: 1.15,
    points: 150,
    color: 0xffdf96,
  },
  {
    id: "blue",
    x: 10,
    z: -31,
    amplitude: 4.5,
    rate: 0.36,
    offset: 3.4,
    radius: 1.1,
    points: 200,
    color: 0x8bc8dc,
  },
  {
    id: "gold",
    x: 16,
    z: -43,
    amplitude: 5,
    rate: -0.3,
    offset: 0.8,
    radius: 1,
    points: 300,
    color: 0xfcc457,
  },
]);
export function targetPosition(target, t) {
  return {
    x: target.x + Math.sin(t * target.rate + target.offset) * target.amplitude,
    y: 0.12,
    z: target.z,
  };
}
