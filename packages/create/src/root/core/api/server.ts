import { parseArgs } from "node:util";
import { unlink, chmod } from "node:fs/promises";

const {
  values: { port, sock },
} = parseArgs({
  options: {
    port: {
      type: "string",
      short: "p",
    },
    sock: {
      type: "string",
      short: "s",
    },
  },
});

if (![port, sock].some((e) => e)) {
  console.error("Please provide either -p/--port number or -s/--sock path");
  process.exit(1);
}

console.log("\n  ➜ Starting Server", { port, sock });

if (sock) {
  await unlink(sock).catch((error) => {
    if (error.code === "ENOENT") {
      return;
    }
    console.error(error.message);
    process.exit(1);
  });
}

// biome-ignore lint:
type App = import("koa")<any, any>;

export default async <T extends App = App>(createApp: () => T | Promise<T>) => {
  const app = await createApp();
  app.listen(port || sock, async () => {
    if (sock) {
      await chmod(sock, 0o777);
    }
    console.log("\n  ➜ Server Started ✨\n");
  });
};
