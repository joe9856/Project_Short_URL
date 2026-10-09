import { app } from "./app";
const secret = process.env.INTERNAL_API_SECRET || "";
if (secret.length < 32 || secret.includes("<"))
  throw new Error("Set a strong INTERNAL_API_SECRET");
const server = app.listen(
  Number(process.env.PORT || 3000),
  process.env.HOST || "127.0.0.1",
  () => console.log("Gateway ready"),
);
process.on("SIGTERM", () => server.close());
process.on("SIGINT", () => server.close());
