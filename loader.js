// CAD loader study. The extrusion is built from the production SVG contours:
// no raster logo, 3D library, build step, or changes to the website's real loader.
(() => {
  'use strict';
  const canvas=document.querySelector('#cad-stage'),ctx=canvas.getContext('2d');
  const el=id=>document.getElementById(id),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t;
  const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
  const phase=(t,a,b)=>ease((t-a)/(b-a));
  const settings={depth:48,planes:5,duration:8,angle:18};
  const query=new URLSearchParams(location.search);
  for(const key of Object.keys(settings)){
    const input=el(key),raw=query.get(key),value=Number(raw);
    if(raw!==null&&Number.isFinite(value))input.value=clamp(value,Number(input.min),Number(input.max));
    settings[key]=Number(input.value);
  }
  let shapes=[],width=0,height=0,dpr=1,progress=0,playing=false,raf=0,last=0;
  let yawOffset=0,pitchOffset=0,drag=null,lastPhase=-1;
  const status=[['Reference planes','Establishing the coordinate system'],['Sketch profiles','Tracing the exact A.P vector contours'],['Constrain & extrude','Connecting profiles along the depth axis'],['Build the solid','Resolving surfaces from the wireframe'],['Identity resolved','A.P / one continuous, dimensional form']];
  function updateSettings(){
    for(const key of Object.keys(settings)){
      settings[key]=Number(el(key).value);
      el(key+'-value').textContent=settings[key]+({depth:' u',duration:' s',angle:'°'}[key]||'');
    }
  }
  updateSettings();
  // Sample outer and inner contours independently to retain both letter counters.
  async function buildLogo(){
    const response=await fetch('ap-logo.svg');if(!response.ok)throw Error('Logo could not be loaded');
    const svg=new DOMParser().parseFromString(await response.text(),'image/svg+xml');
    if(svg.querySelector('parsererror'))throw Error('Invalid SVG');
    shapes=[...svg.querySelectorAll('path')].map(original=>({
      contours:(original.getAttribute('d').match(/[Mm][^Mm]*/g)||[]).map((d,index)=>{
        const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',d);
        const length=path.getTotalLength(),count=Math.max(12,Math.ceil(length/4));
        const points=Array.from({length:count},(_,i)=>{const p=path.getPointAtLength(length*i/count);return{x:p.x-320,y:p.y-321};});
        const area=points.reduce((sum,p,i)=>{const q=points[(i+1)%count];return sum+p.x*q.y-q.x*p.y;},0);
        return{points,length,hole:index>0,orientation:Math.sign(area)||1};
      })
    }));
  }
  function resize(){
    const box=canvas.getBoundingClientRect();width=box.width;height=box.height;dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);draw();
  }
  let transform;
  function setupProjection(t){
    const turn=phase(t,.67,.98),yaw=mix(-.58,-settings.angle*Math.PI/180,turn)+yawOffset;
    const pitch=mix(-.34,-.13,turn)+pitchOffset;
    const cy=Math.cos(yaw),sy=Math.sin(yaw),cx=Math.cos(pitch),sx=Math.sin(pitch);
    const scale=Math.min(width/780,height/400),center={x:width*.5,y:height*.53};
    transform=(p,z=0)=>{const x=p.x*cy+z*sy,zz=-p.x*sy+z*cy,y=p.y*cx-zz*sx;return{x,y,z:p.y*sx+zz*cx};};
    return(p,z=0)=>{const q=transform(p,z),perspective=1000/(1000-q.z);return{x:center.x+q.x*scale*perspective,y:center.y+q.y*scale*perspective,z:q.z};};
  }
  function line(project,a,b,z,color,width=1){
    const p=project(a,z),q=project(b,z);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
  }
  function contourPath(project,contour,z,fraction=1){
    const points=contour.points,n=points.length,limit=clamp(fraction)*n;
    const start=project(points[0],z);ctx.moveTo(start.x,start.y);
    for(let i=1;i<=Math.floor(limit);i++){const p=project(points[i%n],z);ctx.lineTo(p.x,p.y);}
    if(fraction>=1)ctx.closePath();
    else{const i=Math.floor(limit),q=mix(0,1,limit-i),a=points[i%n],b=points[(i+1)%n],p=project({x:mix(a.x,b.x,q),y:mix(a.y,b.y,q)},z);ctx.lineTo(p.x,p.y);}
  }
  function grid(project,t,spread){
    const opacity=mix(.85,.24,phase(t,.73,.98))*phase(t,0,.12);
    const z=-spread*.5-22;
    for(let x=-480;x<=480;x+=40)line(project,{x,y:-240},{x,y:240},z,`rgba(150,156,166,${opacity*(x===0?.3:.095)})`);
    for(let y=-240;y<=240;y+=40)line(project,{x:-480,y},{x:480,y},z,`rgba(150,156,166,${opacity*(y===0?.3:.095)})`);
    line(project,{x:-420,y:0},{x:420,y:0},z,`rgba(255,69,13,${opacity*.28})`);
    // Reference-plane frames follow the same depth spacing as the actual profiles.
    const fade=1-phase(t,.62,.85);
    for(let i=0;i<settings.planes;i++){
      const depth=mix(-spread/2,spread/2,i/(settings.planes-1));
      const corners=[{x:-254,y:-119},{x:254,y:-119},{x:254,y:119},{x:-254,y:119}];
      corners.forEach((p,j)=>line(project,p,corners[(j+1)%4],depth,`rgba(167,174,185,${opacity*fade*.16})`));
      const label=project({x:-254,y:-130},depth);ctx.font='8px monospace';ctx.fillStyle=`rgba(167,174,185,${opacity*fade*.55})`;ctx.fillText('PLN / '+String(i+1).padStart(2,'0'),label.x,label.y);
    }
  }
  function sketches(project,t,spread){
    const solid=phase(t,.57,.79),fade=1-phase(t,.7,.91);
    for(let plane=0;plane<settings.planes;plane++){
      const z=mix(-spread/2,spread/2,plane/(settings.planes-1));
      const draw=phase(t,.11+plane*.028,.32+plane*.028);
      ctx.beginPath();shapes.forEach(shape=>shape.contours.forEach(c=>contourPath(project,c,z,draw)));
      ctx.strokeStyle=plane===settings.planes-1?`rgba(255,85,30,${fade*.92})`:`rgba(173,184,197,${fade*.38})`;
      ctx.lineWidth=plane===settings.planes-1?1.2:.7;ctx.stroke();
    }
    const bridges=phase(t,.4,.58)*(1-solid);
    if(bridges>0)shapes.forEach(shape=>shape.contours.forEach(c=>{
      const step=Math.max(1,Math.round(c.points.length/18));
      for(let i=0;i<c.points.length;i+=step){const a=project(c.points[i],-spread/2),b=project(c.points[i],mix(-spread/2,spread/2,phase(t,.4,.58)));ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=`rgba(255,69,13,${bridges*.4})`;ctx.lineWidth=.65;ctx.stroke();}
    }));
  }
  function solidLogo(project,t,depth){
    const alpha=phase(t,.57,.79);if(alpha<=0)return;
    const faces=[];
    for(const shape of shapes){
      for(const c of shape.contours){
        for(let i=0;i<c.points.length;i++){
          const a=c.points[i],b=c.points[(i+1)%c.points.length],factor=c.orientation*(c.hole?-1:1);
          const normal=transform({x:(b.y-a.y)*factor,y:-(b.x-a.x)*factor},0);
          if(normal.z<=0)continue;
          const points=[project(a,-depth/2),project(b,-depth/2),project(b,depth/2),project(a,depth/2)];
          const len=Math.hypot(b.x-a.x,b.y-a.y),light=clamp(.5+(-normal.x*.3-normal.y*.45+normal.z*.35)/len,.2,.95);
          faces.push({points,z:points.reduce((sum,p)=>sum+p.z,0)/4,color:`rgb(${Math.round(170+65*light)},${Math.round(25+34*light)},${Math.round(7+7*light)})`});
        }
      }
      const front=transform({x:0,y:0},1).z>0,z=front?depth/2:-depth/2;
      const contours=shape.contours.map(c=>c.points.map(p=>project(p,z)));
      faces.push({contours,z:contours[0].reduce((sum,p)=>sum+p.z,0)/contours[0].length,color:front?'#ff450d':'#ab2e0b'});
    }
    faces.sort((a,b)=>a.z-b.z);ctx.save();ctx.globalAlpha=alpha;
    faces.forEach(face=>{
      ctx.beginPath();for(const contour of face.contours||[face.points]){ctx.moveTo(contour[0].x,contour[0].y);contour.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.closePath();}
      ctx.fillStyle=face.color;ctx.fill('evenodd');
      // Subpixel side-face seams are covered without outlining the front face.
      if(!face.contours){ctx.strokeStyle=face.color;ctx.lineWidth=.6;ctx.stroke();}
    });ctx.restore();
    const edge=phase(t,.71,.9);ctx.beginPath();shapes.forEach(shape=>shape.contours.forEach(c=>contourPath(project,c,depth/2)));
    ctx.strokeStyle=`rgba(255,149,106,${edge*.32})`;ctx.lineWidth=.75;ctx.stroke();
  }
  function dimensions(project,t,spread){
    const opacity=phase(t,.24,.42)*(1-phase(t,.68,.86));if(opacity<=0)return;
    const z=spread/2,color=`rgba(169,175,185,${opacity*.5})`;
    line(project,{x:-227,y:119},{x:227,y:119},z,color,.7);
    for(const x of [-227,227])line(project,{x,y:113},{x,y:125},z,color,.7);
    const p=project({x:0,y:135},z);ctx.fillStyle=color;ctx.font='9px monospace';ctx.textAlign='center';ctx.fillText('AP / 454.00',p.x,p.y);ctx.textAlign='left';
  }
  function draw(){
    if(!width||!height||!shapes.length)return;
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
    const project=setupProjection(progress),spread=mix(170,settings.depth,phase(progress,.43,.67));
    grid(project,progress,spread);sketches(project,progress,spread);solidLogo(project,progress,settings.depth);dimensions(project,progress,spread);
    const index=progress<.12?0:progress<.43?1:progress<.59?2:progress<.82?3:4;
    if(index!==lastPhase){lastPhase=index;el('phase-index').textContent=String(index+1).padStart(2,'0');el('phase-name').textContent=status[index][0];el('phase-detail').textContent=status[index][1];}
    el('view-label').textContent=progress<.82?'ISOMETRIC CONSTRUCTION':'SOLID / PERSPECTIVE';
    el('time').textContent=(progress*settings.duration).toFixed(1).padStart(4,'0')+' / '+settings.duration.toFixed(1).padStart(4,'0')+' s';
    el('timeline').value=Math.round(progress*1000);el('progress-value').textContent=Math.round(progress*100)+'%';
    el('pause').textContent=playing?'Pause':progress>=1?'Play again':'Play';
  }
  function tick(now){
    if(!playing)return;
    if(last)progress=clamp(progress+Math.min((now-last)/1000,.1)/settings.duration);
    last=now;if(progress>=1)playing=false;draw();if(playing)raf=requestAnimationFrame(tick);
  }
  function setPlaying(value){cancelAnimationFrame(raf);playing=value;last=0;draw();if(playing)raf=requestAnimationFrame(tick);}
  function replay(){progress=0;yawOffset=pitchOffset=0;setPlaying(true);}
  el('replay').addEventListener('click',replay);
  el('pause').addEventListener('click',()=>{if(progress>=1)progress=0;setPlaying(!playing);});
  el('timeline').addEventListener('input',event=>{const value=Number(event.target.value)/1000;setPlaying(false);progress=value;draw();});
  for(const key of Object.keys(settings))el(key).addEventListener('input',()=>{updateSettings();draw();});
  el('copy').addEventListener('click',async()=>{
    const url=new URL(location.href);for(const [key,value] of Object.entries(settings))url.searchParams.set(key,value);
    try{await navigator.clipboard.writeText(url.href);el('lab-note').textContent='Settings link copied. The main website loader remains unchanged.';}
    catch{el('lab-note').textContent='Settings link: '+url.href;}
  });
  canvas.addEventListener('pointerdown',event=>{if(progress<.79)return;setPlaying(false);drag={x:event.clientX,y:event.clientY,yaw:yawOffset,pitch:pitchOffset};canvas.setPointerCapture(event.pointerId);});
  canvas.addEventListener('pointermove',event=>{if(!drag)return;yawOffset=drag.yaw+(event.clientX-drag.x)*.006;pitchOffset=clamp(drag.pitch+(event.clientY-drag.y)*.004,-.65,.65);draw();});
  const release=()=>drag=null;canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
  new ResizeObserver(resize).observe(canvas);
  reduced.addEventListener('change',()=>{if(reduced.matches){progress=1;setPlaying(false);}});
  document.addEventListener('visibilitychange',()=>{last=0;});
  buildLogo().then(()=>{resize();if(reduced.matches){progress=1;draw();el('lab-note').textContent='Reduced motion: paused on the final solid. Replay is available on demand.';}else replay();}).catch(error=>{el('lab-note').textContent=error.message+'. Serve this folder using a local HTTP server.';el('replay').disabled=el('pause').disabled=true;});
})();
