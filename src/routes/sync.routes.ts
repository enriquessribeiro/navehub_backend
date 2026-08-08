import { Router } from "express";
import { z } from "zod";
import { requireSyncKey } from "../middleware/requireSyncKey";
import { syncEnemYears } from "../services/enemSync.service";

export const syncRouter = Router();

const syncBodySchema = z.object({
  /** Anos das provas a sincronizar, ex.: [2022, 2023]. */
  years: z.array(z.number().int().min(2009).max(2100)).min(1),
  /** Filtra por idioma (ex.: "ingles"/"espanhol"). Opcional. */
  language: z.string().optional(),
});

syncRouter.post("/sync/enem", requireSyncKey, async (req, res) => {
  const parseResult = syncBodySchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: "bad_request",
        message: "Corpo inválido. Esperado: { years: number[], language?: string }.",
        details: parseResult.error.flatten(),
      },
    });
    return;
  }

  const { years, language } = parseResult.data;
  const results = await syncEnemYears(years, language);

  const houveErro = results.some((r) => r.erro);
  res.status(houveErro ? 207 : 200).json({ results });
});
