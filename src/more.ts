// src/more.ts
import type { Seg } from "./motifs";
import type { PlanResult } from "./motifs";

function clamp(v:number,a:number,b:number){ return Math.max(a, Math.min(b, v)); }
function lcg(seed:number){ let s=seed>>>0; return ()=> (s=(s*1664525+1013904223)>>>0)/4294967296; }
function pick<T>(rng:()=>number, arr:T[]){ return arr[Math.floor(rng()*arr.length)]; }

function line(segments: Seg[], x1:number,y1:number,x2:number,y2:number,w:number,alpha:number,color:string){
  segments.push({x1,y1,x2,y2,w,alpha,color});
}
function poly(segments: Seg[], pts:number[][], w:number, alpha:number, color:string){
  for(let i=0;i<pts.length-1;i++){
    const [x1,y1]=pts[i], [x2,y2]=pts[i+1];
    segments.push({x1,y1,x2,y2,w,alpha,color});
  }
}
function circle(segments: Seg[], cx:number, cy:number, r:number, w:number, alpha:number, color:string, steps=64){
  let px=cx+r, py=cy;
  for(let i=1;i<=steps;i++){
    const t=i/steps*2*Math.PI;
    const x=cx+Math.cos(t)*r, y=cy+Math.sin(t)*r;
    segments.push({x1:px,y1:py,x2:x,y2:y,w,alpha,color});
    px=x; py=y;
  }
}
function ellipse(segments: Seg[], cx:number, cy:number, rx:number, ry:number, w:number, alpha:number, color:string, steps=72){
  let px=cx+rx, py=cy;
  for(let i=1;i<=steps;i++){
    const t=i/steps*2*Math.PI;
    const x=cx+Math.cos(t)*rx, y=cy+Math.sin(t)*ry;
    segments.push({x1:px,y1:py,x2:x,y2:y,w,alpha,color});
    px=x; py=y;
  }
}

export const SUBJECTS_EXTRA = [
  "person", "person-field", "person-dog",
  "cat", "dog", "bird", "butterfly",
  "bicycle", "car", "airplane",
  "sailboat", "lighthouse", "tree-grove"
] as const;

export const LANDSCAPES_EXTRA = [
  "desert-dunes", "canyon", "volcano", "aurora",
  "forest-path", "beach-sunset", "snowy-village",
  "waterfall", "mountain-cabin", "night-city"
] as const;

export const ABSTRACTS_EXTRA = [
  "mondrian-grid", "spiral", "voronoi", "maze", "concentric", "starscape"
] as const;

