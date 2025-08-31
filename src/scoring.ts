// src/scoring.ts
// Compute a heuristic 'quality' score from the finished canvas (0..1)
export function scoreCanvas(canvas: HTMLCanvasElement, bgApprox: string = "#ffffff"): number {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const S = 128; // small thumbnail for analysis
  const tmp = document.createElement("canvas");
  tmp.width = S; tmp.height = S;
  const tctx = tmp.getContext("2d")!;
  tctx.drawImage(canvas, 0, 0, S, S);
  const img = tctx.getImageData(0, 0, S, S);
  const d = img.data;

  // coverage & contrast
  let coverage = 0, contrast = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i+1], b = d[i+2], a = d[i+3];
    const lum = (0.2126*r + 0.7152*g + 0.0722*b)/255;
    contrast += Math.abs(lum - 0.5);
    if (a > 10) coverage++;
  }
  coverage /= (S*S);
  contrast /= (S*S);

  // vertical symmetry (faces/objects benefit)
  let sym = 0;
  for (let y=0;y<S;y++){
    for (let x=0;x<S/2;x++){
      const i1 = (y*S + x)*4, i2 = (y*S + (S-1-x))*4;
      const dr = Math.abs(d[i1]-d[i2]) + Math.abs(d[i1+1]-d[i2+1]) + Math.abs(d[i1+2]-d[i2+2]);
      sym += 1 - Math.min(1, dr/255/3);
    }
  }
  sym /= (S*S/2);

  // edge energy (Sobel-lite)
  let edge = 0;
  const lumAt = (x:number,y:number)=>{
    const idx=(y*S+x)*4; return (0.2126*d[idx]+0.7152*d[idx+1]+0.0722*d[idx+2])/255;
  };
  for (let y=1;y<S-1;y++){
    for(let x=1;x<S-1;x++){
      const gx = lumAt(x+1,y)-lumAt(x-1,y);
      const gy = lumAt(x,y+1)-lumAt(x,y-1);
      edge += Math.sqrt(gx*gx+gy*gy);
    }
  }
  edge /= ((S-2)*(S-2));

  // Combine with weights; encourage ~40-75% coverage
  const coverageTarget = 0.5, coverageScore = Math.exp(-Math.pow((coverage-coverageTarget)/0.2,2));
  const score = clamp01(0.35*coverageScore + 0.25*contrast + 0.2*sym + 0.2*edge);
  return score;
}

function clamp01(v:number){ return Math.max(0, Math.min(1, v)); }
