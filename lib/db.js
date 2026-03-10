const { Pool } = require("pg");

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.PG_CONNECTION_STRING ||
  "";

let pool = null;

function dbConfigured() {
  return Boolean(connectionString);
}

function getPool() {
  if (!dbConfigured()) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!pool) {
    const useSsl =
      process.env.PGSSLMODE === "require" ||
      /render\.com|railway\.app|neon\.tech|supabase\.co/i.test(connectionString);

    pool = new Pool({
      connectionString,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    });
  }

  return pool;
}

async function query(text, params = []) {
  const activePool = getPool();
  return activePool.query(text, params);
}

async function withTransaction(callback) {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  closePool,
  dbConfigured,
  getPool,
  query,
  withTransaction,
};
