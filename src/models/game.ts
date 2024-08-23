export enum Difficulty {
  EASY = "easy",
  MEDIUM = "medium",
  HARD = "hard",
  EXPERT = "expert",
}

export interface Questions {
  question: string;
  correctAnswer: number;
  playerAnswer: number | null;
  playerScore: number;
}
