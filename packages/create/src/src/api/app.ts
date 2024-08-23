import Koa from "koa";
import logger from "koa-logger";

import withQueryparser from "@appril/api/queryparser";

import {
  type DefaultContext,
  type DefaultState,
  routePrinter,
} from "@appril/api/router";

import { errorHandler } from "~/base/@api/app";
import routes, { routeStack } from "_/api/routes";

export default async () => {
  const app = withQueryparser(new Koa<DefaultState, DefaultContext>());

  app.on("error", console.error);

  app.use(errorHandler);

  if (process.env.DEBUG?.includes("api")) {
    routeStack.map((e) => routePrinter(e, console.log));
    app.use(logger());
  }

  // should go latest
  app.use(routes);

  return app;
};