// ---- Subjects ----
function person(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const rng=lcg(seed), seg:Seg[]=[];
  const bg=palette[0], lineC=palette[1], accent=palette[3];
  const gx=w*0.5, gy=h*0.6, R=Math.min(w,h)*0.08;
  circle(seg, gx, gy-R*2, R*0.7, 3, 0.9, lineC);                    // head
  line(seg, gx, gy-R*1.3, gx, gy+R*1.3, 4, 0.9, lineC);            // body
  line(seg, gx, gy-R*0.3, gx-R*0.9, gy+R*0.6, 4, 0.9, lineC);      // arm L
  line(seg, gx, gy-R*0.3, gx+R*0.9, gy+R*0.6, 4, 0.9, lineC);      // arm R
  line(seg, gx, gy+R*1.3, gx-R*0.7, gy+R*2.2, 4, 0.9, lineC);      // leg L
  line(seg, gx, gy+R*1.3, gx+R*0.7, gy+R*2.2, 4, 0.9, lineC);      // leg R
  poly(seg, [[0,h*0.95],[w,h*0.95]], 6, 0.4, accent);              // ground
  return { name:"person", segments:seg, bg, palette };
}
function personField(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const rng=lcg(seed), seg:Seg[]=[];
  const sky=palette[0], grass=palette[2], flower=palette[4], lineC=palette[1];
  const gx=w*0.5, gy=h*0.6, R=Math.min(w,h)*0.08;
  // person
  circle(seg, gx, gy-R*2, R*0.7, 3, 0.9, lineC);
  line(seg, gx, gy-R*1.3, gx, gy+R*1.3, 4, 0.9, lineC);
  line(seg, gx, gy-R*0.3, gx-R*0.9, gy+R*0.6, 4, 0.9, lineC);
  line(seg, gx, gy-R*0.3, gx+R*0.9, gy+R*0.6, 4, 0.9, lineC);
  line(seg, gx, gy+R*1.3, gx-R*0.7, gy+R*2.2, 4, 0.9, lineC);
  line(seg, gx, gy+R*1.3, gx+R*0.7, gy+R*2.2, 4, 0.9, lineC);
  // field
  for(let x=0;x<w;x+=8){
    line(seg, x, h*0.95, x, h*0.85 - Math.sin(x*0.05+seed)*6, 2, 0.5, grass);
  }
  for(let i=0;i<30;i++){
    const x=(i/30)*w, y=h*0.9 + Math.sin(i*0.4+seed)*6;
    line(seg, x-3,y, x+3,y, 2.4, 0.9, flower);
    line(seg, x,y-3, x,y+3, 2.4, 0.9, flower);
  }
  return { name:"person-field", segments:seg, bg: sky, palette };
}
function personDog(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const bg=palette[0], lineC=palette[1], leash=palette[3];
  const gx=w*0.45, gy=h*0.62, R=Math.min(w,h)*0.07;
  circle(seg, gx, gy-R*2, R*0.6, 3, 0.9, lineC);
  line(seg, gx, gy-R*1.1, gx, gy+R*1.1, 4, 0.9, lineC);
  line(seg, gx, gy-R*0.3, gx+R*0.9, gy+R*0.3, 4, 0.9, lineC);
  // dog
  const dx=gx+R*1.7, dy=gy+R*1.0;
  ellipse(seg, dx, dy, R*1.0, R*0.6, 4, 0.8, lineC);
  circle(seg, dx+R*0.9, dy-R*0.2, R*0.35, 3, 0.9, lineC);
  line(seg, dx-R*1.0, dy, dx-R*1.4, dy-R*0.4, 3, 0.9, lineC); // tail
  // leash
  line(seg, gx+R*0.9, gy+R*0.3, dx+R*0.6, dy-R*0.1, 2, 0.9, leash);
  return { name:"person-dog", segments:seg, bg, palette };
}
function cat(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const bg=palette[0], lineC=palette[1];
  const cx=w*0.5, cy=h*0.65, R=Math.min(w,h)*0.12;
  ellipse(seg, cx, cy, R*0.9, R*0.6, 4, 0.9, lineC);
  circle(seg, cx+R*0.9, cy-R*0.3, R*0.4, 3, 0.9, lineC); // head
  poly(seg, [[cx+R*1.2,cy-R*0.7],[cx+R*1.5,cy-R*0.9],[cx+R*1.2,cy-R*0.5]], 3, 0.9, lineC); // ear
  poly(seg, [[cx+R*0.9,cy-R*0.7],[cx+R*0.6,cy-R*0.9],[cx+R*0.9,cy-R*0.5]], 3, 0.9, lineC);
  line(seg, cx-R*1.1, cy, cx-R*1.5, cy-R*0.2, 3, 0.9, lineC); // tail
  return { name:"cat", segments:seg, bg, palette };
}
function dog(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const bg=palette[0], lineC=palette[1];
  const cx=w*0.55, cy=h*0.65, R=Math.min(w,h)*0.12;
  ellipse(seg, cx, cy, R*1.0, R*0.6, 4, 0.9, lineC);
  circle(seg, cx+R*1.0, cy-R*0.2, R*0.45, 3, 0.9, lineC);
  line(seg, cx-R*1.0, cy, cx-R*1.5, cy-R*0.2, 3, 0.9, lineC);
  return { name:"dog", segments:seg, bg, palette };
}
function bird(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const bg=palette[0], lineC=palette[1];
  const cx=w*0.5, cy=h*0.5, R=Math.min(w,h)*0.08;
  ellipse(seg, cx, cy, R*1.1, R*0.6, 3, 0.9, lineC);
  poly(seg, [[cx-R*0.2,cy],[cx-R*1.2,cy-R*0.6],[cx-R*0.4,cy+R*0.1]], 3, 0.9, lineC); // wing
  line(seg, cx+R*1.1, cy, cx+R*1.6, cy-R*0.2, 3, 0.9, lineC); // beak
  return { name:"bird", segments:seg, bg, palette };
}
function butterfly(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const bg=palette[0], wing=palette[3], body="#000";
  const cx=w*0.5, cy=h*0.55, R=Math.min(w,h)*0.14;
  ellipse(seg, cx-R*0.5, cy, R*0.5, R*0.8, 3, 0.9, wing);
  ellipse(seg, cx+R*0.5, cy, R*0.5, R*0.8, 3, 0.9, wing);
  line(seg, cx, cy-R*0.9, cx, cy+R*0.9, 4, 0.9, body);
  return { name:"butterfly", segments:seg, bg, palette };
}
function bicycle(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const bg=palette[0], lineC=palette[1];
  const y=h*0.7, R=Math.min(w,h)*0.12;
  circle(seg, w*0.38, y, R, 3, 0.9, lineC);
  circle(seg, w*0.62, y, R, 3, 0.9, lineC);
  poly(seg, [[w*0.38,y],[w*0.52,y-R*0.7],[w*0.62,y],[w*0.5,y],[w*0.38,y]], 3, 0.9, lineC);
  line(seg, w*0.52, y-R*0.7, w*0.56, y-R*1.1, 3, 0.9, lineC); // handle
  return { name:"bicycle", segments:seg, bg, palette };
}
function car(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const bg=palette[0], lineC=palette[1], accent=palette[3];
  const base=h*0.75, x1=w*0.3, x2=w*0.7, y1=base-50;
  poly(seg, [[x1,y1],[x2,y1],[x2,base],[x1,base],[x1,y1]], 4, 0.9, lineC);
  // roof
  poly(seg, [[x1+20,y1],[w*0.5,y1-30],[x2-20,y1]], 4, 0.9, lineC);
  circle(seg, x1+30, base, 20, 4, 0.9, accent);
  circle(seg, x2-30, base, 20, 4, 0.9, accent);
  return { name:"car", segments:seg, bg, palette };
}
function airplane(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const bg=palette[0], lineC=palette[1];
  const cx=w*0.5, cy=h*0.5;
  line(seg, cx-160, cy, cx+160, cy, 5, 0.9, lineC); // body
  poly(seg, [[cx,cy],[cx-60,cy-60],[cx-10,cy-60]], 5, 0.9, lineC); // left wing
  poly(seg, [[cx+20,cy],[cx+80,cy+60],[cx+40,cy+60]], 5, 0.9, lineC); // right wing
  return { name:"airplane", segments:seg, bg, palette };
}
function sailboat(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const sky=palette[0], sail=palette[4], hull=palette[1], sea=palette[2];
  const cx=w*0.5, water=h*0.7;
  poly(seg, [[cx-60,water],[cx+60,water]], 5, 0.8, sea);
  // hull
  poly(seg, [[cx-60,water],[cx+60,water],[cx+40,water+20],[cx-40,water+20],[cx-60,water]], 4, 0.9, hull);
  // mast + sails
  line(seg, cx, water-100, cx, water, 4, 0.9, hull);
  poly(seg, [[cx,water-100],[cx,water-20],[cx-80,water-20]], 4, 0.9, sail);
  poly(seg, [[cx,water-60],[cx,water-10],[cx+70,water-10]], 3, 0.9, sail);
  return { name:"sailboat", segments:seg, bg: sky, palette };
}
function lighthouse(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const sky=palette[0], lineC=palette[1], light=palette[3];
  const x=w*0.75, base=h*0.8;
  // tower
  poly(seg, [[x-20,base],[x+20,base],[x+10,base-140],[x-10,base-140],[x-20,base]], 4, 0.9, lineC);
  // light beams
  for(let a=-0.3;a<=0.3;a+=0.15){
    line(seg, x, base-140, x+200*Math.cos(a), base-140+200*Math.sin(a), 3, 0.6, light);
  }
  return { name:"lighthouse", segments:seg, bg: sky, palette };
}
function treeGrove(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const bg=palette[0], trunk=palette[1], leaf=palette[2];
  const base=h*0.85;
  for(let i=0;i<6;i++){
    const x=(0.15+i*0.12)*w;
    line(seg, x, base, x, base-70, 6, 0.9, trunk);
    ellipse(seg, x, base-90, 35, 25, 3, 0.6, leaf);
    ellipse(seg, x+18, base-70, 25, 20, 3, 0.6, leaf);
    ellipse(seg, x-18, base-70, 25, 20, 3, 0.6, leaf);
  }
  return { name:"tree-grove", segments:seg, bg, palette };
}

