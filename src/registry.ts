// src/registry.ts
import { MOTIFS, makeRng, choosePalette, PlanResult } from "./motifs";
import { planAbstract } from "./abstract";
import { mountains, city, waves, meadow } from "./landscapes";
import { SUBJECTS_EXTRA, LANDSCAPES_EXTRA, ABSTRACTS_EXTRA, EXTRA_GENERATORS } from "./more";

export const SUBJECTS = ["face","flower","tree","house","rocket","fish", ...SUBJECTS_EXTRA] as const;
export const LANDSCAPES = ["mountains","city","waves","meadow", ...LANDSCAPES_EXTRA] as const;
export const ABSTRACTS = ["abstract-flow", ...ABSTRACTS_EXTRA] as const;
export const ALL_GENERATORS = [...SUBJECTS, ...LANDSCAPES, ...ABSTRACTS] as const;

type GenFn = (w:number,h:number,seed:number,palette:string[])=>PlanResult;

const wrapMotif = (key: keyof typeof MOTIFS): GenFn => {
  return (w,h,seed,palette) => MOTIFS[key](w,h, makeRng(seed), palette);
};

const BASE: Record<string, GenFn> = {
  // classic subjects
  face: wrapMotif("face"),
  flower: wrapMotif("flower"),
  tree: wrapMotif("tree"),
  house: wrapMotif("house"),
  rocket: wrapMotif("rocket"),
  fish: wrapMotif("fish"),
  // landscapes
  mountains, city, waves, meadow,
  // abstract
  "abstract-flow": (w,h,seed,palette) => planAbstract(w,h,seed,palette),
};

export function getGenerator(name: string): GenFn {
  return (EXTRA_GENERATORS[name] as GenFn) || BASE[name];
}
