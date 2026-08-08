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
/** Tempo de espera máximo por página da API antes de abortar — sem isso,
 *  uma resposta travada deixaria a sincronização pendurada indefinidamente. */
const TIMEOUT_MS = 15_000;

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

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (erroFetch) {
    // Timeout/abort da requisição: tenta de novo (poucas vezes), senão propaga.
    if (attempt < MAX_RETRIES && erroFetch instanceof Error && erroFetch.name === "AbortError") {
      await sleep(MIN_INTERVAL_MS);
      return fetchWithRetry(url, attempt + 1);
    }
    throw erroFetch;
  }

  if (response.status === 429 && attempt < MAX_RETRIES) {
    const retryAfterHeader = response.headers.get("Retry-After");
    // O padrão HTTP define Retry-After em SEGUNDOS (ou HTTP-date). Antes o
    // valor era tratado como milissegundos, o que produzia retries em cadeia
    // contra o rate limit. Valores não numéricos caem no fallback abaixo.
    const segundos = retryAfterHeader ? Number(retryAfterHeader) : 0;
    const esperaMs = Number.isFinite(segundos) && segundos > 0 ? segundos * 1000 : MIN_INTERVAL_MS * 2;
    await sleep(Math.max(esperaMs, MIN_INTERVAL_MS));
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
