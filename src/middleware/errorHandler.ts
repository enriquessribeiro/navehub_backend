import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  console.error("[navehub-backend] erro não tratado:", err);

  // Em produção não devolvemos o texto do erro interno pro cliente (pode
  // vazar detalhes de infraestrutura/bibliotecas). Detalhes ficam no log.
  const message =
    env.nodeEnv === "production"
      ? "Erro interno do servidor."
      : err instanceof Error
        ? err.message
        : "Erro interno inesperado.";

  res.status(500).json({
    error: { code: "internal_server_error", message },
  });
}
