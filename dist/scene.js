import * as THREE from "three";
import { createBoats } from "./boats.js";
import { createTrajectoryGuide } from "./trajectory.js";
import { positionAt, simulate, targetPosition } from "./simulation.js";
export async function createLake(container, rocks) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.append(renderer.domElement);
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(
      53,
      innerWidth / innerHeight,
      0.05,
      800,
    );
  camera.position.set(1.1, 4.2, 14);
  camera.lookAt(1.1, -3.5, -28);
  const loader = new THREE.TextureLoader();
  const [land, bed, normal, resultLand] = await Promise.all([
    loader.loadAsync("assets/environment.jpg"),
    loader.loadAsync("assets/pebbles.jpg"),
    loader.loadAsync("assets/water-normal.jpg"),
    loader.loadAsync("assets/result-environment.jpg"),
  ]);
  resultLand.colorSpace =
    land.colorSpace =
    bed.colorSpace =
      THREE.SRGBColorSpace;
  land.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = land;
  scene.environmentIntensity = 0.8;
  bed.wrapS = bed.wrapT = THREE.RepeatWrapping;
  bed.anisotropy = 8;
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  normal.anisotropy = 8;
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {
        map: { value: land },
        resultMap: { value: resultLand },
        resultMix: { value: 0 },
        aspect: { value: innerWidth / innerHeight },
      },
      vertexShader:
        "varying vec2 uvv;void main(){uvv=uv;gl_Position=vec4(position.xy,0.9999,1.);}",
      fragmentShader:
        "uniform sampler2D map;uniform sampler2D resultMap;uniform float resultMix;uniform float aspect;varying vec2 uvv;void main(){vec2 q=vec2((uvv.x-.5)*min(1.,aspect/1.596)+.5,(uvv.y<.676?uvv.y*.961538:.65+(uvv.y-.676)*1.080247));gl_FragColor=mix(texture2D(map,q),texture2D(resultMap,q),resultMix);\n #include <colorspace_fragment>\n}",
    }),
  );
  bg.frustumCulled = false;
  bg.renderOrder = -100;
  scene.add(bg);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 700, 1, 1),
    new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        immersion: { value: 0 },
        land: { value: land },
        resultMap: { value: resultLand },
        resultMix: { value: 0 },
        bed: { value: bed },
        normalMap: { value: normal },
        viewport: { value: new THREE.Vector2(innerWidth, innerHeight) },
      },
      vertexShader: `varying vec3 wp;varying vec4 clip;void main(){vec4 w=modelMatrix*vec4(position,1.);wp=w.xyz;clip=projectionMatrix*viewMatrix*w;gl_Position=clip;}`,
      fragmentShader: `
 uniform float immersion;uniform float time;uniform sampler2D resultMap;uniform float resultMix;uniform sampler2D land;uniform sampler2D bed;uniform sampler2D normalMap;uniform vec2 viewport;varying vec3 wp;varying vec4 clip;
 float waves(vec2 p){return sin(p.x*4.1+p.y*3.2+time*.9)*.012+sin(p.x*7.8-p.y*4.7-time*.6)*.006+sin(p.x*16.+p.y*9.1+time*.7)*.003+sin(p.y*28.+p.x*13.-time)*.0015;}
 // Camera-projected environment capture provides the base radiance. Animated
 // normal-map refraction and specular response shade the actual lake mesh.
 void main(){vec2 p=wp.xz;
 vec2 n=(texture2D(normalMap,p*.12+vec2(time*.014,time*.009)).rg-.5)*1.3+(texture2D(normalMap,p*.21-vec2(time*.008,time*.011)).rg-.5)*.5;
 vec2 screen=clip.xy/clip.w*.5+.5;vec2 baseUV=vec2((screen.x-.5)*min(1.,viewport.x/viewport.y/1.596)+.5,(screen.y<.676?screen.y*.961538:.65+(screen.y-.676)*1.080247));
 float waterMask=smoothstep(.01,.22,screen.y)*smoothstep(.10,.42,screen.x+screen.y*.32);float distanceMask=1.-smoothstep(.58,.68,screen.y);
 // Crossing wave trains gently bend the reflected image without moving dry shore.
 vec2 swell=vec2(sin(p.x*.7+p.y*.48+time*.65),sin(p.y*.9-p.x*.32-time*.48));
 vec2 shift=(n*vec2(.012,.007)+swell*vec2(.00065,.00045))*waterMask*distanceMask;vec3 capture=mix(texture2D(land,baseUV+shift).rgb,texture2D(resultMap,baseUV+shift).rgb,resultMix);
 float fresnel=.10+pow(clamp(screen.y/.68,0.,1.),3.)*.18;
 vec3 reflection=texture2D(land,vec2(screen.x+n.x*.025,clamp(.65+(.676-screen.y)*.5+n.y*.012,.65,.99))).rgb;
 vec3 color=mix(capture,reflection,fresnel*waterMask*.2);
 float sunline=exp(-pow((screen.x-.947+n.x*.1)/(.014+(1.-screen.y)*.04),2.));float sparkle=pow(clamp((n.y+.17)*3.,0.,1.),10.);
 float waveSlope=sin(p.x*2.8+p.y*5.2+time*1.1)*.5+sin(p.x*6.1-p.y*3.7-time*.83)*.25;
 float glint=pow(max(0.,.55+n.y*1.4+waveSlope*.3),14.);
 float glintMask=waterMask*distanceMask;
 color+=vec3(1.,.79,.48)*sunline*min(glint,1.)*.48*glintMask;
 // Broad, very faint changing sky reflections reveal motion away from the sun.
 color+=vec3(.62,.83,.94)*(n.y*.035+waveSlope*.009)*glintMask;
 color+=vec3(1.,.68,.3)*sunline*sparkle*.12*waterMask;
 // In stone view, shade world-space water so ripples travel beneath the camera.
 vec3 eye=normalize(cameraPosition-wp);
 vec3 waveNormal=normalize(vec3(n.x*.17,1.,n.y*.17));
 float facing=pow(1.-max(dot(eye,waveNormal),0.),3.);
 vec3 reflected=reflect(-eye,waveNormal);
 vec2 skyUV=vec2(clamp(.5+reflected.x*.45,.02,.98),clamp(.67+abs(reflected.y)*.28,.67,.99));
 vec3 skyColor=texture2D(land,skyUV).rgb;
 vec3 lakeColor=mix(vec3(.013,.12,.15),skyColor,.34+facing*.48);
 vec3 halfway=normalize(eye+normalize(vec3(.65,.22,-.35)));
 float spec=pow(max(dot(waveNormal,halfway),0.),180.);
 lakeColor+=vec3(1.,.74,.38)*spec*1.2;
 lakeColor+=vec3(1.,.67,.3)*pow(clamp((n.y+.23)*2.6,0.,1.),5.)*sunline*.5;
 lakeColor+=vec3(.05,.11,.12)*(waveSlope*.16+n.y*.25);
 // The distant lake is a screen-fixed capture. A world-distance fade collapses
 // to a thin stripe from this low camera, so blend over a broad screen band.
 // Its upper edge matches the backdrop exactly: no refraction, glints, or tint.
 vec3 plate=mix(texture2D(land,baseUV).rgb,texture2D(resultMap,baseUV).rgb,resultMix);
 float nearWater=1.-smoothstep(.32,.60,screen.y);
 vec3 flightWater=mix(plate,lakeColor,nearWater);
 color=mix(color,flightWater,immersion);
 gl_FragColor=vec4(color,1.);\n #include <colorspace_fragment>\n}`,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  scene.add(water);
  scene.add(new THREE.HemisphereLight(0xd9efff, 0x283b31, 1.35));
  const sun = new THREE.DirectionalLight(0xffd494, 3.1);
  sun.position.set(25, 15, -20);
  scene.add(sun);
  // Nearby pebbles add geometry over the reference-derived shoreline capture.
  const rockGeo = new THREE.IcosahedronGeometry(1, 2);
  const rockMaterial = new THREE.MeshStandardMaterial({
    map: bed,
    color: 0xc7b997,
    roughness: 0.27,
    metalness: 0.04,
  });
  let seed = 34;
  function random() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  for (let i = 0; i < 85; i++) {
    const r = new THREE.Mesh(rockGeo, rockMaterial);
    const z = 8 + random() * 5,
      x = -5.6 - random() * 4 + Math.max(0, z - 8) * 0.35;
    const size = 0.035 + random() * 0.12;
    r.position.set(x, -0.06 + random() * 0.08, z);
    r.scale.set(size * (1 + random()), size * 0.52, size * (1 + random()));
    r.rotation.set(random(), random() * 6, random());
    scene.add(r);
  }
  const geo = rocks.flat.geometry;
  const stone = new THREE.Mesh(geo, rocks.flat.material);
  stone.scale.set(0.37, 0.065, 0.25);
  stone.visible = false;
  scene.add(stone);
  const ghost = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      color: 0xffdc93,
      transparent: true,
      opacity: 0.7,
    }),
  );
  ghost.scale.copy(stone.scale);
  ghost.visible = false;
  scene.add(ghost);
  const aimGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-3, 0.04, 3),
    new THREE.Vector3(5, 0.04, -25),
  ]);
  const aim = new THREE.Line(
    aimGeo,
    new THREE.LineDashedMaterial({
      color: 0xf5e5b9,
      dashSize: 0.25,
      gapSize: 0.5,
      transparent: true,
      opacity: 0.65,
    }),
  );
  aim.computeLineDistances();
  aim.visible = false;
  scene.add(aim);
  const aimArrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.65, 3),
    new THREE.MeshBasicMaterial({
      color: 0xdbfbff,
      transparent: true,
      opacity: 0.9,
    }),
  );
  scene.add(aimArrow);
  // Fixed pools keep repeat throws from allocating GPU resources.
  const crownGeo = new THREE.BufferGeometry();
  const crownVerts = [];
  for (let j = 0; j < 48; j++) {
    const a = (j / 48) * Math.PI * 2,
      b = ((j + 1) / 48) * Math.PI * 2;
    const h = 0.1 + Math.pow((Math.sin(j * 2.1) + 1) * 0.5, 3) * 0.3;
    const h2 = 0.1 + Math.pow((Math.sin((j + 1) * 2.1) + 1) * 0.5, 3) * 0.3;
    const p = [Math.cos(a) * 0.14, 0.04, Math.sin(a) * 0.14],
      q = [Math.cos(b) * 0.14, 0.04, Math.sin(b) * 0.14],
      u = [Math.cos(a) * 0.29, h, Math.sin(a) * 0.29],
      v = [Math.cos(b) * 0.29, h2, Math.sin(b) * 0.29];
    crownVerts.push(...p, ...q, ...u, ...u, ...q, ...v);
  }
  crownGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(crownVerts, 3),
  );
  crownGeo.computeVertexNormals();
  const effects = Array.from({ length: 64 }, () => {
    const group = new THREE.Group();
    const rings = [];
    for (let k = 0; k < 3; k++) {
      const r = new THREE.Mesh(
        new THREE.RingGeometry(0.97, 1, 96),
        new THREE.MeshBasicMaterial({
          color: 0xf5fffd,
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      const ringPositions = r.geometry.attributes.position;
      const ringColors = [];
      for (let v = 0; v < ringPositions.count; v++) {
        const angle = Math.atan2(ringPositions.getY(v), ringPositions.getX(v));
        const irregularity =
          1 + Math.sin(angle * 17 + k) * 0.011 + Math.cos(angle * 29) * 0.007;
        ringPositions.setXY(
          v,
          ringPositions.getX(v) * irregularity,
          ringPositions.getY(v) * irregularity,
        );
        const brightness =
          0.25 + 0.75 * Math.pow((Math.sin(angle * 13 + k * 2) + 1) * 0.5, 0.6);
        ringColors.push(brightness, brightness, brightness);
      }
      r.geometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(ringColors, 3),
      );
      r.material.vertexColors = true;
      r.rotation.x = -Math.PI / 2;
      r.position.y = 0.047 + k * 0.001;
      group.add(r);
      rings.push(r);
    }
    const points = new Float32Array(220 * 3),
      g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(points, 3));
    const splash = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        color: 0xf5fff7,
        size: 0.068,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      }),
    );
    splash.material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        "#include <fog_vertex>",
        "#include <fog_vertex>\n gl_PointSize=min(gl_PointSize,4.5);",
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <clipping_planes_fragment>",
        "#include <clipping_planes_fragment>\n float dropletRadius=length(gl_PointCoord-.5);if(dropletRadius>.5)discard;",
      );
    };
    group.add(splash);
    const crown = new THREE.Mesh(
      crownGeo,
      new THREE.MeshBasicMaterial({
        color: 0xe4f9fa,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    group.add(crown);
    scene.add(group);
    group.visible = false;
    return { group, rings, splash, points, crown };
  });
  const ghostTrailGeometry = new THREE.BufferGeometry();
  ghostTrailGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(1801 * 3), 3),
  );
  ghostTrailGeometry.setAttribute(
    "lineDistance",
    new THREE.BufferAttribute(new Float32Array(1801), 1),
  );
  const ghostTrail = new THREE.Line(
    ghostTrailGeometry,
    new THREE.LineDashedMaterial({
      color: 0xfad592,
      transparent: true,
      opacity: 0.34,
      dashSize: 0.12,
      gapSize: 0.27,
      depthWrite: false,
    }),
  );
  ghostTrail.frustumCulled = false;
  ghostTrail.visible = false;
  scene.add(ghostTrail);
  const sprayPositions = new Float32Array(180 * 3),
    sprayGeo = new THREE.BufferGeometry();
  sprayGeo.setAttribute(
    "position",
    new THREE.BufferAttribute(sprayPositions, 3),
  );
  const skimSpray = new THREE.Points(
    sprayGeo,
    new THREE.PointsMaterial({
      color: 0xfff9e7,
      size: 3,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    }),
  );
  skimSpray.material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <clipping_planes_fragment>",
      "#include <clipping_planes_fragment>\n if(length(gl_PointCoord-.5)>.48)discard;",
    );
  };
  skimSpray.frustumCulled = false;
  scene.add(skimSpray);
  const boats = await createBoats(scene, loader);
  const trajectoryGuide = createTrajectoryGuide(container);
  let guideReplay = null;
  let previewKey = "";
  const shorePosition = new THREE.Vector3(1.1, 4.2, 14),
    shoreLook = new THREE.Vector3(1.1, -3.5, -28);
  let cameraBlend = 0;
  let current = null,
    ghostReplay = null,
    stationary = false,
    viewMix = 0;
  const project = (p) => {
    const v = new THREE.Vector3(p.x, p.y + 0.3, p.z).project(camera);
    return {
      x: (v.x * 0.5 + 0.5) * innerWidth,
      y: (-0.5 * v.y + 0.5) * innerHeight,
      visible: v.z < 1 && Math.abs(v.x) < 1.1,
    };
  };
  function setReplay(r, g) {
    current = r;
    ghostReplay = g;
    if (g) {
      const a = ghostTrailGeometry.attributes.position,
        d = ghostTrailGeometry.attributes.lineDistance;
      let length = 0;
      g.samples.forEach((p, i) => {
        a.setXYZ(i, p.x + 1.4, p.y + 0.04, p.z);
        if (i) {
          const before = g.samples[i - 1];
          length += Math.hypot(p.x - before.x, p.y - before.y, p.z - before.z);
        }
        d.setX(i, length);
      });
      a.needsUpdate = d.needsUpdate = true;
    }

    if (!r) {
      camera.position.set(1.1, 4.2, 14);
      camera.lookAt(1.1, -3.5, -28);
    }
    effects.forEach((e) => (e.group.visible = false));
  }
  function render(
    t,
    playTime,
    state,
    heading = 0.65,
    power = 0.65,
    selected = "flat",
    targetTime = 0,
  ) {
    water.material.uniforms.time.value = t;
    viewMix += ((state === "result" ? 1 : 0) - viewMix) * 0.09;
    bg.material.uniforms.resultMix.value =
      water.material.uniforms.resultMix.value = viewMix;
    const preparing = state === "preparing";
    const flight =
      current && ["flying", "paused"].includes(state) && !stationary;
    const desiredBlend = flight ? Math.min(1, playTime / 0.25) : 0;
    cameraBlend += (desiredBlend - cameraBlend) * 0.13;
    if (!current || stationary) cameraBlend = 0;
    water.material.uniforms.immersion.value = cameraBlend;
    camera.aspect =
      (innerWidth / innerHeight) *
      (1 - cameraBlend * 0 + (innerWidth < 760 ? 0 : -0.2 * (1 - cameraBlend)));
    camera.fov =
      (innerWidth < 760 ? 100 : 53) * (1 - cameraBlend) + 68 * cameraBlend;
    camera.updateProjectionMatrix();
    if (current && cameraBlend > 0.001) {
      const p = positionAt(current, Math.min(playTime, current.duration));
      const dx = Math.sin(current.input.heading + current.input.body * 0.12),
        dz = -Math.cos(current.input.heading + current.input.body * 0.12);
      camera.position
        .copy(shorePosition)
        .lerp(
          new THREE.Vector3(
            p.x - dx * 1.25 - dz * 0.65,
            1.1 + p.y * 0.18,
            p.z - dz * 1.25 + dx * 0.65,
          ),
          cameraBlend,
        );
      camera.lookAt(
        shoreLook
          .clone()
          .lerp(
            new THREE.Vector3(
              p.x + Math.sin(current.input.heading - 0.42) * 16,
              -1.8,
              p.z - Math.cos(current.input.heading - 0.42) * 16,
            ),
            cameraBlend,
          ),
      );
    } else {
      camera.position.copy(shorePosition);
      camera.lookAt(shoreLook);
    }
    camera.updateMatrixWorld();
    const boatTime = current
      ? current.input.phase + Math.min(playTime, current.duration)
      : targetTime;
    for (const { target, group, wake, label, sails } of boats) {
      const p = targetPosition(target, boatTime),
        hit = current?.hits.find((h) => h.id === target.id && h.t <= playTime);
      group.position.set(
        p.x,
        p.y + Math.sin(boatTime * 2 + target.offset) * 0.035,
        p.z,
      );
      group.rotation.set(
        Math.sin(boatTime + target.offset) * 0.035,
        Math.cos(boatTime * target.rate + target.offset) * 0.12,
        0,
      );
      group.visible = !hit || playTime - hit.t < 0.7;
      if (hit) {
        const fall = Math.min(1, (playTime - hit.t) / 0.7);
        group.position.y -= fall * 0.7;
        group.rotation.z = fall * 1.4;
      }
      wake.material.opacity = 0.28 + Math.sin(boatTime * 3) * 0.06;
      sails.rotation.y = Math.sin(boatTime * 0.8 + target.offset) * 0.045;
      const labelDistance = camera.position.distanceTo(group.position);
      label.visible = labelDistance > 5;
      label.scale.setScalar(Math.min(1, labelDistance / 14));
    }
    const guiding = state === "preparing";
    if (guiding) {
      const key = `${heading.toFixed(3)}:${power.toFixed(3)}:${selected}`;
      if (key !== previewKey) {
        previewKey = key;
        guideReplay = simulate({
          stone: selected,
          mode: "standard",
          heading,
          power,
          tilt: 0,
          body: 0,
          phase: 0,
        });
      }
    }
    aim.visible = false;
    aimArrow.visible = guiding;
    aimArrow.position.set(
      -3 + Math.sin(heading) * 3,
      0.15,
      3 - Math.cos(heading) * 3,
    );
    aimArrow.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(Math.sin(heading), 0, -Math.cos(heading)),
    );
    ghostTrail.visible = !!(
      current &&
      ghostReplay &&
      !flight &&
      ["flying", "paused", "result"].includes(state)
    );
    if (ghostTrail.visible)
      ghostTrailGeometry.setDrawRange(
        0,
        state === "result" ? ghostReplay.samples.length : Math.min(ghostReplay.samples.length, Math.floor(playTime * 120) + 1),
      );
    if (preparing) {
      const a = aim.geometry.attributes.position;
      a.setXYZ(
        1,
        -3 + Math.sin(heading) * (6 + power * 18),
        0.04,
        3 - Math.cos(heading) * (6 + power * 18),
      );
      a.needsUpdate = true;
      const d = aim.geometry.attributes.lineDistance;
      d.setX(1, Math.hypot(a.getX(1) - a.getX(0), a.getZ(1) - a.getZ(0)));
      d.needsUpdate = true;
    }
    const appearance = rocks[selected];
    stone.geometry = appearance.geometry;
    stone.material = appearance.material;
    if (current && ["flying", "result", "paused"].includes(state)) {
      const displayTime =
        state === "result"
          ? Math.max(
              0,
              current.events.filter((e) => e.kind === "skip").at(-1)?.t ?? 0,
            ) + 0.025
          : playTime;
      const p = positionAt(current, displayTime);
      stone.visible =
        (state === "result" && current.skips > 0) ||
        playTime < current.duration + 0.15;
      stone.position.set(p.x, p.y, p.z);
      stone.rotation.set(0.035, playTime * 15, 0.025);
      const size = flight
        ? 0.9
        : 0.31 + camera.position.distanceTo(stone.position) * 0.012;
      stone.scale.set(
        size,
        size,
        size,
      );
    } else {
      stone.visible = ["ready", "preparing"].includes(state);
      stone.position.set(-3, 0.13, 3);
      stone.scale.set(
        innerWidth < 760 ? 0.72 : 0.48,
        innerWidth < 760 ? 0.72 : 0.48,
        innerWidth < 760 ? 0.72 : 0.48,
      );
      stone.rotation.set(0.04, 0.4, 0.08);
    }
    if (
      ghostReplay &&
      current &&
      ["flying", "result", "paused"].includes(state)
    ) {
      const p = positionAt(
        ghostReplay,
        state === "result"
          ? (ghostReplay.events.filter((e) => e.kind === "skip").at(-1)?.t ??
              0) + 0.025
          : playTime,
      );
      ghost.visible =
        !flight &&
        ((state === "result" && ghostReplay.skips > 0) ||
          playTime < ghostReplay.duration + 0.15);
      ghost.scale.copy(stone.scale);
      ghost.position.set(p.x + 1.4, p.y + 0.04, p.z);
      ghost.rotation.y = playTime * 19;
    } else ghost.visible = false;
    let index = 0;
    for (const [r, isGhost] of [
      [current, false],
      [ghostReplay, true],
    ]) {
      if (
        (flight && isGhost) ||
        !r ||
        !current ||
        !["flying", "result", "paused"].includes(state)
      )
        continue;
      for (const ev of r.events) {
        if (index >= effects.length) break;
        const fx = effects[index++],
          age = (state === "result" && isGhost ? r.duration + .025 : playTime) - ev.t;
        fx.group.visible = age >= 0 && age < 4.5;
        if (!fx.group.visible) continue;
        fx.group.position.set(ev.x + (isGhost ? 1.4 : 0), 0, ev.z);
        fx.rings.forEach((ring, k) => {
          const radius = 0.18 + age * 0.42 + k * 0.1;
          ring.scale.setScalar(radius);
          ring.material.color.set(isGhost ? 0xf4d495 : 0xf5fffd);
          ring.material.opacity =
            (state === "result" ? 0.8 : Math.max(0, 1 - age / 5.5)) *
            (0.85 - k * 0.12) *
            (isGhost ? 0.28 : 1);
        });
        const scatter = (value) => {
          const n = Math.sin(value * 127.1 + index * 311.7) * 43758.5453;
          return n - Math.floor(n);
        };
        for (let i = 0; i < 220; i++) {
          const angle = scatter(i + 1) * Math.PI * 2,
            vel = 0.5 + scatter(i + 220) * 3.4,
            life = (state === "result" ? Math.min(age, 0.09) : age) * 2.4,
            dist = life * (0.15 + scatter(i + 440) * 1.8);
          fx.points[i * 3] = Math.cos(angle) * dist;
          fx.points[i * 3 + 1] = Math.max(
            -0.1,
            0.04 + vel * life - 3.8 * life * life,
          );
          fx.points[i * 3 + 2] = Math.sin(angle) * dist;
        }
        fx.crown.visible = !flight && (age < 0.4 || state === "result");
        fx.crown.material.color.set(isGhost ? 0xffdf95 : 0xf3fff7);
        fx.crown.material.opacity = isGhost ? 0.025 : 0.065;
        fx.crown.rotation.y = ev.x * 8;
        fx.crown.scale.set(
          (0.75 + (index % 3) * 0.13) * Math.max(1, ev.energy / 12),
          state === "result"
            ? (0.65 + (index % 4) * 0.17) * 2.2
            : Math.max(0.1, 1 - age * 2) * 1.6,
          (0.65 + (index % 5) * 0.12) * Math.max(1, ev.energy / 12),
        );
        fx.splash.geometry.attributes.position.needsUpdate = true;
        fx.splash.visible = age < 0.45 || state === "result";
        fx.splash.scale.set(
          Math.max(1, ev.energy / 17),
          Math.max(1, ev.energy / 12),
          Math.max(1, ev.energy / 17),
        );
        fx.splash.material.opacity = isGhost ? 0.3 : flight ? 0.7 : 0.95;
        fx.splash.material.color.set(isGhost ? 0xffdf95 : 0xf3fff7);
      }
    }
    for (; index < effects.length; index++)
      effects[index].group.visible = false;
    const impact = current?.events
      .filter((e) => e.kind === "skip" && e.t <= playTime)
      .at(-1);
    const sprayAge = impact ? playTime - impact.t : 1;
    skimSpray.visible = !!(
      flight &&
      impact &&
      sprayAge < 0.28 &&
      playTime < current.duration
    );
    if (skimSpray.visible) {
      const dx = Math.sin(current.input.heading),
        dz = -Math.cos(current.input.heading);
      for (let i = 0; i < 180; i++) {
        const f = (Math.sin(i * 173.3) * 43758.54) % 1,
          j = Math.abs(f),
          side = i % 2 ? 1 : -1,
          life = sprayAge + 0.025;
        const lateral = side * (0.32 + j * 0.38 + life * (0.3 + j)),
          back = 0.2 + j * 0.9;
        sprayPositions[i * 3] = impact.x - dz * lateral - dx * back;
        sprayPositions[i * 3 + 1] =
          0.03 + life * (0.8 + j * 3) - 4.9 * life * life;
        sprayPositions[i * 3 + 2] = impact.z + dx * lateral - dz * back;
      }
      sprayGeo.attributes.position.needsUpdate = true;
      skimSpray.material.opacity = 0.85 * (1 - sprayAge / 0.28);
    }
    renderer.render(scene, camera);
    trajectoryGuide.update(guiding ? guideReplay : current, {
      state,
      playTime,
      camera,
      width: innerWidth,
      height: innerHeight,
      guiding,
      reduced: t === 0,
    });
    return {
      launch: project({ x: -3, y: 0.13, z: 3 }),
      player: project(stone.position),
      ghost: ghostReplay && !flight ? project(ghost.position) : null,
    };
  }
  function resize() {
    camera.aspect = (innerWidth / innerHeight) * (innerWidth < 760 ? 1 : 0.8);
    camera.fov = innerWidth < 760 ? 100 : 53;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    bg.material.uniforms.aspect.value = innerWidth / innerHeight;
    water.material.uniforms.viewport.value.set(innerWidth, innerHeight);
    renderer.setPixelRatio(
      Math.min(devicePixelRatio, innerWidth < 760 ? 1.5 : 1.75),
    );
  }
  addEventListener("resize", resize);
  resize();
  return {
    render,
    setReplay,
    setStationary(v) {
      stationary = v;
      if (v) {
        camera.position.set(1.1, 4.2, 14);
        camera.lookAt(1.1, -3.5, -28);
      }
    },
    renderer,
    resize,
  };
}
