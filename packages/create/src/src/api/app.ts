import Koa from "koa";
import logger from "koa-logger";

import withQueryparser from "@appril/router/queryparser";
import { routePrinter } from "@appril/router";

import { errorHandler } from "~/base/api";
import routes, { routeStack } from "./routes";

export const app = withQueryparser(new Koa());

app.on("error", console.error);

app.use(errorHandler);

if (process.env.DEBUG?.includes("api")) {
  routeStack.map((e) => routePrinter(e, console.log));
  app.use(logger());
}

// should go latest
app.use(routes);
