declare const StarMascots: {
  svg(kind: string, stage: number, emotion: string, opts?: { title?: string; size?: number }): string;
  stageFor(bestStreak: number): number;
  STAGES: { id: string; name: string; bestStreak: number }[];
  EMOTIONS: { id: string; key: string; label: string }[];
  KINDS: { id: string; name: string }[];
  colors: Record<string, string>;
};
export default StarMascots;
