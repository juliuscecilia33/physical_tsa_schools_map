import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: { rejectUnauthorized: false },
  max: 10,
  prepare: false,
  connect_timeout: 10,
  connection: {
    statement_timeout: 15000, // 15s — tighter than internal 30s
  },
});

// Pre-warm the database connection
sql`SELECT 1`.catch(() => {
  console.warn("Public API: DB connection pre-warm failed (will retry on first request)");
});

export default sql;
