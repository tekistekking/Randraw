// src/motifs.ts
export type Seg = { x1:number; y1:number; x2:number; y2:number; w:number; alpha:number; color:string; };
export type PlanResult = { name: string; segments: Seg[]; bg: string; palette: string[] };

const PALETTES = [
  ["#f0f4f8", "#0b132b", "#5bc0be", "#f9c80e", "#ea3546"],
  ["#fffaf0", "#1b1f3b", "#43bccd", "#f86624", "#2ec4b6"],
  ["#f6f1f1", "#0b090a", "#e5383b", "#ba181b", "#6a994e"],
];

function pick<T>(rng: () => number, arr: T[]) { return arr[Math.floor(rng() * arr.length)]; }
function clamp(v:number,a:number,b:number){ return Math.max(a, Math.min(b, v)); }

function lcg(seed:number){ let s=seed>>>0; return ()=> (s=(s*1664525+1013904223)>>>0)/4294967296; }

// helpers to add stroke-based shapes
function line(segments: Seg[], x1:number,y1:number,x2:number,y2:number,w:number,alpha:number,color:string){
  segments.push({x1,y1,x2,y2,w,alpha,color});
}
function polyline(segments: Seg[], pts:number[][], w:number, alpha:number, color:string){
  for(let i=0;i<pts.length-1;i++){
    const [x1,y1]=pts[i], [x2,y2]=pts[i+1];
    segments.push({x1,y1,x2,y2,w,alpha,color});
  }
}
function circle(segments: Seg[], cx:number, cy:number, r:number, w:number, alpha:number, color:string, steps=64){
  let prev=[cx+r, cy];
  for(let i=1;i<=steps;i++){
    const t=i/steps*2*Math.PI;
    const x=cx+Math.cos(t)*r;
    const y=cy+Math.sin(t)*r;
    segments.push({x1:prev[0],y1:prev[1],x2:x,y2:y,w,alpha,color});
    prev=[x,y];
  }
}
function filledCircle(segments: Seg[], cx:number, cy:number, r:number, wBase:number, alpha:number, color:string){
  // radial hatch fill
  const steps=64;
  for(let i=0;i<steps;i++){
    const a=(i/steps)*Math.PI;
    const x1=cx+Math.cos(a)*r, y1=cy+Math.sin(a)*r;
    const x2=cx-Math.cos(a)*r, y2=cy-Math.sin(a)*r;
    segments.push({x1,y1,x2,y2,w:wBase*0.6,alpha,color});
  }
  circle(segments, cx, cy, r, wBase, Math.min(1, alpha*1.2), color, 80);
}
function ellipse(segments: Seg[], cx:number, cy:number, rx:number, ry:number, w:number, alpha:number, color:string, steps=80){
  let prev=[cx+rx, cy];
  for(let i=1;i<=steps;i++){
    const t=i/steps*2*Math.PI;
    const x=cx+Math.cos(t)*rx;
    const y=cy+Math.sin(t)*ry;
    segments.push({x1:prev[0],y1:prev[1],x2:x,y2:y,w,alpha,color});
    prev=[x,y];
  }
}

// --- Motifs ---

export function motifFace(width:number, height:number, rng:()=>number, palette:string[]): PlanResult {
  const segments: Seg[] = [];
  const bg = palette[0];
  const stroke = palette[1];
  const accent = palette[3];
  const cx = width*0.5, cy = height*0.52;
  const R = Math.min(width,height)*0.28;
  filledCircle(segments, cx, cy, R, 3.2, 0.25, stroke);
  // eyes
  ellipse(segments, cx-R*0.45, cy-R*0.1, R*0.12, R*0.16, 3, 0.7, "#000000");
  ellipse(segments, cx+R*0.45, cy-R*0.1, R*0.12, R*0.16, 3, 0.7, "#000000");
  filledCircle(segments, cx-R*0.45, cy-R*0.1, R*0.05, 2.4, 0.9, accent);
  filledCircle(segments, cx+R*0.45, cy-R*0.1, R*0.05, 2.4, 0.9, accent);
  // mouth
  const mW=R*0.65, mY=cy+R*0.35;
  polyline(segments, [[cx-mW, mY],[cx-mW*0.5, mY+R*0.12],[cx+mW*0.5, mY+R*0.12],[cx+mW, mY]], 4, 0.8, "#000000");
  // blush
  filledCircle(segments, cx-R*0.72, cy+R*0.2, R*0.07, 2, 0.25, accent);
  filledCircle(segments, cx+R*0.72, cy+R*0.2, R*0.07, 2, 0.25, accent);
  return { name: "face", segments, bg, palette };
}

export function motifFlower(width:number, height:number, rng:()=>number, palette:string[]): PlanResult {
  const segments: Seg[] = [];
  const bg = palette[0];
  const petal = palette[4];
  const center = palette[3];
  const stem = palette[2];
  const cx = width*0.5, cy = height*0.55;
  const R = Math.min(width,height)*0.2;
  // petals
  const petals = 8;
  for(let i=0;i<petals;i++){
    const ang = i/petals*2*Math.PI;
    const px = cx + Math.cos(ang)*R*0.8;
    const py = cy + Math.sin(ang)*R*0.8;
    ellipse(segments, px, py, R*0.45, R*0.2, 3.2, 0.5, petal, 40);
  }
  // center
  filledCircle(segments, cx, cy, R*0.35, 3.2, 0.7, center);
  // stem
  polyline(segments, [[cx, cy+R*0.35],[cx, height*0.95]], 6, 0.8, stem);
  // leaf
  ellipse(segments, cx+R*0.25, cy+R*0.9, R*0.35, R*0.16, 3, 0.6, stem, 40);
  return { name: "flower", segments, bg, palette };
}

