
import { PlanResult, makeRng, choosePalette } from "./motifs";
import { planAbstract } from "./abstract";
import { mountains, city, waves, meadow } from "./landscapes";
import * as MORE from "./more";

export const SUBJECTS = ["person","person-field","lighthouse","sailboat","car","mountain-cabin"] as const;
export const LANDSCAPES = ["mountains","city","waves","meadow"] as const;
export const ABSTRACTS = ["abstract-flow"] as const;

export const ALL_GENERATORS = [...SUBJECTS, ...LANDSCAPES, ...ABSTRACTS] as const;

type GenFn = (w:number,h:number,seed:number,palette:string[])=>PlanResult;
const BASE: Record<string, GenFn> = {
  mountains, city, waves, meadow,
  "abstract-flow": (w,h,seed,palette)=> planAbstract(w,h,seed,palette),
  person: (w,h,seed,palette)=> MORE.person(w,h,seed,palette),
  "person-field": (w,h,seed,palette)=> MORE.personField(w,h,seed,palette),
  lighthouse: (w,h,seed,palette)=> MORE.lighthouse(w,h,seed,palette),
  sailboat: (w,h,seed,palette)=> MORE.sailboat(w,h,seed,palette),
  car: (w,h,seed,palette)=> MORE.car(w,h,seed,palette),
  "mountain-cabin": (w,h,seed,palette)=> MORE.mountainCabin(w,h,seed,palette),
};

export function getGenerator(name: string): GenFn {
  return BASE[name];
}
