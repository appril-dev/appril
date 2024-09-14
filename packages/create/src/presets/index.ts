import dbxt from "./dbxt";
import pgxt from "./pgxt";
import biome from "./biome";

export default {
  dbxt: { title: "@appril/dbxt", worker: dbxt },
  pgxt: { title: "@appril/pgxt", worker: pgxt },
  biome: { title: "Biome Linter / Formatter", worker: biome },
} as const;