export function motifTree(width:number, height:number, rng:()=>number, palette:string[]): PlanResult {
  const segments: Seg[] = [];
  const bg = palette[0];
  const trunk = "#8b5a2b";
  const leaf = palette[2];
  const baseY = height*0.8;
  // trunk
  polyline(segments, [[width*0.5, baseY],[width*0.5, height*0.5]], 10, 0.9, trunk);
  // branches
  for(let i=0;i<8;i++){
    const y = height*0.5 - i*10;
    const len = (i%2?1:-1) * (80 + i*12);
    polyline(segments, [[width*0.5, height*0.5 + i*10],[width*0.5+len, height*0.5 - i*18]], 6-i*0.5, 0.7, trunk);
  }
  // foliage (hatch circles)
  const cx=width*0.5, cy=height*0.45, R=Math.min(width,height)*0.25;
  for(let b=0;b<5;b++){
    const rr = R*(0.6 + b*0.1);
    ellipse(segments, cx, cy, rr, rr*0.7, 4-b*0.5, 0.3, leaf, 60);
  }
  return { name: "tree", segments, bg, palette };
}

export function motifHouse(width:number, height:number, rng:()=>number, palette:string[]): PlanResult {
  const segments: Seg[] = [];
  const bg = palette[0];
  const lineC = palette[1];
  const accent = palette[3];
  const baseY = height*0.72;
  const W = Math.min(width, height)*0.5;
  const H = W*0.6;
  const x1 = width*0.5 - W/2, x2 = width*0.5 + W/2;
  const y1 = baseY - H, y2 = baseY;
  // base rect
  polyline(segments, [[x1,y1],[x2,y1],[x2,y2],[x1,y2],[x1,y1]], 5, 0.9, lineC);
  // roof
  polyline(segments, [[x1,y1],[width*0.5,y1-H*0.5],[x2,y1]], 6, 0.9, accent);
  // door
  const dW=W*0.18, dH=H*0.45, dx=width*0.5-dW/2, dy=y2-dH;
  polyline(segments, [[dx,dy],[dx+dW,dy],[dx+dW,y2],[dx,y2],[dx,dy]], 4, 0.9, lineC);
  // window
  const wx=x1+W*0.18, wy=y1+H*0.25, wW=W*0.18, wH=W*0.18;
  polyline(segments, [[wx,wy],[wx+wW,wy],[wx+wW,wy+wH],[wx,wy+wH],[wx,wy]], 3, 0.9, lineC);
  line(segments, wx, wy+wH/2, wx+wW, wy+wH/2, 3, 0.9, lineC);
  line(segments, wx+wW/2, wy, wx+wW/2, wy+wH, 3, 0.9, lineC);
  return { name: "house", segments, bg, palette };
}

export function motifRocket(width:number, height:number, rng:()=>number, palette:string[]): PlanResult {
  const segments: Seg[] = [];
  const bg = palette[0];
  const body = palette[1];
  const flame = "#ff6b00";
  const cx = width*0.5, cy=height*0.6;
  const R=Math.min(width,height)*0.18;
  // body
  ellipse(segments, cx, cy, R*0.7, R*1.1, 4, 0.8, body, 80);
  // window
  filledCircle(segments, cx, cy-R*0.2, R*0.25, 3, 0.8, palette[3]);
  // fins
  polyline(segments, [[cx-R*0.7, cy+R*0.3],[cx-R*1.0, cy+R*0.9]], 6, 0.9, body);
  polyline(segments, [[cx+R*0.7, cy+R*0.3],[cx+R*1.0, cy+R*0.9]], 6, 0.9, body);
  // flame
  for(let i=0;i<8;i++){
    const dx=(Math.random()-0.5)*R*0.2;
    const len=R*(0.6+Math.random()*0.5);
    polyline(segments, [[cx+dx, cy+R*1.1],[cx+dx, cy+R*1.1+len]], 4-i*0.3, 0.6, flame);
  }
  return { name: "rocket", segments, bg, palette };
}

export function motifFish(width:number, height:number, rng:()=>number, palette:string[]): PlanResult {
  const segments: Seg[] = [];
  const bg = palette[0];
  const body = palette[2];
  const lineC = palette[1];
  const cx=width*0.5, cy=height*0.6, R=Math.min(width,height)*0.22;
  ellipse(segments, cx, cy, R*1.1, R*0.6, 4, 0.8, body, 80);
  // tail
  polyline(segments, [[cx-R*1.1, cy],[cx-R*1.6, cy-R*0.4],[cx-R*1.6, cy+R*0.4],[cx-R*1.1, cy]], 5, 0.8, lineC);
  // eye
  filledCircle(segments, cx+R*0.7, cy-R*0.1, R*0.06, 3, 0.8, "#000000");
  // gill
  ellipse(segments, cx+R*0.2, cy, R*0.25, R*0.18, 3, 0.6, lineC, 32);
  return { name: "fish", segments, bg, palette };
}

export type MotifFn = (w:number,h:number,rng:()=>number,pal:string[])=>PlanResult;

export const MOTIFS: Record<string, MotifFn> = {
  face: motifFace,
  flower: motifFlower,
  tree: motifTree,
  house: motifHouse,
  rocket: motifRocket,
  fish: motifFish,
};

export function makeRng(seed:number){ return lcg(seed); }
export function choosePalette(rng:()=>number){ return pick(rng, PALETTES); }
