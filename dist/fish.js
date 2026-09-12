import * as THREE from 'three';

function troutTexture() {
  const c = document.createElement('canvas'); c.width=512; c.height=256;
  const ctx=c.getContext('2d'), gradient=ctx.createLinearGradient(0,0,0,256);
  gradient.addColorStop(0,'#394f3e'); gradient.addColorStop(.23,'#819179');
  gradient.addColorStop(.48,'#bfaaa1'); gradient.addColorStop(.59,'#abbdb0'); gradient.addColorStop(1,'#dddcc4');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,512,256);
  // Fine overlapping scales and irregular dark trout markings.
  for(let y=0;y<256;y+=9) for(let x=0;x<512;x+=11){
    ctx.strokeStyle='rgba(236,244,212,.13)';ctx.beginPath();ctx.arc(x+(y%18?5:0),y,5,0,Math.PI);ctx.stroke();
  }
  for(let i=0;i<165;i++){
    const x=((Math.sin(i*67.13)*43758.54)%1+1)%1*512;
    const y=((Math.sin(i*39.41+2)*17543.3)%1+1)%1*155;
    ctx.fillStyle='rgba(23,43,32,.55)';ctx.beginPath();ctx.ellipse(x,y,1.2+(i%3)*.5,1+(i%2)*.6,.4,0,Math.PI*2);ctx.fill();
  }
  const texture=new THREE.CanvasTexture(c); texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function bodyGeometry(){
  const points=[],uv=[],indices=[],rows=32,sides=20;
  for(let i=0;i<=rows;i++){
    const u=i/rows, x=-.48+u*.98;
    const radius=.012+.105*Math.pow(Math.sin(Math.PI*u),.9)*( .65+.55*u );
    for(let j=0;j<=sides;j++){
      const angle=j/sides*Math.PI*2;
      points.push(x,Math.cos(angle)*radius,Math.sin(angle)*radius*.66);
      uv.push(u,(1-Math.cos(angle))*.5);
      if(i<rows&&j<sides){const a=i*(sides+1)+j;indices.push(a,a+1,a+sides+1,a+1,a+sides+2,a+sides+1);}
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function finGeometry(points){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,.2,.5,1],2));g.computeVertexNormals();return g;
}
export function createFish(renderer, environment){
  const scene=new THREE.Scene();scene.environment=environment;scene.environmentIntensity=.55;
  scene.add(new THREE.HemisphereLight(0xc8ecdf,0x244c45,1.35));
  const light=new THREE.DirectionalLight(0xe9eac4,.8);light.position.set(8,10,4);scene.add(light);
  const target=new THREE.WebGLRenderTarget(1,1,{depthBuffer:true});
  const time={value:0};
  const bodyMaterial=new THREE.MeshStandardMaterial({map:troutTexture(),color:0xb3c5b3,roughness:.4,metalness:.22,side:THREE.DoubleSide});
  bodyMaterial.onBeforeCompile=shader=>{
    shader.uniforms.fishTime=time;
    shader.vertexShader='uniform float fishTime;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float tail = max(0., .45-position.x);
      transformed.z += sin(fishTime*5.5+modelMatrix[3].x*.7+modelMatrix[3].z*.4-position.x*8.)*tail*tail*.065;`);
  };
  const fins=new THREE.MeshStandardMaterial({color:0x808e73,roughness:.6,side:THREE.DoubleSide,transparent:true,opacity:.78,depthWrite:false});
  const tailMaterial=fins.clone();
  fins.onBeforeCompile=bodyMaterial.onBeforeCompile;
  const eyeMaterial=new THREE.MeshStandardMaterial({color:0x111b17,roughness:.18});
  const body=bodyGeometry(), eyeGeo=new THREE.SphereGeometry(.014,8,6);
  const dorsal=finGeometry([[-.22,.075,0],[.15,.10,0],[-.06,.24,0]]);
  const pectoral=finGeometry([[.19,-.01,.04],[-.04,-.06,.19],[.01,-.07,.035]]);
  const mirroredPectoral=pectoral.clone().scale(1,1,-1);
  const tailGeo=new THREE.BufferGeometry();tailGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-.19,.15,0,-.13,0,0,0,0,0,-.13,0,0,-.19,-.15,0],3));tailGeo.computeVertexNormals();
  const fish=[];
  for(let i=0;i<12;i++){
    const group=new THREE.Group(); group.add(new THREE.Mesh(body,bodyMaterial));group.add(new THREE.Mesh(dorsal,fins));
    for(const side of [-1,1]){
      const fin=new THREE.Mesh(side<0?mirroredPectoral:pectoral,fins);group.add(fin);
      const eye=new THREE.Mesh(eyeGeo,eyeMaterial);eye.position.set(.38,.028,side*.047);group.add(eye);
    }
    const tail=new THREE.Mesh(tailGeo,tailMaterial);tail.position.x=-.48;group.add(tail);
    const size=.65+(i%4)*.15;group.scale.setScalar(size);
    scene.add(group);
    fish.push({group,tail,index:i,baseX:i<6?-1.7+(i%3)*1.5:-3+(i%3)*5,baseZ:i<6?4+(i%2)*1.6:-8-Math.floor((i-6)/3)*13,depth:.38+(i%4)*.18});
  }
  function resize(){const scale=Math.min(1,1280/innerWidth,900/innerHeight);target.setSize(Math.round(innerWidth*scale),Math.round(innerHeight*scale));}
  resize();
  return {texture:target.texture,resize,render(t,camera){
    time.value=t;
    for(const f of fish){
      const phase=t*(.10+(f.index%3)*.012)+f.index*.71;
      const rx=2.3,rz=1.3;
      f.group.position.set(f.baseX+Math.cos(phase)*rx,-f.depth+Math.sin(t*.7+f.index)*.035,f.baseZ+Math.sin(phase)*rz);
      // Local +X is the nose; align it with the tangent of the swimming path.
      f.group.rotation.y=-Math.atan2(Math.cos(phase)*rz,-Math.sin(phase)*rx);
      f.group.rotation.z=Math.sin(t*.65+f.index)*.025;
      const tailPhase=t*5.5+f.group.position.x*.7+f.group.position.z*.4+.48*8;
      f.tail.position.z=Math.sin(tailPhase)*.93*.93*.065;
      f.tail.rotation.y=Math.sin(tailPhase)*.25;
    }
    renderer.setRenderTarget(target);renderer.setClearColor(0,0);renderer.clear();renderer.render(scene,camera);
    renderer.setRenderTarget(null);renderer.setClearColor(0,1);
  },dispose(){
    target.dispose();bodyMaterial.map.dispose();bodyMaterial.dispose();fins.dispose();tailMaterial.dispose();eyeMaterial.dispose();
    for(const g of [body,eyeGeo,dorsal,pectoral,tailGeo])g.dispose();
  }};
}
