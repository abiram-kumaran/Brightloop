import { z } from "zod";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().optional().default(""),
  PGLITE_DATA_DIR: z.string().default("./data/brightloop-pg"),
  JWT_SECRET: z.string().default("brightloop-hackathon-jwt-secret-key-32chars-min"),
  COOKIE_SECRET: z.string().default("brightloop-hackathon-cookie-secret-key-32chars-min"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  INVOICE_AUTO_CONFIRM: z
    .string()
    .optional()
    .transform((val) => val === "true" || val === undefined),
  BUSINESS_TIMEZONE: z.string().default("Asia/Kolkata"),
});

export const config = envSchema.parse(process.env);
