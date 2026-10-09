import "dotenv/config";
export const config = {
  appUrl: new URL(process.env.APP_URL || "http://localhost:5173").origin,
  secret: process.env.INTERNAL_API_SECRET || "",
  authUrl: process.env.AUTH_SERVICE_URL || "http://localhost:3001",
  linkUrl: process.env.LINK_SERVICE_URL || "http://localhost:3002",
  analyticsUrl: process.env.ANALYTICS_SERVICE_URL || "http://localhost:3003",
  production: process.env.NODE_ENV === "production",
};
export function validateConfig() {
  if (config.secret.length < 32 || config.secret.includes("<"))
    throw new Error("Set INTERNAL_API_SECRET to at least 32 random characters");
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is required for this service");
  if (config.production && !config.appUrl.startsWith("https://"))
    throw new Error("Production APP_URL must use HTTPS");
}
