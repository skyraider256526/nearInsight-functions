import * as functions from 'firebase-functions';

import Koa from "koa";
import BodyParser from "koa-bodyparser";
import Logger from "koa-logger";
import json from 'koa-json';
import cors from '@koa/cors';
// import serve from "koa-static";

import router from './routes';

const app = new Koa();

// Middleware
app.use(BodyParser());
app.use(Logger());
app.use(cors());
app.use(json());


app.use(router.routes()).use(router.allowedMethods());


// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
console.log('Running')

export const api = functions.https.onRequest(app.callback())