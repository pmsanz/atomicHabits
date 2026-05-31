import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import identitiesRouter from "./identities";
import habitsRouter from "./habits";
import habitLogsRouter from "./habit-logs";
import habitStacksRouter from "./habit-stacks";
import journalRouter from "./journal";
import dashboardRouter from "./dashboard";
import aiRouter from "./ai";
import exportRouter from "./export";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(identitiesRouter);
router.use(habitsRouter);
router.use(habitLogsRouter);
router.use(habitStacksRouter);
router.use(journalRouter);
router.use(dashboardRouter);
router.use(aiRouter);
router.use(exportRouter);

export default router;
