import * as THREE from 'three';
import { ROCKS } from './rocks.js';

export function createRockInspector(assets, onChoose) {
  const dialog = document.querySelector('#rockDialog');
  const host = document.querySelector('#rockViewport');
  const strip = document.querySelector('.stone-list');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 30);
  camera.position.set(0, 2.25, 3.4);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xe4f7ff, 0x5c4a34, 1.8));
  const key = new THREE.DirectionalLight(0xffeed7, 2.4);
  key.position.set(-3, 5, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xb9e4ff, 1.6);
  rim.position.set(3, 2, -3);
  scene.add(rim);
  const rock = new THREE.Mesh(assets.flat.geometry, assets.flat.material);
  scene.add(rock);
  let selected = 'flat', pointer = null, rotation = null;
  renderer.setSize(192, 128, false);
  camera.aspect = 1.5;
  camera.updateProjectionMatrix();
  rock.scale.setScalar(1.35);
  for (const [id, config] of Object.entries(ROCKS)) {
    rock.geometry = assets[id].geometry;
    rock.material = assets[id].material;
    rock.rotation.set(.12, -.45, -.1);
    renderer.render(scene, camera);
    const image = document.querySelector(`[data-stone="${id}"] img`);
    image.src = renderer.domElement.toDataURL('image/png');
    image.alt = config.name;
  }
  rock.scale.setScalar(1);
  host.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  function draw() {
    if (!dialog.open) return;
    const { width, height } = host.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const distance = Math.max(3.2, 3.3 / camera.aspect);
    camera.position.set(0, distance * .55, distance * .835);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
  const observer = new ResizeObserver(draw);
  observer.observe(host);
  function open(id) {
    selected = id;
    rock.geometry = assets[id].geometry;
    rock.material = assets[id].material;
    rock.rotation.set(.12, -.45, -.1);
    document.querySelector('#rockName').textContent = ROCKS[id].name;
    document.querySelector('#rockDescription').textContent = ROCKS[id].description;
    document.querySelector('#rockTrait').textContent = ROCKS[id].trait;
    dialog.showModal();
    draw();
    host.focus({ preventScroll: true });
  }
  host.addEventListener('pointerdown', e => {
    if (e.button !== 0 || pointer) return;
    pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
    rotation = { x: rock.rotation.x, y: rock.rotation.y };
    host.setPointerCapture(e.pointerId);
    host.classList.add('dragging');
  });
  host.addEventListener('pointermove', e => {
    if (!pointer || pointer.id !== e.pointerId) return;
    rock.rotation.x = rotation.x + (e.clientY - pointer.y) * .009;
    rock.rotation.y = rotation.y + (e.clientX - pointer.x) * .009;
    draw();
  });
  function endDrag() { pointer = null; host.classList.remove('dragging'); }
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) host.addEventListener(event, endDrag);
  host.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(e.key)) return;
    e.preventDefault();
    if (e.key === 'Home') rock.rotation.set(.12, -.45, -.1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') rock.rotation.y += e.key === 'ArrowLeft' ? -.15 : .15;
    else rock.rotation.x += e.key === 'ArrowUp' ? -.15 : .15;
    draw();
  });
  dialog.addEventListener('close', endDrag);
  document.querySelector('#useRock').onclick = () => { onChoose(selected); dialog.close(); };
  strip.closest('.stones').addEventListener('wheel', e => {
    if (e.ctrlKey) return;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (!delta) return;
    e.preventDefault();
    strip.scrollLeft += delta * (e.deltaMode === 1 ? 18 : e.deltaMode === 2 ? strip.clientWidth : 1);
  }, { passive: false });
  strip.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const buttons = [...strip.querySelectorAll('button')];
    const i = buttons.indexOf(document.activeElement);
    const next = buttons[Math.max(0, Math.min(buttons.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)))];
    next.focus({ preventScroll: true });
    next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
  addEventListener('pagehide', () => { observer.disconnect(); renderer.dispose(); }, { once: true });
  return { open };
}
