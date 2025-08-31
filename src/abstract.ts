
import type { PlanResult, Seg } from "./motifs";
import { line, ellipse, circle } from "./motifs";

export function planAbstract(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const bg=palette[0]; const c1=palette[3], c2=palette[2], c3=palette[4];
  let s = seed>>>0; const rng = ()=> (s=(s*1664525+1013904223)>>>0)/4294967296;
  const cx=w*0.5, cy=h*0.5;
  let px=cx, py=cy;
  for(let i=0;i<1200;i++){
    const ang = rng()*Math.PI*2, r = rng()*Math.min(w,h)*0.48;
    const x=cx+Math.cos(ang)*r, y=cy+Math.sin(ang)*r;
    const col = i%3===0?c1:(i%3===1?c2:c3);
    line(seg, px,py, x,y, 2.5, 0.35 + 0.5*(rng()), col);
    px=x; py=y;
  }
  return { name:"abstract-flow", segments:seg, bg, palette };
}
