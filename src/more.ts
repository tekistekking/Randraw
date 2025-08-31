
import type { Seg, PlanResult } from "./motifs";
import { line, poly, circle, ellipse } from "./motifs";

export function person(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const bg=palette[0], lineC=palette[1]; const gx=w*0.5, gy=h*0.6, R=Math.min(w,h)*0.08;
  circle(seg, gx, gy-R*2, R*0.7, 3, 0.9, lineC);
  line(seg, gx, gy-R*1.3, gx, gy+R*1.3, 4, 0.9, lineC);
  line(seg, gx, gy-R*0.3, gx-R*0.9, gy+R*0.6, 4, 0.9, lineC);
  line(seg, gx, gy-R*0.3, gx+R*0.9, gy+R*0.6, 4, 0.9, lineC);
  line(seg, gx, gy+R*1.3, gx-R*0.7, gy+R*2.2, 4, 0.9, lineC);
  line(seg, gx, gy+R*1.3, gx+R*0.7, gy+R*2.2, 4, 0.9, lineC);
  return { name:"person", segments:seg, bg, palette:palette };
}
export function personField(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const sky=palette[0], grass=palette[2], flower=palette[4], lineC=palette[1];
  const gx=w*0.5, gy=h*0.6, R=Math.min(w,h)*0.08;
  circle(seg, gx, gy-R*2, R*0.7, 3, 0.9, lineC);
  line(seg, gx, gy-R*1.3, gx, gy+R*1.3, 4, 0.9, lineC);
  line(seg, gx, gy-R*0.3, gx-R*0.9, gy+R*0.6, 4, 0.9, lineC);
  line(seg, gx, gy-R*0.3, gx+R*0.9, gy+R*0.6, 4, 0.9, lineC);
  line(seg, gx, gy+R*1.3, gx-R*0.7, gy+R*2.2, 4, 0.9, lineC);
  line(seg, gx, gy+R*1.3, gx+R*0.7, gy+R*2.2, 4, 0.9, lineC);
  for(let x=0;x<w;x+=8){ line(seg, x, h*0.95, x, h*0.85, 2, 0.5, grass); }
  for(let i=0;i<30;i++){ const x=(i/30)*w, y=h*0.9; line(seg, x-3,y, x+3,y, 2.4, 0.9, flower); line(seg, x,y-3, x,y+3, 2.4, 0.9, flower); }
  return { name:"person-field", segments:seg, bg: sky, palette };
}
export function lighthouse(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const sky=palette[0], lineC=palette[1], light=palette[3];
  const x=w*0.75, base=h*0.8;
  poly(seg, [[x-20,base],[x+20,base],[x+10,base-140],[x-10,base-140],[x-20,base]], 4, 0.9, lineC);
  for(let a=-0.3;a<=0.3;a+=0.15){ line(seg, x, base-140, x+200*Math.cos(a), base-140+200*Math.sin(a), 3, 0.6, light); }
  return { name:"lighthouse", segments:seg, bg: sky, palette };
}
export function sailboat(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const sky=palette[0], sail=palette[4], hull=palette[1], sea=palette[2];
  const cx=w*0.5, water=h*0.7;
  line(seg, 0, water, w, water, 5, 0.5, sea);
  line(seg, cx, water-100, cx, water, 4, 0.9, hull);
  poly(seg, [[cx,water-100],[cx,water-20],[cx-80,water-20]], 4, 0.9, sail);
  poly(seg, [[cx,water-60],[cx,water-10],[cx+70,water-10]], 3, 0.9, sail);
  return { name:"sailboat", segments:seg, bg: sky, palette };
}
export function car(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const bg=palette[0], lineC=palette[1], accent=palette[3];
  const base=h*0.75, x1=w*0.3, x2=w*0.7, y1=base-50;
  poly(seg, [[x1,y1],[x2,y1],[x2,base],[x1,base],[x1,y1]], 4, 0.9, lineC);
  poly(seg, [[x1+20,y1],[w*0.5,y1-30],[x2-20,y1]], 4, 0.9, lineC);
  circle(seg, x1+30, base, 20, 4, 0.9, accent);
  circle(seg, x2-30, base, 20, 4, 0.9, accent);
  return { name:"car", segments:seg, bg, palette };
}
export function mountainCabin(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const sky=palette[0], rock=palette[1], wood=palette[3];
  const x=w*0.3, y=h*0.75;
  poly(seg, [[w*0.2,h*0.8],[w*0.4,h*0.4],[w*0.6,h*0.8]], 4, 0.9, rock);
  poly(seg, [[w*0.5,h*0.8],[w*0.7,h*0.45],[w*0.9,h*0.8]], 4, 0.9, rock);
  poly(seg, [[x,y-40],[x+60,y-40],[x+60,y],[x,y],[x,y-40]], 4, 0.9, wood);
  poly(seg, [[x,y-40],[x+30,y-70],[x+60,y-40]], 4, 0.9, wood);
  return { name:"mountain-cabin", segments:seg, bg: sky, palette };
}
