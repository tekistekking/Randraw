// src/landscapes.ts
import type { Seg } from "./motifs";

function clamp(v:number,a:number,b:number){ return Math.max(a, Math.min(b, v)); }
function lcg(seed:number){ let s=seed>>>0; return ()=> (s=(s*1664525+1013904223)>>>0)/4294967296; }
function pick<T>(rng:()=>number, arr:T[]){ return arr[Math.floor(rng()*arr.length)]; }

export function mountains(width:number,height:number,seed:number,palette:string[]){
  const rng=lcg(seed), seg:Seg[]=[];
  const sky=palette[0], ridge=palette[1], snow="#f4f4f8";
  // sky fill via horizontal strokes
  for(let y=0;y<height*0.6;y+=3){
    seg.push({x1:0,y1:y,x2:width,y2:y,w:2,alpha:0.15,color:sky});
  }
  // layered ridges
  for(let l=0;l<4;l++){
    let prevX=0, prevY=height*0.6 + l*height*0.08;
    for(let x=0;x<=width;x+=8){
      const y=height*0.5 + l*height*0.08 + Math.sin(x*0.01+seed*0.3+l)*height*0.05;
      seg.push({x1:prevX,y1:prevY,x2:x,y2:y,w:2.5-l*0.4,alpha:0.6,color:ridge});
      prevX=x; prevY=y;
    }
    // snow caps
    for(let x=0;x<width;x+=40){
      const y=height*0.5 + l*height*0.08 + Math.sin(x*0.01+seed*0.3+l)*height*0.05 - 14;
      seg.push({x1:x-6,y1:y,x2:x+6,y2:y,w:3,alpha:0.8,color:snow});
    }
  }
  // ground hatch
  for(let y=height*0.6;y<height;y+=5){
    seg.push({x1:0,y1:y,x2:width,y2:y,w:2,alpha:0.2,color:palette[2]});
  }
  return { name:"mountains", segments:seg, bg: sky, palette };
}

export function city(width:number,height:number,seed:number,palette:string[]){
  const rng=lcg(seed), seg:Seg[]=[];
  const bg=palette[0], line=palette[1], win=palette[3];
  // sky
  for(let y=0;y<height*0.55;y+=3) seg.push({x1:0,y1:y,x2:width,y2:y,w:2,alpha:0.12,color:bg});
  // skyline boxes
  const ground=height*0.75;
  for(let i=0;i<18;i++){
    const x= (i/18)*width + (i%2?4:-4);
    const w= 20 + (i%5)*10;
    const h= 60 + ((i*seed)%7)*12;
    // rect outline
    seg.push({x1:x,y1:ground-h,x2:x+w,y2:ground-h,w:3,alpha:0.7,color:line});
    seg.push({x1:x+w,y1:ground-h,x2:x+w,y2:ground,w:3,alpha:0.7,color:line});
    seg.push({x1:x+w,y1:ground,x2:x,y2:ground,w:3,alpha:0.7,color:line});
    seg.push({x1:x,y1:ground,x2:x,y2:ground-h,w:3,alpha:0.7,color:line});
    // windows hatch
    for(let yy=ground-h+8; yy<ground-6; yy+=12){
      for(let xx=x+6; xx<x+w-6; xx+=10){
        seg.push({x1:xx,y1:yy,x2:xx+4,y2:yy,w:2,alpha:0.8,color:win});
      }
    }
  }
  // road
  seg.push({x1:0,y1:ground+10,x2:width,y2:ground+10,w:6,alpha:0.8,color:palette[2]});
  return { name:"city", segments:seg, bg: bg, palette };
}

export function waves(width:number,height:number,seed:number,palette:string[]){
  const seg:Seg[]=[]; const sky=palette[0], sea=palette[2], foam="#f4f4f8";
  // sky
  for(let y=0;y<height*0.45;y+=3) seg.push({x1:0,y1:y,x2:width,y2:y,w:2,alpha:0.15,color:sky});
  // waves
  const mid=height*0.6;
  for(let y=mid; y<height; y+=8){
    for(let x=0;x<width;x+=8){
      const yy=y + Math.sin((x+y)*0.03 + seed*0.2)*4;
      seg.push({x1:x,y1:yy,x2:x+8,y2:yy,w:2.2,alpha:0.5,color:sea});
    }
  }
  // foam crests
  for(let x=0;x<width;x+=12){
    const yy=mid + Math.sin(x*0.05 + seed)*6;
    seg.push({x1:x-4,y1:yy,x2:x+4,y2:yy,w:2.8,alpha:0.85,color:foam});
  }
  return { name:"waves", segments:seg, bg: sky, palette };
}

export function meadow(width:number,height:number,seed:number,palette:string[]){
  const seg:Seg[]=[]; const sky=palette[0], grass=palette[2], petal=palette[4];
  // sky
  for(let y=0;y<height*0.5;y+=3) seg.push({x1:0,y1:y,x2:width,y2:y,w:2,alpha:0.15,color:sky});
  // grass blades
  for(let x=0;x<width;x+=6){
    const base=height*0.95, top=base- (20 + (Math.sin(x*0.07+seed)*10));
    seg.push({x1:x,y1:base,x2:x,y2:top,w:2,alpha:0.6,color:grass});
  }
  // flowers
  for(let i=0;i<40;i++){
    const x=(i/40)*width + ((i%2?1:-1)*5);
    const y=height*0.85 + Math.sin(i*0.3+seed)*6;
    seg.push({x1:x-4,y1:y,x2:x+4,y2:y,w:2.5,alpha:0.85,color:petal});
    seg.push({x1:x,y1:y-4,x2:x,y2:y+4,w:2.5,alpha:0.85,color:petal});
  }
  return { name:"meadow", segments:seg, bg: sky, palette };
}
