/**
 * Tipos que espelham a resposta da API pública https://api.enem.dev/v1
 * (documentação: https://docs.enem.dev). Mantidos separados do schema do
 * Prisma de propósito: isto é "o formato de fora", o Prisma é "o formato de
 * dentro" — o serviço de sincronização é quem traduz um para o outro.
 */

export interface EnemAlternativeApi {
  letter: "A" | "B" | "C" | "D" | "E";
  text: string | null;
  file: string | null;
  isCorrect: boolean;
}

export interface EnemQuestionApi {
  title: string;
  index: number;
  /** Código da disciplina, ex.: "matematica", "ciencias-humanas". Pode ser nulo. */
  discipline: string | null;
  /** Código do idioma, ex.: "ingles", "espanhol". Nulo quando não é questão de idioma. */
  language: string | null;
  year: number;
  /** Enunciado em Markdown. Pode ser nulo. */
  context: string | null;
  files: string[];
  correctAlternative: "A" | "B" | "C" | "D" | "E";
  alternativesIntroduction: string | null;
  alternatives: EnemAlternativeApi[];
}

export interface EnemQuestionsResponseApi {
  metadata: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  questions: EnemQuestionApi[];
}

export interface EnemExamSummaryApi {
  title: string;
  year: number;
}

export interface EnemApiErrorBody {
  error: {
    code: string;
    message: string;
    docUrl?: string;
  };
}
