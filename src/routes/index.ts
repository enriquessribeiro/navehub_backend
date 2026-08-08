import { Router } from "express";
import { healthRouter } from "./health.routes";
import { syncRouter } from "./sync.routes";

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(syncRouter);
