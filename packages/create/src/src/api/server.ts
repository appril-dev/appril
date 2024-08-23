import { unlinkSync, chmodSync } from "node:fs";

import nopt from "nopt";

import "~/init";

import createApp from "./app";

const { port, sock } = nopt(
  {
    port: Number,
    sock: String,
  },
  {
    p: ["--port"],
    s: ["--sock"],
  },
);

if (!port && !sock) {
  throw new Error("Please provide either --port/-p number or --sock/-s path");
}

process.stdout.write(
  `\n\tStarting Server [ ${port ? "port" : "socket"}: ${port || sock} ]... `,
);

if (sock) {
  try {
    unlinkSync(sock);
  } catch (e) {}
}

createApp().then((app) => {
  app.listen(port || sock, () => {
    if (sock) {
      chmodSync(sock, 0o777);
    }
    console.log("\n\t✨ Server Started\n");
  });
});
