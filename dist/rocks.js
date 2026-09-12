import * as THREE from 'three';

export const ROCKS = Object.freeze({
  flat: { name: 'Flat slate', short: 'FLAT', trait: 'Forgiving', description: 'A broad, balanced slate. A generous release window makes this a good place to find your rhythm.', shape: [1, .17, .68], color: 0x718083, roughness: .3, texture: 'pebbles.jpg', seed: 1 },
  thin: { name: 'Thin slate', short: 'THIN', trait: 'More skips', description: 'A slender, smooth stone that holds its speed. Keep the release level to string together more skips.', shape: [1, .12, .62], color: 0x667079, roughness: .28, texture: 'pebbles.jpg', seed: 2 },
  heavy: { name: 'Heavy limestone', short: 'HEAVY', trait: 'More distance', description: 'A weightier stone with extra pace. It travels farther, but loses stability sooner.', shape: [1, .32, .78], color: 0xd7c4a3, roughness: .45, texture: 'pebbles.jpg', seed: 3 },
  jade: { name: 'River jade', short: 'JADE', trait: 'Easy control', description: 'A smooth green river stone with a forgiving release. Steady, low skips reward a balanced throw.', shape: [1, .22, .74], color: 0xffffff, roughness: .22, texture: 'rock-jade.jpg', seed: 4 },
  quartz: { name: 'Rose quartz', short: 'QUARTZ', trait: 'Higher bounces', description: 'Cloudy pink quartz with a little extra lift. Its higher bounces trade some stability for longer arcs.', shape: [.91, .3, .78], color: 0xffffff, roughness: .24, texture: 'rock-quartz.jpg', seed: 5 },
  obsidian: { name: 'Obsidian', short: 'OBSIDIAN', trait: 'Precision skips', description: 'A thin volcanic stone that keeps its speed beautifully. A narrow release window asks for precise timing.', shape: [1, .14, .64], color: 0xffffff, roughness: .12, texture: 'rock-obsidian.jpg', seed: 6 },
  granite: { name: 'Speckled granite', short: 'GRANITE', trait: 'Steady pace', description: 'A rounded, speckled stone with reliable momentum. A forgiving release and moderate lift make it a steady all-rounder.', shape: [.95, .28, .76], color: 0xffffff, roughness: .52, texture: 'rock-granite.jpg', seed: 7 },
});

export async function loadRockAssets() {
  const loader = new THREE.TextureLoader(), textures = new Map();
  for (const config of Object.values(ROCKS)) {
    if (!textures.has(config.texture)) textures.set(config.texture, loader.loadAsync(`assets/${config.texture}`));
  }
  await Promise.all([...textures.values()]);
  const assets = {};
  for (const [id, config] of Object.entries(ROCKS)) {
    const map = await textures.get(config.texture);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    const geometry = new THREE.SphereGeometry(1, 64, 40);
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
      const variation = 1 + Math.sin(x * 12 + z * 9 + config.seed) * .026 + Math.sin(z * 19 - y * 9) * .014;
      position.setXYZ(i, x * variation * config.shape[0], y * variation * config.shape[1], z * variation * config.shape[2]);
    }
    geometry.computeVertexNormals();
    const material = new THREE.MeshPhysicalMaterial({
      map, bumpMap: map, bumpScale: id === 'granite' ? .045 : .015,
      color: config.color, roughness: config.roughness, metalness: 0,
      clearcoat: .75, clearcoatRoughness: .2,
    });
    assets[id] = { geometry, material };
  }
  return assets;
}
