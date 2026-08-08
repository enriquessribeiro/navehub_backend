/**
 * Carrega e valida as variáveis de ambiente do backend.
 * Falha rápido (e com uma mensagem clara) se algo obrigatório estiver faltando,
 * em vez de deixar o erro estourar mais tarde no meio de uma requisição.
 */
import "dotenv/config";

interface Env {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  syncSecret: string;
  enemApiBaseUrl: string;
  corsOrigin: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(
      `Variável de ambiente obrigatória ausente: ${name}. Confira o arquivo .env (veja .env.example).`
    );
  }
  return value;
}

export const env: Env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3333),
  databaseUrl: required("DATABASE_URL"),
  syncSecret: required("SYNC_SECRET"),
  enemApiBaseUrl: process.env.ENEM_API_BASE_URL ?? "https://api.enem.dev/v1",
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
};
