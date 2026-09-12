import * as THREE from "three";
import { addCrew } from "./boat-crew.js";
import { TARGETS } from "./simulation.js";

function outline(scale = 1) {
  const s = new THREE.Shape();
  s.moveTo(-0.9 * scale, -0.28 * scale);
  s.quadraticCurveTo(-1.05 * scale, 0, -0.9 * scale, 0.28 * scale);
  s.bezierCurveTo(
    -0.25 * scale,
    0.48 * scale,
    0.56 * scale,
    0.39 * scale,
    1.05 * scale,
    0,
  );
  s.bezierCurveTo(
    0.56 * scale,
    -0.39 * scale,
    -0.25 * scale,
    -0.48 * scale,
    -0.9 * scale,
    -0.28 * scale,
  );
  return s;
}
function rail(a, b, radius, material) {
  const start = new THREE.Vector3(...a),
    end = new THREE.Vector3(...b),
    delta = end.clone().sub(start);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, delta.length(), 8),
    material,
  );
  mesh.position.copy(start.add(end).multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    delta.normalize(),
  );
  return mesh;
}
function sailGeometry(side = 1) {
  const vertices = [],
    uvs = [],
    indices = [],
    n = 18;
  for (let y = 0; y <= n; y++)
    for (let x = 0; x <= n; x++) {
      const u = x / n,
        v = y / n,
        width = (1 - v) * 0.98,
        px = 0.02 + side * u * width;
      vertices.push(
        px,
        0.42 + v * 1.48,
        Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.16 +
          0.025 * Math.sin(v * 12) * u * (1 - u),
      );
      uvs.push(u, v);
      if (x < n && y < n) {
        const i = y * (n + 1) + x;
        indices.push(i, i + 1, i + n + 1, i + 1, i + n + 2, i + n + 1);
      }
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
export async function createBoats(scene, loader) {
  const [wood, cloth] = await Promise.all([
    loader.loadAsync("assets/boat-teak.jpg"),
    loader.loadAsync("assets/boat-linen.jpg"),
  ]);
  for (const texture of [wood, cloth]) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
  }
  wood.repeat.set(1.5, 1.5);
  cloth.repeat.set(2, 2);
  const teak = new THREE.MeshPhysicalMaterial({
    map: wood,
    roughness: 0.32,
    clearcoat: 0.85,
    clearcoatRoughness: 0.22,
  });
  const linen = new THREE.MeshPhysicalMaterial({
    map: cloth,
    bumpMap: cloth,
    bumpScale: 0.009,
    color: 0xfff7de,
    roughness: 0.82,
    side: THREE.DoubleSide,
    sheen: 0.4,
    sheenColor: new THREE.Color(0xffead1),
  });
  const brass = new THREE.MeshStandardMaterial({
    color: 0xd5b46d,
    roughness: 0.25,
    metalness: 0.8,
  });
  const ivory = new THREE.MeshStandardMaterial({
    color: 0xf8e7c3,
    roughness: 0.5,
  });
  const rope = new THREE.MeshStandardMaterial({
    color: 0xd9c6a1,
    roughness: 0.95,
  });
  return TARGETS.map((target, index) => {
    const group = new THREE.Group();
    const paint = new THREE.MeshPhysicalMaterial({
      color: target.color,
      roughness: 0.24,
      clearcoat: 1,
      clearcoatRoughness: 0.13,
      metalness: 0.04,
    });
    const edge = outline().getSpacedPoints(64),
      vertices = [],
      colors = [],
      uv = [],
      indices = [];
    const layers = [
      [-0.22, 0.45],
      [-0.13, 0.78],
      [0.05, 0.97],
      [0.17, 1],
    ];
    layers.forEach(([y, scale], j) =>
      edge.forEach((p, i) => {
        vertices.push(p.x * scale, y, p.y * scale);
        const shade = 0.48 + j * 0.16;
        colors.push(shade, shade, shade);
        uv.push(i / 64, j / 3);
        if (j < 3 && i < 64) {
          const a = j * 65 + i,
            b = a + 65;
          indices.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }),
    );
    const hullGeo = new THREE.BufferGeometry();
    hullGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    hullGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    hullGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    hullGeo.setIndex(indices);
    hullGeo.computeVertexNormals();
    const hullPaint = paint.clone();
    hullPaint.vertexColors = true;
    const hull = new THREE.Mesh(hullGeo, hullPaint);
    group.add(hull);
    const gunwale = outline(1.04);
    const inner = new THREE.Path(outline(0.94).getPoints(64));
    gunwale.holes.push(inner);
    const rim = new THREE.Mesh(
      new THREE.ExtrudeGeometry(gunwale, {
        depth: 0.035,
        bevelEnabled: false,
        curveSegments: 32,
      }),
      teak,
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.17;
    group.add(rim);
    const deckShape = outline(1);
    const deck = new THREE.Mesh(
      new THREE.ExtrudeGeometry(deckShape, {
        depth: 0.025,
        bevelEnabled: false,
        curveSegments: 32,
      }),
      teak,
    );
    deck.rotation.x = -Math.PI / 2;
    deck.position.y = 0.165;
    group.add(deck);
    const inside = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.025, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x223c43, roughness: 0.8 }),
    );
    inside.position.set(-0.35, 0.195, 0);
    group.add(inside);
    for (const x of [-0.58, -0.13]) {
      const seat = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.04, 0.41),
        teak,
      );
      seat.position.set(x, 0.245, 0);
      group.add(seat);
    }
    // A sealed deck and floor keep the cockpit opaque even from grazing angles.
    for (const z of [-.235, .235]) group.add(rail([-.72,.225,z],[.02,.225,z],.024,teak));
    const bottom = new THREE.Mesh(new THREE.ShapeGeometry(outline(.46),32), paint);
    bottom.rotation.x = Math.PI / 2; bottom.position.y = -.22; group.add(bottom);
    const hatch = new THREE.Mesh(new THREE.BoxGeometry(.26,.025,.25),ivory);
    hatch.position.set(.52,.205,-.05); group.add(hatch);
    const updateCrew = addCrew(group, index);
    const mast = rail([0.02, 0.15, 0], [0.02, 1.96, 0], 0.022, teak);
    group.add(mast);
    group.add(rail([0.02, 0.38, 0], [1, 0.38, 0], 0.016, teak));
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.055, 16),
      brass,
    );
    collar.position.set(0.02, 0.24, 0);
    group.add(collar);
    const sails = new THREE.Group();
    const mainsail = new THREE.Mesh(sailGeometry(), linen);
    sails.add(mainsail);
    const jib = new THREE.Mesh(sailGeometry(-1), linen);
    jib.scale.set(0.75, 0.77, 1);
    jib.position.y = 0.08;
    sails.add(jib);
    group.add(sails);
    // Stitched edges and curved battens follow the cloth, rather than flat triangles.
    sails.add(rail([0.03, 0.43, 0], [0.03, 1.89, 0], 0.006, ivory));
    for (const v of [0.18, 0.4, 0.64]) {
      const pts = Array.from({ length: 21 }, (_, i) => {
        const u = i / 20;
        return new THREE.Vector3(
          0.02 + u * (1 - v) * 0.98,
          0.42 + v * 1.48,
          Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.16 + 0.008,
        );
      });
      sails.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3(pts),
            20,
            0.005,
            4,
            false,
          ),
          ivory,
        ),
      );
    }
    for (const z of [-0.31, 0.31])
      group.add(rail([-0.65, 0.22, z], [0.02, 1.84, 0], 0.0045, rope));
    group.add(rail([0.97, 0.2, 0], [0.02, 1.84, 0], 0.0045, rope));
    for (const x of [-0.76, 0.8]) {
      group.add(rail([x, 0.23, -0.06], [x, 0.23, 0.06], 0.013, brass));
    }
    const pennantGeo = new THREE.BufferGeometry();
    pennantGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [0.025, 1.94, 0, 0.35, 1.88, 0.03, 0.025, 1.81, 0],
        3,
      ),
    );
    pennantGeo.computeVertexNormals();
    group.add(new THREE.Mesh(pennantGeo, paint));
    const wake = new THREE.Mesh(
      new THREE.RingGeometry(0.94, 1, 64),
      new THREE.MeshBasicMaterial({
        color: 0xe0f8f4,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    wake.rotation.x = -Math.PI / 2;
    wake.scale.set(1.25, 0.49, 1);
    wake.position.y = -0.09;
    group.add(wake);
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#12313ed9";
    ctx.beginPath();
    ctx.roundRect(30, 10, 196, 64, 25);
    ctx.fill();
    ctx.fillStyle = "#fff1c4";
    ctx.font = "600 38px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(`+${target.points}`, 128, 55);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Group(),
      sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: tex,
          transparent: true,
          depthWrite: false,
        }),
      );
    sprite.scale.set(1.7, 0.64, 1);
    label.add(sprite);
    label.position.y = 2.3;
    group.add(label);
    const reflection = new THREE.Mesh(
      mainsail.geometry,
      new THREE.MeshBasicMaterial({
        color: 0xb3cbca,
        transparent: true,
        opacity: 0.09,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
      }),
    );
    reflection.scale.set(1, -0.5, 1);
    reflection.position.y = -0.2;
    reflection.renderOrder = 2;
    group.add(reflection);
    scene.add(group);
    return { target, group, wake, label, sails, updateCrew };
  });
}
