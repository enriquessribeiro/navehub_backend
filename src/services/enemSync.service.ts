import { Prisma, AreaEnem } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { fetchEnemQuestionsPage } from "./enemApi.service";
import type { EnemQuestionApi } from "../types/enem.types";

const PAGE_SIZE = 50;

/**
 * Traduz o código de disciplina retornado pela API ("ciencias-humanas", com
 * hífen) para o enum AreaEnem do nosso banco ("ciencias_humanas", com
 * underscore). Disciplinas desconhecidas ou nulas viram `null` — a questão
 * ainda é salva, só não entra em nenhum filtro de área.
 */
function mapDiscipline(discipline: string | null): AreaEnem | null {
  switch (discipline) {
    case "matematica":
      return AreaEnem.matematica;
    case "linguagens":
      return AreaEnem.linguagens;
    case "ciencias-humanas":
      return AreaEnem.ciencias_humanas;
    case "ciencias-natureza":
      return AreaEnem.ciencias_natureza;
    default:
      return null;
  }
}

function toQuestionCreateData(question: EnemQuestionApi): Prisma.QuestionCreateInput {
  const alternativas = question.alternatives.map((alt) => ({
    letra: alt.letter,
    texto: alt.text,
    arquivo: alt.file,
    correta: alt.isCorrect,
  }));

  return {
    enemId: `${question.year}-${question.index}`,
    ano: question.year,
    area: mapDiscipline(question.discipline) ?? undefined,
    disciplina: question.discipline,
    idioma: question.language ?? "portugues",
    titulo: question.title,
    enunciado: question.context,
    introducaoAlternativas: question.alternativesIntroduction,
    arquivos: question.files,
    alternativas,
    gabarito: question.correctAlternative,
    dadosOriginais: question as unknown as Prisma.InputJsonValue,
  };
}

export interface SyncYearResult {
  year: number;
  paginasProcessadas: number;
  questoesRecebidas: number;
  questoesSalvas: number;
  erro?: string;
}

/**
 * Sincroniza todas as questões de um ano de prova, paginando conforme o
 * `hasMore` retornado pela API. Cada questão é gravada com um `upsert`
 * (chave natural `enemId = "{ano}-{index}"`), então rodar de novo é seguro
 * e idempotente — não duplica nem perde nada já importado.
 */
export async function syncEnemYear(year: number, language?: string): Promise<SyncYearResult> {
  const result: SyncYearResult = {
    year,
    paginasProcessadas: 0,
    questoesRecebidas: 0,
    questoesSalvas: 0,
  };

  try {
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const page = await fetchEnemQuestionsPage({ year, limit: PAGE_SIZE, offset, language });
      result.paginasProcessadas += 1;
      result.questoesRecebidas += page.questions.length;

      for (const question of page.questions) {
        const data = toQuestionCreateData(question);
        await prisma.question.upsert({
          where: { enemId: data.enemId },
          create: data,
          update: {
            area: data.area,
            disciplina: data.disciplina,
            idioma: data.idioma,
            titulo: data.titulo,
            enunciado: data.enunciado,
            introducaoAlternativas: data.introducaoAlternativas,
            arquivos: data.arquivos,
            alternativas: data.alternativas,
            gabarito: data.gabarito,
            dadosOriginais: data.dadosOriginais,
          },
        });
        result.questoesSalvas += 1;
      }

      hasMore = page.metadata.hasMore;
      offset += PAGE_SIZE;
    }
  } catch (error) {
    result.erro = error instanceof Error ? error.message : "Erro desconhecido na sincronização";
  }

  return result;
}

export async function syncEnemYears(years: number[], language?: string): Promise<SyncYearResult[]> {
  const results: SyncYearResult[] = [];
  // Sincroniza um ano por vez (sequencial, não em paralelo) para não
  // estourar o limite de 1 requisição/segundo da API.
  for (const year of years) {
    results.push(await syncEnemYear(year, language));
  }
  return results;
}
