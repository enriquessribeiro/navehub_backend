import { env } from "../config/env";
import type { EnemApiErrorBody, EnemQuestionsResponseApi } from "../types/enem.types";

/**
 * A API do enem.dev permite 1 requisição/segundo nos endpoints sem cache
 * (ver https://docs.enem.dev/rate-limits). Esse pequeno atraso entre
 * chamadas evita bater em 429 na maior parte do tempo; o retry abaixo cobre
 * o resto.
 */
const MIN_INTERVAL_MS = 1100;
const MAX_RETRIES = 3;

let lastRequestAt = 0;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttle(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_INTERVAL_MS) {
    await sleep(MIN_INTERVAL_MS - elapsed);
  }
  lastRequestAt = Date.now();
}

async function fetchWithRetry(url: string, attempt = 0): Promise<Response> {
  await throttle();
  const response = await fetch(url);

  if (response.status === 429 && attempt < MAX_RETRIES) {
    const retryAfterHeader = response.headers.get("Retry-After");
    // O header documentado vem em milissegundos.
    const waitMs = retryAfterHeader ? Number(retryAfterHeader) : MIN_INTERVAL_MS * 2;
    await sleep(Number.isFinite(waitMs) && waitMs > 0 ? waitMs : MIN_INTERVAL_MS * 2);
    return fetchWithRetry(url, attempt + 1);
  }

  return response;
}

/**
 * Busca uma página de questões de uma prova (ano) do ENEM.
 *
 * Importante: a API NÃO filtra por disciplina — só por `limit`, `offset` e
 * `language`. O campo `discipline` vem em cada questão da resposta, e é o
 * nosso serviço de sincronização quem usa isso para popular a coluna `area`
 * no nosso banco. Filtrar por área é feito depois, na nossa própria base.
 */
export async function fetchEnemQuestionsPage(params: {
  year: number;
  limit: number;
  offset: number;
  language?: string;
}): Promise<EnemQuestionsResponseApi> {
  const query = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  });
  if (params.language) {
    query.set("language", params.language);
  }

  const url = `${env.enemApiBaseUrl}/exams/${params.year}/questions?${query.toString()}`;
  const response = await fetchWithRetry(url);

  if (!response.ok) {
    let message = `Falha ao buscar questões (HTTP ${response.status}) em ${url}`;
    try {
      const body = (await response.json()) as EnemApiErrorBody;
      if (body?.error?.message) {
        message = `${message} — ${body.error.message}`;
      }
    } catch {
      // corpo não era JSON — mantém a mensagem genérica acima
    }
    throw new Error(message);
  }

  return (await response.json()) as EnemQuestionsResponseApi;
}