// ---- Landscapes ----
function desertDunes(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const sky=palette[0], sand=palette[3];
  for(let y=Math.floor(h*0.5); y<h; y+=6){
    const yy=y + Math.sin((y+seed)*0.02)*8;
    line(seg, 0, yy, w, yy, 3, 0.5, sand);
  }
  return { name:"desert-dunes", segments:seg, bg: sky, palette };
}
function canyon(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const sky=palette[0], rock=palette[1];
  for(let l=0;l<6;l++){
    let py=h*0.45 + l*20;
    for(let x=0;x<=w;x+=8){
      const y=h*0.45 + l*20 + Math.sin(x*0.02 + l + seed*0.01)*12;
      line(seg, x-8, py, x, y, 3, 0.6, rock);
      py=y;
    }
  }
  return { name:"canyon", segments:seg, bg: sky, palette };
}
function volcano(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const sky=palette[0], rock=palette[1], lava=palette[3];
  // cone
  const base=h*0.8, cx=w*0.5;
  poly(seg, [[cx-120,base],[cx,base-180],[cx+120,base]], 5, 0.9, rock);
  // lava
  for(let i=0;i<10;i++){
    line(seg, cx-20+i*4, base-180, cx-20+i*4, base-160+Math.sin(i+seed)*20, 3, 0.8, lava);
  }
  return { name:"volcano", segments:seg, bg: sky, palette };
}
function aurora(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const sky="#0b132b", glow=palette[4];
  for(let x=0;x<w;x+=6){
    const top=h*0.2 + Math.sin(x*0.02 + seed)*20;
    line(seg, x, top, x, h*0.5, 3, 0.2+0.5*Math.random(), glow);
  }
  return { name:"aurora", segments:seg, bg: sky as string, palette };
}
function forestPath(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const sky=palette[0], trunk=palette[1], leaf=palette[2], path=palette[3];
  // path perspective
  poly(seg, [[w*0.45,h*0.95],[w*0.55,h*0.95],[w*0.6,h*0.6],[w*0.4,h*0.6],[w*0.45,h*0.95]], 4, 0.9, path);
  for(let i=0;i<7;i++){
    const x=i/6*w;
    line(seg, x, h*0.95, x, h*0.55, 6, 0.6, trunk);
    ellipse(seg, x, h*0.5, 30, 20, 3, 0.6, leaf);
  }
  return { name:"forest-path", segments:seg, bg: sky, palette };
}
function beachSunset(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const sky=palette[0], sea=palette[2], sun=palette[3];
  circle(seg, w*0.7, h*0.35, 40, 4, 0.9, sun);
  for(let y=Math.floor(h*0.6); y<h; y+=6){
    line(seg, 0, y, w, y, 3, 0.5, sea);
  }
  return { name:"beach-sunset", segments:seg, bg: sky, palette };
}
function snowyVillage(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const sky=palette[0], roof=palette[3], wall=palette[1];
  const ground=h*0.85;
  for(let i=0;i<5;i++){
    const x= w*0.1 + i*w*0.16;
    poly(seg, [[x,ground-40],[x+40,ground-40],[x+40,ground],[x,ground],[x,ground-40]], 3, 0.9, wall);
    poly(seg, [[x,ground-40],[x+20,ground-70],[x+40,ground-40]], 3, 0.9, roof);
  }
  // snow
  for(let s=0;s<80;s++){
    const x=Math.random()*w, y=Math.random()*h*0.8;
    line(seg, x,y, x+1,y+2, 2, 0.7, "#f5f5f5");
  }
  return { name:"snowy-village", segments:seg, bg: sky, palette };
}
function waterfall(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const sky=palette[0], water=palette[2], rock=palette[1];
  const left=w*0.4, right=w*0.6;
  for(let y=0;y<h;y+=4){
    line(seg, left, y, right, y, 3, 0.15, rock);
  }
  for(let x=left; x<=right; x+=6){
    line(seg, x, 0, x, h*0.85, 3, 0.5, water);
  }
  return { name:"waterfall", segments:seg, bg: sky, palette };
}
function mountainCabin(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const sky=palette[0], rock=palette[1], wood=palette[3];
  // mountains
  poly(seg, [[w*0.2,h*0.8],[w*0.4,h*0.4],[w*0.6,h*0.8]], 4, 0.9, rock);
  poly(seg, [[w*0.5,h*0.8],[w*0.7,h*0.45],[w*0.9,h*0.8]], 4, 0.9, rock);
  // cabin
  const x=w*0.3, y=h*0.75;
  poly(seg, [[x,y-40],[x+60,y-40],[x+60,y],[x,y],[x,y-40]], 4, 0.9, wood);
  poly(seg, [[x,y-40],[x+30,y-70],[x+60,y-40]], 4, 0.9, wood);
  return { name:"mountain-cabin", segments:seg, bg: sky, palette };
}
function nightCity(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const sky="#0b132b", lineC=palette[1], win=palette[4];
  const ground=h*0.8;
  for(let i=0;i<20;i++){
    const x=(i/20)*w;
    const bw=20+(i%5)*8; const bh=40+((i*7)%9)*12;
    poly(seg, [[x,ground-bh],[x+bw,ground-bh],[x+bw,ground],[x,ground],[x,ground-bh]], 3, 0.9, lineC);
    for(let yy=ground-bh+8; yy<ground; yy+=12){
      for(let xx=x+6; xx<x+bw-6; xx+=10){
        line(seg, xx, yy, xx+3, yy, 2, 0.9, win);
      }
    }
  }
  return { name:"night-city", segments:seg, bg: sky as string, palette };
}

