process.env.INTERNAL_API_SECRET = "unit-test-secret-only-not-for-deployment";
process.env.APP_URL = "http://localhost:5173";
process.env.DATABASE_URL = "postgresql://unused:unused@127.0.0.1:1/unavailable";

process.env.DIRECT_URL = process.env.DATABASE_URL;
