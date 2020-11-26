import * as functions from "firebase-functions";

import express from "express";
import cors from "cors";

import rootRouter from "./routes";
import { FBAuthMiddleware } from "./middlewares";
const app = express();

// Middleware
app
  .use(express.json())
  .use(express.urlencoded({ extended: true }))
  .use(cors())
  // .use("/", rootRouter);
  .use("/", FBAuthMiddleware, rootRouter);

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
console.log("⚡️[server]: Server is running");

app.on("error", error => console.error(error));

const runtimeOpts: functions.RuntimeOptions = { timeoutSeconds: 30 };

export const api = functions.runWith(runtimeOpts).https.onRequest(app);
