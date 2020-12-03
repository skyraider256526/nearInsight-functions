import { Router } from "express";
import { FBAuthMiddleware } from "../middlewares";

import postRouter from "./post";
import userRouter from "./user";

const rootRouter = Router();

rootRouter.use("/post", FBAuthMiddleware, postRouter).use("/user", userRouter);
// rootRouter.use("/post", postRouter).use("/user", userRouter);

export default rootRouter;
