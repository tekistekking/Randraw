
export type Seg = { x1:number,y1:number,x2:number,y2:number,w:number,alpha:number,color:string };
export type PlanResult = { name:string, segments:Seg[], bg:string, palette:string[] };

export function makeRng(seed:number){ let s=seed>>>0; return ()=> (s=(s*1664525+1013904223)>>>0)/4294967296; }
export function choosePalette(rng:()=>number){
  const palettes = [
    ["#0b132b","#1c2541","#3a506b","#5bc0be","#e4f4f3"],
    ["#1b1b1b","#4e342e","#8d6e63","#ffcc80","#ffe0b2"],
    ["#0a0a0a","#1f4068","#e43f5a","#162447","#f1f1f1"],
    ["#0a0a0a","#262626","#595959","#a6a6a6","#e6e6e6"],
    ["#001219","#005f73","#0a9396","#94d2bd","#e9d8a6"],
    ["#0a0a0a","#2d6a4f","#95d5b2","#ffd166","#ef476f"]
  ];
  return palettes[Math.floor(rng()*palettes.length)];
}

// helpers
export function line(segs:Seg[], x1:number,y1:number,x2:number,y2:number,w:number,a:number,c:string){ segs.push({x1,y1,x2,y2,w,alpha:a,color:c}); }
export function circle(segs: Seg[], cx:number,cy:number,r:number,w:number,a:number,c:string,steps=64){
  let px=cx+r, py=cy;
  for(let i=1;i<=steps;i++){ const t=i/steps*Math.PI*2; const x=cx+Math.cos(t)*r, y=cy+Math.sin(t)*r;
    segs.push({x1:px,y1:py,x2:x,y2:y,w,alpha:a,color:c}); px=x; py=y;
  }
}
export function poly(segs:Seg[], pts:number[][], w:number, a:number, c:string){ for(let i=0;i<pts.length-1;i++){ const [x1,y1]=pts[i], [x2,y2]=pts[i+1]; segs.push({x1,y1,x2,y2,w,alpha:a,color:c}); } }
export function ellipse(segs: Seg[], cx:number,cy:number,rx:number,ry:number,w:number,a:number,c:string,steps=72){
  let px=cx+rx, py=cy;
  for(let i=1;i<=steps;i++){ const t=i/steps*Math.PI*2; const x=cx+Math.cos(t)*rx, y=cy+Math.sin(t)*ry;
    segs.push({x1:px,y1:py,x2:x,y2:y,w,alpha:a,color:c}); px=x; py=y;
  }
}
