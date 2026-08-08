import type { NextFunction, Request, Response } from "express";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  console.error("[navehub-backend] erro não tratado:", err);

  const message = err instanceof Error ? err.message : "Erro interno inesperado.";

  res.status(500).json({
    error: { code: "internal_server_error", message },
  });
}
