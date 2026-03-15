import { Router, type IRouter } from "express";
import healthRouter from "./health";
import accountingRouter from "./accounting/index.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(accountingRouter);

export default router;
