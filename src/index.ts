import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { apiRouter } from "./routes";

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: "1mb" }));

app.use("/api", apiRouter);

app.use((req, res) => {
  res.status(404).json({ error: { code: "not_found", message: `Rota não encontrada: ${req.path}` } });
});

app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`[navehub-backend] rodando na porta ${env.port} (${env.nodeEnv})`);
});
