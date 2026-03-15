import { Router, type IRouter } from "express";
import healthRouter from "./health";
import accountingRouter from "./accounting/index.js";
import settingsRouter from "./settings.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(settingsRouter);
router.use(accountingRouter);

export default router;
