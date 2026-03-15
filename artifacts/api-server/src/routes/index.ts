import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import accountingRouter from "./accounting/index.js";
import settingsRouter from "./settings.js";
import adminRouter from "./admin.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(settingsRouter);
router.use(accountingRouter);
router.use(adminRouter);

export default router;
