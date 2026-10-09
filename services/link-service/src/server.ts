import { app } from "./app";
import { prisma } from "./lib/prisma";
import { validateConfig } from "./lib/config";
validateConfig();
const server = app.listen(
  Number(process.env.PORT || 3002),
  process.env.HOST || "127.0.0.1",
  () => console.log("link-service ready"),
);
async function shutdown() {
  server.close();
  await prisma.$disconnect();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
