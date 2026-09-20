// Keep the illustrated rabbit in its original setting and gently deform only
// its head/ears while a moving, open hand strokes it. Coordinates follow cover.
export function createBunnyInteraction({world,background,response,reducedMotion}){
  // This small overlay is clipped to the ears. Never filter or transform the
  // background image: an SVG filter on it can shift the entire painted scene.
  const ears=document.createElement('canvas');ears.id='bunny-ears';ears.setAttribute('aria-hidden','true');
  ears.style.cssText='position:absolute;pointer-events:none;z-index:1;';world.append(ears);
  const ctx=ears.getContext('2d');let earPaths=[],headPath=null,patch=null;
  let headAngle=0,headVelocity=0,earAngle=0,earVelocity=0,strokeDirection=0,previousTime=0;
  let bounds={x:0,y:0,rx:1,ry:1},last=null,travel=0,activeUntil=0,lastStroke=0;
  function resize(){
    const w=world.clientWidth,h=world.clientHeight,mobile=w<=700;
    const iw=mobile?1024:1672,ih=mobile?1536:941,scale=Math.max(w/iw,h/ih),ox=(w-iw*scale)/2,oy=(h-ih*scale)/2;
    bounds={x:ox+(mobile?215:190)*scale,y:oy+(mobile?1142:679)*scale,rx:(mobile?114:83)*scale,ry:(mobile?100:65)*scale};
    response.style.left=Math.max(28,bounds.x)+'px';response.style.top=(bounds.y-bounds.ry*.5)+'px';
    const polygons=mobile?[
      [[108,1143],[141,1129],[191,1105],[225,1099],[206,1126],[159,1150],[121,1156]],
      [[111,1164],[151,1136],[209,1110],[197,1138],[163,1167],[133,1180],[115,1177]]
    ]:[
      [[117,690],[141,675],[177,656],[201,651],[188,670],[151,691],[126,697]],
      [[124,702],[153,680],[190,659],[179,688],[152,708],[133,712]]
    ];
    const head=mobile?[[199,1101],[221,1088],[245,1089],[267,1101],[277,1122],[267,1148],[245,1164],[215,1171],[195,1148]]:[[178,654],[195,644],[216,644],[234,652],[242,668],[234,687],[216,704],[192,707],[177,686]];
    const flat=[...polygons.flat(),...head],left=Math.min(...flat.map(p=>p[0]))-4,top=Math.min(...flat.map(p=>p[1]))-4;
    const pw=Math.max(...flat.map(p=>p[0]))-left+4,ph=Math.max(...flat.map(p=>p[1]))-top+4;
    patch={left,top,pw,ph,scale,pivot:mobile?[219,1162]:[201,702]};ears.width=Math.ceil(pw*2);ears.height=Math.ceil(ph*2);
    ears.style.left=(ox+left*scale)+'px';ears.style.top=(oy+top*scale)+'px';ears.style.width=pw*scale+'px';ears.style.height=ph*scale+'px';
    const makePath=points=>{const path=new Path2D();points.forEach(([x,y],i)=>path[i?'lineTo':'moveTo']((x-left)*2,(y-top)*2));path.closePath();return path;};earPaths=polygons.map(makePath);headPath=makePath(head);reset();
  }
  function reset(){last=null;travel=0;activeUntil=0;response.classList.remove('is-petted');world.dataset.bunnyPetted='false';ears.dataset.moving='false';headAngle=0;headVelocity=0;earAngle=0;earVelocity=0;strokeDirection=0;ctx.clearRect(0,0,ears.width,ears.height);}

  function hand(x,y,open){
    const now=performance.now(),near=open&&Math.hypot((x-bounds.x)/bounds.rx,(y-bounds.y)/bounds.ry)<1.3;
    if(!near){last=null;travel=0;return false;}
    if(last){const step=Math.hypot(x-last.x,y-last.y);if(step<55){travel+=step;strokeDirection=Math.max(-1,Math.min(1,(x-last.x)/12));}}
    last={x,y};
    if(travel>Math.max(8,bounds.rx*.22)&&now-lastStroke>180){activeUntil=now+1450;lastStroke=now;travel=0;}
    return true;
  }
  function render(now){
    const active=now<activeUntil;
    response.classList.toggle('is-petted',active);world.dataset.bunnyPetted=String(active);
    ctx.clearRect(0,0,ears.width,ears.height);ears.dataset.moving=String(active&&!reducedMotion);
    const dt=Math.min(.035,previousTime?(now-previousTime)/1000:.016);previousTime=now;
    const comfort=active?Math.min(1,(activeUntil-now)/450):0;
    // Damped springs: head accepts the stroke; softer ears follow with a lag.
    const target=comfort*(.018+strokeDirection*.018);
    headVelocity+=((target-headAngle)*110-headVelocity*18)*dt;headAngle+=headVelocity*dt;
    earVelocity+=((headAngle*1.6+comfort*Math.sin(now*.01)*.025-earAngle)*58-earVelocity*9)*dt;earAngle+=earVelocity*dt;
    ears.dataset.headAngle=headAngle.toFixed(4);ears.dataset.earAngle=earAngle.toFixed(4);
    if((active||Math.abs(headAngle)>.0004)&&!reducedMotion&&background.complete&&background.naturalWidth){
      const {left,top,pw,ph,pivot}=patch,px=(pivot[0]-left)*2,py=(pivot[1]-top)*2;
      function drawPart(path,angle){
        ctx.save();ctx.clip(path);ctx.translate(px,py);ctx.rotate(angle);ctx.translate(-px,-py);
        ctx.drawImage(background,left,top,pw,ph,0,0,pw*2,ph*2);

        ctx.restore();
      }
      drawPart(headPath,headAngle);
      earPaths.forEach((path,i)=>drawPart(path,earAngle*(i?1.3:1)));
    }
  }

  resize();return {hand,render,resize,reset,getLayout:()=>({...bounds})};
}
