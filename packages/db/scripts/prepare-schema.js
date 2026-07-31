const fs = require("fs");
const path = require("path");
let dotenv;
try {
  dotenv = require("dotenv");
} catch (e) { }

// Load .env from root or packages/db if present
if (dotenv) {
  const rootEnv = path.join(__dirname, "../../../.env");
  if (fs.existsSync(rootEnv)) {
    dotenv.config({ path: rootEnv });
  }
  const dbEnv = path.join(__dirname, "../.env");
  if (fs.existsSync(dbEnv)) {
    dotenv.config({ path: dbEnv });
  }
}

const schemaPath = path.join(__dirname, "../prisma/schema.prisma");
if (fs.existsSync(schemaPath)) {
  let schemaContent = fs.readFileSync(schemaPath, "utf8");
  const dbUrl = (process.env.DATABASE_URL || "").trim().replace(/^["']|["']$/g, "");
  const provider = (dbUrl.startsWith("postgresql://") || dbUrl.startsWith("postgres://")) ? "postgresql" : "sqlite";

  const updatedContent = schemaContent.replace(/provider\s*=\s*"[^"]+"/, `provider = "${provider}"`);
  if (updatedContent !== schemaContent) {
    fs.writeFileSync(schemaPath, updatedContent);
    console.log(`[PrismaSchema] Automatically set provider = "${provider}" for DATABASE_URL (${dbUrl || "default"}).`);
  }
}
