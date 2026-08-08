import { Prisma, AreaEnem } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { fetchEnemQuestionsPage } from "./enemApi.service";
import type { EnemQuestionApi } from "../types/enem.types";

const PAGE_SIZE = 50;
/** Teto de segurança de páginas por ano: evita loop infinito se a API
 *  devolver `hasMore` indevidamente. 300 páginas ≈ 15 mil questões/ano. */
const MAX_PAGINAS = 300;
/** Lote de upserts por transação — em vez de um round-trip por questão,
 *  agrupa em transações (um ano tem ~180 questões). */
const BATCH_TRANSACAO = 25;

/** Guard de concorrência: o endpoint é chamado por cron e pode ser disparado
 *  mais de uma vez por engano; só uma sincronização roda por vez. */
let sincronizacaoEmAndamento = false;

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

      // Guard de segurança: API travada devolvendo hasMore=true para sempre
      // não pode deixar a sincronização rodando em loop.
      if (result.paginasProcessadas > MAX_PAGINAS) {
        result.erro = `Limite de ${MAX_PAGINAS} páginas por ano atingido — interrompido por segurança.`;
        break;
      }

      result.questoesRecebidas += page.questions.length;

      if (page.questions.length === 0) {
        if (page.metadata.hasMore) {
          result.erro = `API devolveu página vazia com hasMore=true (offset ${offset}). Interrompido para não entrar em loop.`;
        }
        break;
      }

      // Grava em lotes transacionais (não um upsert por round-trip): para um
      // ano completo de prova isso reduz drasticamente o tempo da
      // sincronização e a pressão no banco. Continua sem duplicar — o
      // upsert pela chave natural `enem_id` garante a idempotência.
      for (let i = 0; i < page.questions.length; i += BATCH_TRANSACAO) {
        const lote = page.questions.slice(i, i + BATCH_TRANSACAO);

        await prisma.$transaction(
          lote.map((question) => {
            const dados = toQuestionCreateData(question);
            return prisma.question.upsert({
              where: { enemId: dados.enemId },
              create: dados,
              update: {
                area: dados.area,
                disciplina: dados.disciplina,
                idioma: dados.idioma,
                titulo: dados.titulo,
                enunciado: dados.enunciado,
                introducaoAlternativas: dados.introducaoAlternativas,
                arquivos: dados.arquivos,
                alternativas: dados.alternativas,
                gabarito: dados.gabarito,
                dadosOriginais: dados.dadosOriginais,
              },
            });
          })
        );
        result.questoesSalvas += lote.length;
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
  // Como o endpoint pode ser disparado por cron + retry manual quase ao
  // mesmo tempo, só deixamos UMA sincronização rodar (as seguintes retornam
  // erro suave com status indicativo — sem quebrar quem chamou).
  if (sincronizacaoEmAndamento) {
    return years.map((year) => ({
      year,
      paginasProcessadas: 0,
      questoesRecebidas: 0,
      questoesSalvas: 0,
      erro: "Já existe uma sincronização em andamento. Tente novamente depois.",
    }));
  }

  sincronizacaoEmAndamento = true;
  const results: SyncYearResult[] = [];
  try {
    // Sincroniza um ano por vez (sequencial, não em paralelo) para não
    // estourar o limite de 1 requisição/segundo da API.
    for (const year of years) {
      results.push(await syncEnemYear(year, language));
    }
  } finally {
    sincronizacaoEmAndamento = false;
  }
  return results;
}
