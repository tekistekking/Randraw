
import type { PlanResult, Seg } from "./motifs";
import { line, ellipse } from "./motifs";

export function mountains(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const sky=palette[0], rock=palette[1];
  const base=h*0.8;
  for(let i=0;i<3;i++){
    const x1=w*(0.2+i*0.25), x2=x1+ w*0.25*0.8;
    const peakY = base - (120 + i*30);
    line(seg, x1, base, (x1+x2)/2, peakY, 5, 0.9, rock);
    line(seg, (x1+x2)/2, peakY, x2, base, 5, 0.9, rock);
  }
  return { name:"mountains", segments:seg, bg: sky, palette };
}

export function city(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const sky=palette[0], lineC=palette[1], win=palette[4];
  const ground=h*0.8;
  for(let i=0;i<14;i++){
    const x=(i/14)*w; const bw=24+((i*7)%5)*8; const bh=40+((i*5)%7)*12;
    line(seg, x, ground-bh, x+bw, ground-bh, 3, 0.9, lineC);
    line(seg, x, ground-bh, x, ground, 3, 0.9, lineC);
    line(seg, x+bw, ground-bh, x+bw, ground, 3, 0.9, lineC);
    for(let yy=ground-bh+8; yy<ground; yy+=12){
      for(let xx=x+6; xx<x+bw-6; xx+=10){
        line(seg, xx, yy, xx+3, yy, 2, 0.9, win);
      }
    }
  }
  return { name:"city", segments:seg, bg: sky, palette };
}

export function waves(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const sky=palette[0], sea=palette[2];
  for(let y=h*0.6; y<h; y+=6){
    line(seg, 0, y, w, y, 3, 0.4, sea);
  }
  return { name:"waves", segments:seg, bg: sky, palette };
}

export function meadow(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const sky=palette[0], grass=palette[2], flower=palette[3];
  for(let x=0; x<w; x+=8){
    line(seg, x, h*0.95, x, h*0.85, 2, 0.5, grass);
  }
  for(let i=0;i<30;i++){
    const x=(i/30)*w, y=h*0.9;
    line(seg, x-3,y, x+3,y, 2.4, 0.9, flower);
    line(seg, x,y-3, x,y+3, 2.4, 0.9, flower);
  }
  return { name:"meadow", segments:seg, bg: sky, palette };
}
