import test from "node:test";
import assert from "node:assert/strict";
import {
  RULES,
  shot,
  simulate,
  positionAt,
  compare,
  category,
  encodeChallenge,
  decodeChallenge,
} from "../dist/simulation.js";
const sample = {
  stone: "flat",
  mode: "standard",
  power: 0.76,
  heading: 0.3,
  tilt: 0,
};
test("skips correspond to real positive rebounds, final sink is not scored", () => {
  const r = simulate(sample);
  assert.ok(r.skips >= 8);
  assert.equal(r.events.filter((e) => e.kind === "skip").length, r.skips);
  assert.equal(r.events.at(-1).kind, "sink");
  for (const e of r.events.filter((e) => e.kind === "skip")) {
    const a = r.samples.find((q) => q.t > e.t + 0.009);
    assert.ok(a.y > 0.035);
  }
  assert.equal(r.events.at(-1).count, r.skips);
});
test("clean release, low power and different stones change the physical result", () => {
  const clean = simulate(sample),
    tilted = simulate({ ...sample, tilt: 0.9 }),
    weak = simulate({ ...sample, power: 0.1 }),
    heavy = simulate({ ...sample, stone: "heavy" }),
    thin = simulate({ ...sample, stone: "thin" });
  assert.ok(clean.skips > tilted.skips);
  assert.ok(clean.distanceCm > weak.distanceCm);
  assert.ok(heavy.distanceCm > clean.distanceCm);
  assert.ok(thin.skips > clean.skips);
});
test("canonical replay round trip reproduces every trajectory sample", () => {
  const a = shot({ ...sample, power: 0.76245 });
  const encoded = encodeChallenge(a, "A & 🪨");
  const b = decodeChallenge(encoded);
  assert.equal(b.name, "A & 🪨");
  assert.deepEqual(simulate(a), simulate(b.shot));
  assert.equal(a.power, 0.762);
});
test("render frame schedules cannot change simulation results", () => {
  const r = simulate(sample);
  for (const fps of [30, 60, 144]) {
    for (let t = 0; t < r.duration; t += 1 / fps) {
      const p = positionAt(r, t);
      assert.ok(Object.values(p).every(Number.isFinite));
    }
    assert.deepEqual(r, simulate(sample));
  }
  assert.deepEqual(
    positionAt(r, 999),
    (({ x, y, z }) => ({ x, y, z }))(r.samples.at(-1)),
  );
});
test("category partitions records and distance breaks a tied skip count", () => {
  assert.notEqual(category(sample), category({ ...sample, mode: "relaxed" }));
  assert.notEqual(category(sample), category({ ...sample, stone: "thin" }));
  assert.equal(
    compare({ skips: 5, distanceCm: 1400 }, { skips: 5, distanceCm: 1400 }),
    0,
  );
  assert.ok(
    compare({ skips: 5, distanceCm: 1401 }, { skips: 5, distanceCm: 1400 }) > 0,
  );
});
const pack = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
test("malformed, oversized, unsupported, and out-of-range challenges rejected", () => {
  for (const raw of [
    "",
    "x".repeat(2049),
    "***",
    pack(null),
    pack({ v: 2 }),
    pack({ v: 1, r: RULES, c: "calm", n: "A", s: { ...sample, power: 2 } }),
    pack({ v: 1, r: RULES, c: "calm", n: "A", s: sample, score: 100 }),
    pack({ v: 1, r: RULES, c: "calm", n: "A", s: { ...sample, score: 100 } }),
  ])
    assert.throws(() => decodeChallenge(raw));
  assert.throws(() => shot({ ...sample, power: NaN }));
  assert.throws(() => shot({ ...sample, stone: "toString" }));
});
test("all edge inputs terminate, stay finite, and respect duration bounds", () => {
  for (const stone of ["flat", "thin", "heavy"])
    for (const power of [0.1, 0.5, 1])
      for (const tilt of [-1, -0.5, 0, 0.5, 1]) {
        const r = simulate({ ...sample, stone, power, tilt });
        assert.ok(r.duration <= 15.01);
        assert.ok(r.samples.length <= 1801);
        assert.ok(Number.isFinite(r.distanceCm));
        assert.ok(
          r.events.every((e) => Number.isFinite(e.t) && e.count <= r.skips),
        );
        assert.equal(r.events.at(-1).kind, "sink");
      }
});

test("stone identifiers never coerce arrays into valid choices", () => {
  for (const stone of [["flat"], [["flat"]], {}, 1]) {
    assert.throws(() => shot({ ...sample, stone }));
    assert.throws(() =>
      decodeChallenge(
        pack({ v: 1, r: RULES, c: "calm", n: "A", s: { ...sample, stone } }),
      ),
    );
  }
});

test("body alignment changes stability and direction, and replays exactly", () => {
  const a = simulate({ ...sample, body: 0, phase: 12.25 });
  const b = simulate({ ...sample, body: 0.9, phase: 12.25 });
  assert.ok(a.skips > b.skips);
  assert.notEqual(a.samples[10].x, b.samples[10].x);
  assert.deepEqual(b, simulate(decodeChallenge(encodeChallenge(b.input)).shot));
  assert.throws(() => shot({ ...sample, body: NaN }));
});
test("moving boats award points once per actual contact and misses earn zero", () => {
  const base = { ...sample, heading: 0.26, body: 0, phase: 0 };
  const hit = simulate(base),
    miss = simulate({ ...base, heading: -0.4 });
  assert.ok(hit.points > 0);
  assert.equal(miss.points, 0);
  assert.equal(new Set(hit.hits.map((h) => h.id)).size, hit.hits.length);
  assert.equal(
    hit.points,
    hit.hits.reduce((sum, h) => sum + h.points, 0),
  );
  assert.deepEqual(hit, simulate(decodeChallenge(encodeChallenge(base)).shot));
  assert.notDeepEqual(hit.hits, simulate({ ...base, phase: 10 }).hits);
});

test('all seven stones have distinct playable throws and share exact replays', async () => {
  const { STONES } = await import('../dist/simulation.js');
  assert.equal(Object.keys(STONES).length, 7);
  const results = new Set();
  for (const stone of Object.keys(STONES)) {
    const input = shot({ ...sample, stone, body: 0, phase: 0 });
    const replay = simulate(input);
    assert.ok(replay.skips > 0 && replay.duration < 15.01);
    assert.deepEqual(replay, simulate(decodeChallenge(encodeChallenge(input)).shot));
    results.add(`${replay.skips}:${replay.distanceCm}`);
  }
  assert.equal(results.size, 7);
});

test('short throws finish independently of a longer personal-best ghost', async () => {
  const { roundFinished } = await import('../dist/simulation.js');
  const current = simulate({ ...sample, tilt: .95 });
  const ghost = simulate(sample);
  assert.ok(ghost.duration > current.duration + .3);
  assert.equal(roundFinished(current, current.duration), false);
  assert.equal(roundFinished(current, current.duration + .23), true);
  assert.equal(roundFinished(null, 10), false);
});
