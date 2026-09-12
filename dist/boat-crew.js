import * as THREE from 'three';

const skinTones = [0xc28c62, 0xe8b68b, 0x845b43, 0xdca278];
const shirtColors = [0x285c72, 0xc86b43, 0xf0e3bf, 0x6c8460];
const sphere = new THREE.SphereGeometry(1, 12, 8);
const cloth = color => new THREE.MeshStandardMaterial({ color, roughness: .88 });
const trousers = cloth(0x293c48), hair = cloth(0x44392d), straw = cloth(0xd8bd83), paper = cloth(0xf4e9c9);
function blob(parent, material, position, scale) {
  const mesh = new THREE.Mesh(sphere, material);
  mesh.position.set(...position); mesh.scale.set(...scale); parent.add(mesh); return mesh;
}
function limb(parent, a, b, material, radius = .016) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 8), material);
  mesh.position.copy(start.add(end).multiplyScalar(.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); parent.add(mesh); return mesh;
}
export function addCrew(boat, index) {
  const passengers = [];
  for (let i = 0; i < 2; i++) {
    const person = new THREE.Group(), seated = i === 1;
    const skin = cloth(skinTones[(index + i) % 4]), shirt = cloth(shirtColors[(index + i) % 4]);
    const hip = seated ? .105 : .18, shoulder = hip + .145;
    blob(person, shirt, [0, hip + .08, 0], [.064, .092, .043]);
    blob(person, trousers, [0, hip, 0], [.053, .036, .039]);
    for (const side of [-1, 1]) {
      const knee = [side * .032, seated ? .10 : .085, seated ? .10 : .012];
      limb(person, [side * .032, hip, 0], knee, trousers, .022);
      limb(person, knee, [side * .032, .014, seated ? .10 : .025], trousers, .018);
      blob(person, trousers, [side * .032, .012, seated ? .12 : .04], [.024, .015, .045]);
    }
    const head = new THREE.Group(); head.position.y = shoulder + .063; person.add(head);
    blob(head, skin, [0, 0, 0], [.043, .052, .041]);
    blob(head, hair, [0, .027, -.007], [.045, .03, .041]);
    blob(head, skin, [0, -.003, .039], [.012, .013, .012]);
    if ((index + i) % 2 === 0) {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(.066, .066, .009, 20), straw);
      brim.position.y = .041; head.add(brim);
      blob(head, straw, [0, .055, 0], [.043, .028, .042]);
    }
    const activity = i === 0 ? 'steering' : ['reading', 'fishing', 'looking', 'resting'][index % 4];
    const hands = activity === 'fishing' ? [[-.06, shoulder-.04, .09],[.10, shoulder-.015, .14]] : [[-.055, shoulder-.075, .115],[.055, shoulder-.075, .115]];
    for (let j = 0; j < 2; j++) {
      const side = j === 0 ? -1 : 1, elbow = [side*.083, shoulder-.07, .045];
      limb(person, [side*.055, shoulder, 0], elbow, shirt, .02);
      limb(person, elbow, hands[j], skin, .014);
      blob(person, skin, hands[j], [.019,.018,.016]);
    }
    if (activity === 'reading') {
      for (const side of [-1, 1]) {
        const page = new THREE.Mesh(new THREE.BoxGeometry(.065,.008,.095), paper);
        page.position.set(side*.03, shoulder-.085, .13); page.rotation.z = side * -.2; person.add(page);
      }
    }
    if (activity === 'fishing') {
      limb(person, [.1, shoulder-.025,.13], [.16,.61,.66], hair, .005);
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(.16,.61,.66),new THREE.Vector3(.2,.22,.88),new THREE.Vector3(.22,-.27,.96)]);
      person.add(new THREE.Mesh(new THREE.TubeGeometry(curve,12,.0018,4,false),paper));
    }
    if (activity === 'steering') {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(.067,.008,6,18), straw);
      wheel.position.set(0,shoulder-.08,.15); person.add(wheel);
      for (let j=0;j<3;j++) {
        const angle=j*Math.PI/3;
        limb(person,[-Math.cos(angle)*.063,shoulder-.08-Math.sin(angle)*.063,.15],[Math.cos(angle)*.063,shoulder-.08+Math.sin(angle)*.063,.15],straw,.004);
      }
      limb(person,[0,0,.16],[0,shoulder-.08,.16],hair,.015);
    }
    person.position.set(i === 0 ? -.67 : .44, .215, i === 0 ? .12 : .23);
    person.rotation.y = i === 0 ? -.6 : .2;
    boat.add(person); passengers.push({person,head,activity,phase:index*1.7+i});
  }
  return time => {
    for (const p of passengers) {
      p.head.rotation.y = Math.sin(time*.35+p.phase)*.16;
      p.head.rotation.x = p.activity === 'reading' ? .28 : Math.sin(time*.45+p.phase)*.045;
      p.person.rotation.z = Math.sin(time*.65+p.phase)*.015;
    }
  };
}
