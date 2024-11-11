import { type UseSpec, use } from "@appril/api";
import bodyparser from "@appril/api/bodyparser";

export default (): Array<UseSpec> => [
  use(bodyparser.json(), {
    slot: "bodyparser",
    before: ["post", "put", "patch"],
  }),

  use(
    (ctx, next) => {
      ctx.payload = "body" in ctx.request ? ctx.request.body : ctx.query;
      return next();
    },
    { slot: "payload" },
  ),
];
