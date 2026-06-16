import { Difficulty } from '@prisma/client';

export const DIFFICULTY_WEIGHT: Record<Difficulty, number> = {
  EASY: 1,
  MEDIUM: 2,
  HARD: 3,
};

export interface BankQuestion {
  id: string;
  difficulty: Difficulty;
}

export interface SetConfig {
  numberOfSets: number;
  easyPerSet: number;
  mediumPerSet: number;
  hardPerSet: number;
}

export interface GeneratedSet {
  setLabel: string;
  questionIds: string[];
  totalWeight: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function labelFor(index: number): string {
  // Set A, Set B, ... Set Z, Set AA, ...
  let n = index;
  let s = '';
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return `Set ${s}`;
}

/**
 * Generates balanced, randomized question sets from a large bank.
 *
 * Guarantees:
 *  - Each set has exactly easyPerSet / mediumPerSet / hardPerSet questions.
 *  - Selection is randomized so the paper setter cannot predict the contents.
 *  - Because the difficulty mix per set is identical, every set has an
 *    identical total difficulty weight (perfectly balanced).
 *
 * Throws if the bank does not contain enough questions of each difficulty.
 */
export function generateBalancedSets(bank: BankQuestion[], cfg: SetConfig): GeneratedSet[] {
  const byDifficulty: Record<Difficulty, string[]> = {
    EASY: shuffle(bank.filter((q) => q.difficulty === 'EASY').map((q) => q.id)),
    MEDIUM: shuffle(bank.filter((q) => q.difficulty === 'MEDIUM').map((q) => q.id)),
    HARD: shuffle(bank.filter((q) => q.difficulty === 'HARD').map((q) => q.id)),
  };

  const need: Record<Difficulty, number> = {
    EASY: cfg.easyPerSet * cfg.numberOfSets,
    MEDIUM: cfg.mediumPerSet * cfg.numberOfSets,
    HARD: cfg.hardPerSet * cfg.numberOfSets,
  };

  (Object.keys(need) as Difficulty[]).forEach((d) => {
    if (byDifficulty[d].length < need[d]) {
      throw new Error(
        `Question bank too small: need ${need[d]} ${d} questions, have ${byDifficulty[d].length}.`,
      );
    }
  });

  const perSet: Record<Difficulty, number> = {
    EASY: cfg.easyPerSet,
    MEDIUM: cfg.mediumPerSet,
    HARD: cfg.hardPerSet,
  };

  const sets: GeneratedSet[] = [];
  const cursor: Record<Difficulty, number> = { EASY: 0, MEDIUM: 0, HARD: 0 };

  for (let s = 0; s < cfg.numberOfSets; s++) {
    const ids: string[] = [];
    let weight = 0;
    (['EASY', 'MEDIUM', 'HARD'] as Difficulty[]).forEach((d) => {
      for (let i = 0; i < perSet[d]; i++) {
        const id = byDifficulty[d][cursor[d]++];
        ids.push(id);
        weight += DIFFICULTY_WEIGHT[d];
      }
    });
    // Shuffle question order within the set so position doesn't reveal difficulty.
    sets.push({ setLabel: labelFor(s), questionIds: shuffle(ids), totalWeight: weight });
  }

  return sets;
}
