import * as THREE from "three";
import { positionAt } from "./simulation.js";
const NS = "http://www.w3.org/2000/svg";
function el(tag, attrs = {}) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}
// A legible HUD diagram: marker positions are physical contacts; arc height is illustrative.
export function createTrajectoryGuide(container) {
  const svg = el("svg", { class: "trajectory-guide", "aria-hidden": "true" });
  container.append(svg);
  const defs = el("defs"),
    filter = el("filter", {
      id: "guideGlow",
      x: "-100%",
      y: "-100%",
      width: "300%",
      height: "300%",
    }),
    blur = el("feGaussianBlur", { stdDeviation: "3" });
  filter.append(blur);
  defs.append(filter);
  svg.append(defs);
  const arcs = Array.from({ length: 6 }, () => {
    const g = el("g"),
      glow = el("path", { class: "guide-glow" }),
      line = el("path", { class: "guide-arc" }),
      outer = el("ellipse", { class: "landing-outer" }),
      inner = el("ellipse", { class: "landing-inner" }),
      number = el("text", { class: "landing-number" }),
      splash = el("path", { class: "landing-splash" });
    g.append(glow, line, outer, inner, number, splash);
    svg.append(g);
    return { g, glow, line, outer, inner, number, splash };
  });
  const landing = el("g"),
    oval = el("ellipse", { class: "landing-final" }),
    pole = el("path", { class: "landing-pole" }),
    flag = el("path", { class: "landing-flag" }),
    label = el("text", { class: "landing-caption" });
  landing.append(oval, pole, flag, label);
  svg.append(landing);
  const aim = el("g"),
    fan = el("path", { class: "aim-fan" }),
    ticks = el("path", { class: "aim-ticks" }),
    handle = el("path", { class: "pull-line" });
  aim.append(fan, ticks, handle);
  svg.append(aim);
  const caption = el("text", { class: "preview-caption" });
  svg.append(caption);
  const v = new THREE.Vector3();
  function update(replay, { state, playTime, camera, width, height, guiding }) {
    const active =
      !!replay && (guiding || ["flying", "paused"].includes(state));
    svg.style.display = active ? "block" : "none";
    if (!active) return;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const project = (p) => {
      v.set(p.x, p.y ?? 0.035, p.z).project(camera);
      return {
        x: (v.x * 0.5 + 0.5) * width,
        y: (0.5 - v.y * 0.5) * height,
        visible:
          v.z > -1 && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.2,
      };
    };
    const candidates = replay.events.filter(
      (e) => e.kind === "skip" && (guiding || e.t > playTime + 0.04),
    );
    // Avoid unreadable stacks near the far end: retain four widely spaced guide contacts at rest.
    const events = guiding ? candidates.slice(0, 4) : candidates.slice(0, 5);
    let from = project(
      guiding
        ? replay.samples[0]
        : positionAt(replay, Math.min(playTime, replay.duration)),
    );
    arcs.forEach((item, i) => {
      const event = events[i];
      if (!event) {
        item.g.style.display = "none";
        return;
      }
      const to = project(event);
      const dx = to.x - from.x,
        dy = to.y - from.y,
        distance = Math.hypot(dx, dy);
      const show =
        from.visible &&
        to.visible &&
        distance > (guiding ? 12 : 22) &&
        to.y > height * 0.2;
      item.g.style.display = show ? "" : "none";
      if (show) {
        const lift = Math.min(
          guiding ? 100 : 120,
          Math.max(22, distance * 0.4),
        );
        const d = `M${from.x},${from.y} Q${(from.x + to.x) / 2},${Math.min(from.y, to.y) - lift} ${to.x},${to.y}`;
        item.line.setAttribute("d", d);
        item.glow.setAttribute("d", d);
        item.g.style.opacity = String(1 - i * 0.12);
        const rx = Math.max(10, Math.min(guiding ? 38 : 49, distance * 0.19)),
          ry = Math.max(3, rx * 0.22);
        for (const [node, scale] of [
          [item.outer, 1],
          [item.inner, 0.72],
        ]) {
          node.setAttribute("cx", to.x);
          node.setAttribute("cy", to.y);
          node.setAttribute("rx", rx * scale);
          node.setAttribute("ry", ry * scale);
        }
        item.number.setAttribute("x", to.x);
        item.number.setAttribute("y", to.y - ry - 13);
        item.number.textContent = event.count;
        item.splash.setAttribute(
          "d",
          `M${to.x - 6},${to.y - 1} l-3,-6 M${to.x},${to.y - 1} v-9 M${to.x + 5},${to.y - 1} l4,-5`,
        );
      }
      from = to;
    });
    const end = project(replay.samples.at(-1));
    landing.style.display = guiding && end.visible ? "" : "none";
    if (guiding && end.visible) {
      const rx = width < 760 ? 27 : 48;
      oval.setAttribute("cx", end.x);
      oval.setAttribute("cy", end.y);
      oval.setAttribute("rx", rx);
      oval.setAttribute("ry", rx * 0.2);
      pole.setAttribute("d", `M${end.x},${end.y} v-38`);
      flag.setAttribute("d", `M${end.x},${end.y - 38} l19,6 l-19,7 Z`);
      label.setAttribute("x", Math.max(80, Math.min(width - 80, end.x)));
      label.setAttribute("y", end.y + (width < 760 ? -48 : 30));
      label.textContent = width < 760 ? "LANDING" : "ESTIMATED LANDING";
    }
    const start = project(replay.samples[0]);
    aim.style.display = guiding && start.visible ? "" : "none";
    caption.style.display = guiding ? "" : "none";
    if (guiding && start.visible) {
      const radius = width < 760 ? 45 : 65;
      fan.setAttribute(
        "d",
        `M${start.x - radius},${start.y} A${radius},${radius} 0 0 1 ${start.x + radius},${start.y}`,
      );
      let d = "";
      for (let a = 0; a <= Math.PI; a += Math.PI / 18) {
        const r = radius + (Math.round((a / Math.PI) * 18) % 3 === 0 ? 9 : 5);
        d += `M${start.x + Math.cos(a) * radius},${start.y - Math.sin(a) * radius} L${start.x + Math.cos(a) * r},${start.y - Math.sin(a) * r} `;
      }
      ticks.setAttribute("d", d);
      caption.setAttribute(
        "x",
        Math.max(100, Math.min(width - 100, start.x + 100)),
      );
      caption.setAttribute("y", start.y - radius - 43);
      caption.textContent = "FIRST 4 SKIPS · PERFECT RELEASE";
      const pull = document
        .querySelector("#game")
        .dataset.pull?.split(",")
        .map(Number);
      handle.style.display = pull ? "" : "none";
      if (pull)
        handle.setAttribute(
          "d",
          `M${start.x},${start.y} L${pull[0]},${pull[1]}`,
        );
    }
  }
  return { update };
}