// ---- Abstracts ----
function mondrian(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const bg="#f6f6f6", line="#111";
  // grid
  for(let x=0;x<w;x+=Math.floor(60+Math.random()*120)){
    line(seg, x, 0, x, h, 5, 0.9, line);
  }
  for(let y=0;y<h;y+=Math.floor(60+Math.random()*120)){
    line(seg, 0, y, w, y, 5, 0.9, line);
  }
  // random blocks
  for(let i=0;i<20;i++){
    const x=Math.random()*w, y=Math.random()*h;
    const ww=30+Math.random()*100, hh=30+Math.random()*100;
    const c=pick(()=>Math.random(), [palette[3], palette[2], palette[4]]);
    poly(seg, [[x,y],[x+ww,y],[x+ww,y+hh],[x,y+hh],[x,y]], 8, 0.5, c);
  }
  return { name:"mondrian-grid", segments:seg, bg, palette };
}
function spiral(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const bg=palette[0], c=palette[3];
  const cx=w*0.5, cy=h*0.5; let r=10;
  for(let t=0;t<Math.PI*8;t+=0.2){
    const x1=cx+Math.cos(t)*r, y1=cy+Math.sin(t)*r;
    r+=2;
    const x2=cx+Math.cos(t+0.2)*r, y2=cy+Math.sin(t+0.2)*r;
    line(seg, x1,y1,x2,y2, 4, 0.9, c);
  }
  return { name:"spiral", segments:seg, bg, palette };
}
function voronoi(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const bg=palette[0];
  const rng=lcg(seed);
  const pts = Array.from({length:18}, ()=> [rng()*w, rng()*h]);
  for(let i=0;i<pts.length;i++){
    for(let j=i+1;j<pts.length;j++){
      const [x1,y1]=pts[i], [x2,y2]=pts[j];
      line(seg, x1,y1,x2,y2, 2, 0.12, palette[(i+j)%palette.length]);
    }
  }
  return { name:"voronoi", segments:seg, bg, palette };
}
function maze(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const bg=palette[0], lineC=palette[1];
  const cell=20;
  for(let x=0;x<w;x+=cell){
    for(let y=0;y<h;y+=cell){
      if(((x+y+seed)>>4)&1){
        line(seg, x,y, x+cell,y, 3, 0.8, lineC);
      } else {
        line(seg, x,y, x,y+cell, 3, 0.8, lineC);
      }
    }
  }
  return { name:"maze", segments:seg, bg, palette };
}
function concentric(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const bg=palette[0], c=palette[3];
  const cx=w*0.5, cy=h*0.5;
  for(let r=20;r<Math.max(w,h); r+=20){
    circle(seg, cx, cy, r, 4, 0.5, c);
  }
  return { name:"concentric", segments:seg, bg, palette };
}
function starscape(w:number,h:number,seed:number,palette:string[]): PlanResult {
  const seg:Seg[]=[]; const bg="#0b132b", star="#fff";
  for(let i=0;i<200;i++){
    const x=Math.random()*w, y=Math.random()*h*0.7;
    line(seg, x,y, x+1,y, 2, 0.9, star);
  }
  return { name:"starscape", segments:seg, bg, palette };
}

export const EXTRA_GENERATORS: Record<string,(w:number,h:number,seed:number,palette:string[])=>PlanResult> = {
  // subjects
  "person": person,
  "person-field": personField,
  "person-dog": personDog,
  "cat": cat,
  "dog": dog,
  "bird": bird,
  "butterfly": butterfly,
  "bicycle": bicycle,
  "car": car,
  "airplane": airplane,
  "sailboat": sailboat,
  "lighthouse": lighthouse,
  "tree-grove": treeGrove,
  // landscapes
  "desert-dunes": desertDunes,
  "canyon": canyon,
  "volcano": volcano,
  "aurora": aurora,
  "forest-path": forestPath,
  "beach-sunset": beachSunset,
  "snowy-village": snowyVillage,
  "waterfall": waterfall,
  "mountain-cabin": mountainCabin,
  "night-city": nightCity,
  // abstracts
  "mondrian-grid": mondrian,
  "spiral": spiral,
  "voronoi": voronoi,
  "maze": maze,
  "concentric": concentric,
  "starscape": starscape,
};
