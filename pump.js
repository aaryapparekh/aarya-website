// Five-piece logo: bounce, inflate, mix, assemble, and reveal.
(() => {
  const hero=document.querySelector('.hero'), logo=document.querySelector('.hero-logo');
  if(!hero||!logo) return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const preview=new URLSearchParams(location.search).has('motion-preview');
  const reviewFrame=preview?new URLSearchParams(location.search).get('motion-at'):null;
  const frozenTime=reviewFrame!==null&&Number.isFinite(Number(reviewFrame))?Math.max(0,Math.min(6.74,Number(reviewFrame))):null;
  const A='M173 232H276L270 260H255L259 382H280L273 410H198L205 382H221L220 353H166L150 382H169L162 410H93L100 382H118L185 260H167ZM180 326H219L217 258Z';
  const P='M404 232H480C521 232 546 249 546 282C546 322 519 345 476 345H443L434 382H455L448 410H367L374 382H391L418 260H398ZM463 260 450 317H467C488 317 500 303 500 281C500 267 492 260 478 260Z';
  const ns='http://www.w3.org/2000/svg';
  const make=(tag,attrs,parent)=>{const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);parent?.append(el);return el;};
  const lerp=(a,b,t)=>a+(b-a)*t, clamp=t=>Math.max(0,Math.min(1,t)), ease=t=>{t=clamp(t);return t*t*(3-2*t);};
  const replay=document.createElement('button');replay.className='motion-replay';replay.textContent='Replay sequence ↗';replay.setAttribute('aria-label','Replay introductory animation');hero.removeAttribute('aria-hidden');hero.append(replay);
  let stop=null;
  function play(){
    if(stop||reduced.matches)return;
    const w=innerWidth,h=innerHeight;
    const svg=make('svg',{viewBox:`0 0 ${w} ${h}`,'aria-hidden':'true','data-motion-stage':'pump'},document.body);
    svg.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:20;pointer-events:none;overflow:hidden';
    const defs=make('defs',{},svg);
    const panels=[...document.querySelectorAll('.topbar,.hero,.identity,.statement,.technical,.dashboard')];
    const original=panels.map(el=>el.style.opacity);
    const originalLogoOpacity=logo.style.opacity;
    logo.style.opacity='0';
    panels.forEach(el=>el.style.opacity='0');replay.hidden=true;
    const skip=document.createElement('button');skip.className='motion-skip';skip.textContent='Skip animation ↗';document.body.append(skip);
    let raf;const controller=new AbortController();
    stop=()=>{cancelAnimationFrame(raf);controller.abort();svg.remove();skip.remove();panels.forEach((el,i)=>el.style.opacity=original[i]);logo.style.opacity=originalLogoOpacity;replay.hidden=!preview||reduced.matches;stop=null;};
    skip.onclick=()=>{stop?.();if(!replay.hidden)replay.focus({preventScroll:true});};
    window.addEventListener('resize',()=>{if(Math.abs(innerWidth-w)>2||Math.abs(innerHeight-h)>2)stop?.();},{signal:controller.signal});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')stop?.();},{signal:controller.signal});
    reduced.addEventListener('change',()=>stop?.(),{signal:controller.signal});
    const path=(d,parent)=>make('path',{d,fill:'#ff450d','fill-rule':'evenodd'},parent);
    const specs=[
      [A,80,232,205,48,210,256],
      [A,80,280,205,75,196,317.5],
      [A,80,355,205,55,186.5,382.5],
      [P,360,232,194,113,456.5,288.5],
      [P,360,345,194,65,411,377.5]
    ];
    const size=Math.min(w/1100,h/650,1),centerY=h*.49,spacing=w*.155;
    const pieces=specs.map(([d,x,y,width,height,cx,cy],i)=>{
      const id='pump-part-'+i,c=make('clipPath',{id},defs);
      make('rect',{x,y,width,height},c);
      const g=make('g',{'data-logo-piece':i,'data-piece-name':i<3?'A'+(i+1):'P'+(i-2)},svg),inner=make('g',{transform:`translate(${-cx} ${-cy})`},g);
      path(d,inner).setAttribute('clip-path',`url(#${id})`);
      // The row and ring share the same cyclic order: A3, A2, A1, P1, P2.
      // These starting angles put all A pieces left and both P pieces right at docking.
      const slot=i===0?2:i===2?0:i;
      const angle=Math.PI*.6+slot/5*Math.PI*2,radius=180*size;
      return {g,cx,cy,top:y-cy,angle,radius,x:w/2+(slot-2)*spacing,y:centerY};
    });
    const dot=make('rect',{x:-10,y:-10,width:20,height:20,rx:10,fill:'#ff450d'},svg);
    // Two playful double taps; each contact adds a lasting increment in size.
    const hits=[{at:.5,i:2},{at:.9,i:1},{at:1.2,i:1},{at:1.6,i:0},{at:2,i:3},{at:2.3,i:3},{at:2.7,i:4}];
    const pieceScale=(i,t)=>{
      const contacts=hits.filter(hit=>hit.i===i),count=contacts.reduce((sum,hit)=>sum+ease((t-hit.at)/.12),0);
      return size*(.43+.32*count/contacts.length);
    };
    const contactPoint=(hit)=>{const p=pieces[hit.i];return {x:p.x,y:p.y+p.top*pieceScale(hit.i,hit.at-.001)-10*size};};
    const mixStart=3.05,orbitStart=3.4,mixEnd=4.85,assembleEnd=5.55,landEnd=6.45,total=6.75;
    const started=performance.now();
    function tick(now){
      const t=frozenTime??(now-started)/1000;
      if(t>=total){stop?.();return;}
      const mix=ease((t-mixStart)/(orbitStart-mixStart)),orbit=ease((t-orbitStart)/(mixEnd-orbitStart)),assemble=ease((t-mixEnd)/(assembleEnd-mixEnd)),land=ease((t-assembleEnd)/(landEnd-assembleEnd));
      const box=logo.getBoundingClientRect(),fit=Math.min(w*.66/468,h*.32/194);
      const targetScale=lerp(fit,box.width/468,land),targetX=lerp(w/2-234*fit,box.left,land),targetY=lerp(centerY-97*fit,box.top,land);
      pieces.forEach((p,i)=>{
        let scale=pieceScale(i,t),sx=1,sy=1;
        for(const hit of hits.filter(hit=>hit.i===i)){
          const age=t-hit.at;
          if(age>=0&&age<.28){const pulse=Math.sin(age/.28*Math.PI)*Math.exp(-age*5);sx+=pulse*.18;sy-=pulse*.16;}
        }
        let x=p.x,y=p.y,rotation=0;
        if(t>=mixStart){
          // One shared ring: fixed slot spacing, shared angular progress, one complete lap.
          const angle=p.angle+orbit*Math.PI*2;
          x=lerp(p.x,w/2+Math.cos(angle)*p.radius,mix);
          y=lerp(p.y,centerY+Math.sin(angle)*p.radius*.85,mix);
          rotation=Math.sin(orbit*Math.PI*2)*7;
          if(t>=mixEnd){
            x=lerp(x,targetX+(p.cx-86)*targetScale,assemble);
            y=lerp(y,targetY+(p.cy-224)*targetScale,assemble);
            scale=lerp(scale,targetScale,assemble);
            rotation=0;
          }
        }
        p.g.setAttribute('opacity',ease(t/.2));
        p.g.setAttribute('transform',`translate(${x} ${y}) rotate(${rotation}) scale(${scale*sx} ${scale*sy})`);
      });
      let dx=w/2,dy=centerY-75*size,rotation=0,dotScale=size;
      if(t<mixStart){
        const next=hits.find(hit=>hit.at>t);
        if(next){
          const index=hits.indexOf(next),prev=index?hits[index-1]:{at:0,i:0};
          const from=index?contactPoint(prev):{x:pieces[hits[0].i].x-35*size,y:centerY-100*size},to=contactPoint(next);
          const q=clamp((t-prev.at)/(next.at-prev.at));
          dx=lerp(from.x,to.x,q);dy=lerp(from.y,to.y,q)-Math.sin(q*Math.PI)*65*size;
        }else{
          const from=contactPoint(hits[hits.length-1]),q=ease((t-2.7)/.35);
          dx=lerp(from.x,w/2,q);dy=lerp(from.y,centerY,q)-Math.sin(q*Math.PI)*35*size;
        }
      }else{
        dx=w/2;dy=centerY;rotation=orbit*720;
        if(t>=mixEnd){dx=lerp(dx,targetX+(320.5-86)*targetScale,assemble);dy=lerp(dy,targetY+(390-224)*targetScale,assemble);dotScale=lerp(size,2*targetScale,assemble);}
      }
      dot.setAttribute('rx',10*(1-mix));
      dot.setAttribute('transform',`translate(${dx} ${dy}) rotate(${rotation}) skewX(${-14.036*assemble}) scale(${dotScale})`);
      panels.forEach((el,i)=>el.style.opacity=String(ease((t-5.7-i*.04)/.5)));
      if(t>landEnd){const fade=ease((t-landEnd)/.3);svg.style.opacity=String(1-fade);logo.style.opacity=String(fade);}
      if(frozenTime===null)raf=requestAnimationFrame(tick);
    }
    raf=requestAnimationFrame(tick);
  }
  replay.hidden=!preview||reduced.matches;replay.onclick=play;
  reduced.addEventListener('change',()=>replay.hidden=!preview||reduced.matches);
  if(scrollY<20&&!reduced.matches)play();
})();
