import Router from 'koa-router';
import HttpStatus from 'http-status';

const router = new Router()

router.get("/",async (ctx,next)=>{
  ctx.status = HttpStatus.OK;
  ctx.body = 'Hello Hi';
  await next();
});

export default router