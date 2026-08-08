import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

/**
 * A rota de sincronização não é chamada pelo navegador do aluno/professor —
 * é chamada por um agendador (cron) de servidor a servidor. Por isso, uma
 * chave secreta simples no header já é suficiente (não precisa validar um
 * JWT de usuário do Supabase aqui).
 */
export function requireSyncKey(req: Request, res: Response, next: NextFunction): void {
  const providedKey = req.header("x-sync-key");

  if (!providedKey || providedKey !== env.syncSecret) {
    res.status(401).json({
      error: { code: "unauthorized", message: "Header x-sync-key ausente ou inválido." },
    });
    return;
  }

  next();
}
