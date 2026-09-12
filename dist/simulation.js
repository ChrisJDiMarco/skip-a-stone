// Replay rules are immutable once published. Bump RULES when tuning physics.
export const RULES = 1;
export const STONES = Object.freeze({
  flat: { retention: 0.893, stabilityLoss: 0.064, tolerance: 1, lift: 0.06 },
  thin: { retention: 0.91, stabilityLoss: 0.052, tolerance: 0.74, lift: 0.055 },
  heavy: {
    retention: 0.934,
    stabilityLoss: 0.105,
    tolerance: 0.85,
    lift: 0.045,
  },
});
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
  return Object.freeze({
    stone: input.stone,
    mode: input.mode,
    power: Math.round(clamp(input.power, 0.1, 1) * 1000) / 1000,
    heading: Math.round(clamp(input.heading, -0.4, 0.7) * 1000) / 1000,
    tilt: Math.round(clamp(input.tilt, -1, 1) * 1000) / 1000,
  });
}
export function simulate(input) {
  const s = shot(input),
    p = STONES[s.stone],
    dt = 1 / 120;
  const quality = clamp(1 - Math.abs(s.tilt) / p.tolerance, 0, 1);
  let speed = (9 + s.power * 26) * (s.stone === "heavy" ? 1.45 : 1),
    vx = Math.sin(s.heading) * speed,
    vz = -Math.cos(s.heading) * speed;
  let x = -6,
    y = 0.13,
    z = 3,
    vy = -0.3,
    stability = 0.25 + quality * 0.79;
  let t = 0,
    skips = 0,
    first = null,
    last = null,
    done = false;
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
      (k) => !["stone", "mode", "power", "heading", "tilt"].includes(k),
    )
  )
    throw Error("Invalid challenge throw.");
  for (const [k, a, b] of [
    ["power", 0.1, 1],
    ["heading", -0.4, 0.7],
    ["tilt", -1, 1],
  ])
    if (!Number.isFinite(v.s[k]) || v.s[k] < a || v.s[k] > b)
      throw Error("Invalid challenge throw.");
  return {
    name: v.n.replace(/[\x00-\x1f\x7f]/g, "").trim() || "Friend",
    shot: shot(v.s),
  };
}
