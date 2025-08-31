// src/brain.ts
export type ArmStat = { name: string; pulls: number; rewardSum: number; rewardSq: number; };
export type BrainState = { arms: ArmStat[]; version: number; };

const KEY = "randraw_brain_v1";

export class Brain {
  state: BrainState;
  constructor(armNames: string[]) {
    const loaded = Brain.load();
    const arms = armNames.map(n => {
      const found = loaded?.arms.find(a => a.name === n);
      return found ?? { name: n, pulls: 0, rewardSum: 0, rewardSq: 0 };
    });
    this.state = { version: 1, arms };
  }

  static load(): BrainState | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch {}
  }

  // Upper Confidence Bound (UCB1) selection
  chooseArm(): string {
    const arms = this.state.arms;
    const totalPulls = Math.max(1, arms.reduce((s, a) => s + a.pulls, 0));
    // ensure each arm tried at least once
    const untried = arms.find(a => a.pulls === 0);
    if (untried) return untried.name;
    let best = arms[0].name;
    let bestScore = -Infinity;
    for (const a of arms) {
      const mean = a.rewardSum / Math.max(1, a.pulls);
      const bonus = Math.sqrt((2 * Math.log(totalPulls)) / a.pulls);
      const score = mean + bonus;
      if (score > bestScore) { bestScore = score; best = a.name; }
    }
    return best;
  }

  update(armName: string, reward: number) {
    // clamp reward to [0, 1]
    const r = Math.max(0, Math.min(1, reward));
    const a = this.state.arms.find(x => x.name === armName);
    if (!a) return;
    a.pulls += 1;
    a.rewardSum += r;
    a.rewardSq += r * r;
    this.save();
  }

  summary(): { name: string; avg: number; pulls: number }[] {
    return this.state.arms.map(a => ({
      name: a.name, pulls: a.pulls, avg: a.pulls ? a.rewardSum / a.pulls : 0
    })).sort((x, y) => y.avg - x.avg);
  }
}
