import type { Draft, Question, Rng, Val, Visual } from './core';

/** Paso de explicación: clave de traducción + huecos (los números se formatean al mostrarse) */
export interface Step { k: string; v?: Record<string, Val | string | number> }

export interface Explanation {
  tag: string;                       // etiqueta del error (activa la frase de la mascota)
  tagVars: Record<string, Val | string | number>;
  steps: Step[];
  visual?: Visual;
}

export interface Generator {
  id: string;
  level: number;
  make: (r: Rng) => Draft;
  explain: (q: Question, tag: string, given: Val | null) => { steps: Step[]; visual?: Visual; vars?: Record<string, Val | string | number> };
}

export const st = (k: string, v?: Step['v']): Step => ({ k, v });
