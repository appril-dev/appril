import Router from "@koa/router";

const router = new Router({
  // highly important! only run last matched route when there are multiple matches
  exclusive: true,
});

export default router;
