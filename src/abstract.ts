// src/abstract.ts
import type { Seg } from "./motifs";

function clamp(v:number,a:number,b:number){ return Math.max(a, Math.min(b, v)); }
function lcg(seed:number){ let s=seed>>>0; return ()=> (s=(s*1664525+1013904223)>>>0)/4294967296; }
function pick<T>(rng:()=>number, arr:T[]){ return arr[Math.floor(rng()*arr.length)]; }

export function planAbstract(width:number, height:number, seed:number, palette:string[]) {
  const rng = lcg(seed);
  const segments: Seg[] = [];
  const BG = palette[0];
  const modes = ["orbits","vines","eddies","waves","petals","weave"] as const;
  const mode = pick(rng, modes);

  const areaK = Math.sqrt((width * height) / (1200 * 800));
  const AGENTS = Math.max(8, Math.min(22, Math.floor(10 * areaK)));
  const agentSpeed = 0.6 + rng() * 0.7;
  const TOTAL = Math.floor(14_000 * areaK);

  const noise = (x:number,y:number)=>{
    return (Math.sin(x*0.006+seed*0.3)*0.5+0.5 + Math.cos(y*0.005-seed*0.2)*0.5+0.5)/2;
  };

  const agents = new Array(AGENTS).fill(0).map(()=> ({
    x: rng()*width, y: rng()*height, hue: Math.floor(rng()*palette.length), life: 200+Math.floor(rng()*800)
  }));

  const cx=width/2, cy=height/2, maxR=Math.hypot(cx,cy);

  function field(x:number,y:number,k:number){
    const nx=x/width, ny=y/height;
    const n=noise(x*0.9+k*400,y*0.9+k*300);
    switch(mode){
      case "orbits": {
        const dx=x-cx, dy=y-cy; const r=Math.hypot(dx,dy)/(maxR+1e-6);
        return Math.atan2(dy,dx)+(0.6+n*0.8)*(1-r*0.6);
      }
      case "vines": return Math.sin(nx*8+n*5)+Math.cos(ny*8+n*5);
      case "eddies": {
        const dx=x-cx*(0.8+0.4*n), dy=y-cy*(1.2-0.4*n);
        return Math.atan2(dy,dx)+(n-0.5)*3.0;
      }
      case "waves": return Math.sin(ny*10+n*6)*1.4+0.2*Math.sin(nx*4);
      case "petals": {
        const dx=x-cx, dy=y-cy; const r=Math.hypot(dx,dy);
        return Math.atan2(dy,dx)+Math.sin(r*0.02+n*8)*1.2;
      }
      case "weave":
      default: return Math.sin(nx*12+n*4)+Math.cos(ny*12+n*4);
    }
  }

  let produced=0;
  while(produced<TOTAL){
    for(let a=0;a<agents.length && produced<TOTAL;a++){
      const A=agents[a];
      if(A.life--<=0){ A.x=rng()*width; A.y=rng()*height; A.life=200+Math.floor(rng()*800); A.hue=Math.floor(rng()*palette.length); }
      const k=produced/TOTAL;
      const ang=field(A.x,A.y,k)+(rng()-0.5)*0.2;
      const dx=Math.cos(ang)*(agentSpeed+rng()*0.8);
      const dy=Math.sin(ang)*(agentSpeed+rng()*0.8);
      const x2=clamp(A.x+dx,0,width), y2=clamp(A.y+dy,0,height);
      const dist=Math.hypot(A.x-width/2,A.y-height/2)/(maxR+1e-6);
      const softness=0.6+(1-dist)*0.6;
      const w=0.6+softness*(0.6+noise(A.x,A.y)*2.4);
      const alpha=0.12+0.3*(1-dist)*(0.3+noise(x2,y2));
      const color=palette[A.hue];
      const hairs=1+Math.floor(rng()*2);
      segments.push({x1:A.x,y1:A.y,x2,y2,w,alpha,color}); produced++;
      for(let h=0;h<hairs && produced<TOTAL;h++){
        const j=(rng()-0.5)*(0.6+rng());
        segments.push({x1:A.x+j,y1:A.y-j,x2:x2+j,y2:y2-j,w:Math.max(0.4,w*(0.35+rng()*0.4)),alpha:alpha*(0.35+rng()*0.5),color});
        produced++;
      }
      A.x=x2; A.y=y2;
    }
  }

  return { name: "abstract-flow", segments, bg: BG, palette };
}
