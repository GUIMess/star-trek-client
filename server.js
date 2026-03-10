const path = require("path");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { dbConfigured, query } = require("./lib/db");
const {
  compareEntities,
  getEntityPayload,
  searchEntities,
} = require("./lib/knowledge-service");

const app = express();
const PORT = Number(process.env.PORT) || 8000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

function databaseUnavailable(res) {
  return res.status(503).json({
    ok: false,
    error: "database_unavailable",
    message:
      "Postgres is not configured. Set DATABASE_URL and run `npm run db:setup`.",
  });
}

app.get("/api/health", async (_req, res) => {
  if (!dbConfigured()) {
    return res.status(503).json({
      ok: false,
      status: "degraded",
      database: "missing",
      message: "DATABASE_URL is not configured.",
    });
  }

  try {
    await query("SELECT 1");
    return res.json({
      ok: true,
      status: "ready",
      database: "connected",
    });
  } catch (error) {
    return res.status(503).json({
      ok: false,
      status: "degraded",
      database: "error",
      message: error.message,
    });
  }
});

app.get("/api/search", async (req, res) => {
  if (!dbConfigured()) {
    return databaseUnavailable(res);
  }

  try {
    const q = String(req.query.q || "").trim();
    const results = await searchEntities(q, 10);
    return res.json({ ok: true, query: q, results });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/api/scan/:ref", async (req, res) => {
  if (!dbConfigured()) {
    return databaseUnavailable(res);
  }

  try {
    const payload = await getEntityPayload(req.params.ref, "scan");
    if (!payload) {
      return res.status(404).json({
        ok: false,
        error: "not_found",
        message: "No matching entity found in the console dataset.",
      });
    }

    return res.json({ ok: true, data: payload });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/api/brief/:ref", async (req, res) => {
  if (!dbConfigured()) {
    return databaseUnavailable(res);
  }

  try {
    const mode = String(req.query.mode || "first-contact");
    const payload = await getEntityPayload(req.params.ref, mode);
    if (!payload) {
      return res.status(404).json({
        ok: false,
        error: "not_found",
        message: "No matching entity found in the console dataset.",
      });
    }

    return res.json({ ok: true, data: payload });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/api/compare", async (req, res) => {
  if (!dbConfigured()) {
    return databaseUnavailable(res);
  }

  try {
    const left = String(req.query.left || "").trim();
    const right = String(req.query.right || "").trim();

    if (!left || !right) {
      return res.status(400).json({
        ok: false,
        error: "invalid_request",
        message: "Both `left` and `right` are required.",
      });
    }

    const payload = await compareEntities(left, right);
    if (!payload) {
      return res.status(404).json({
        ok: false,
        error: "not_found",
        message: "One or both comparison targets were not found.",
      });
    }

    return res.json({ ok: true, data: payload });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, async () => {
  console.log(`Starfleet Intelligence Console online at http://localhost:${PORT}`);

  if (!dbConfigured()) {
    console.log("Postgres not configured. Set DATABASE_URL and run `npm run db:setup`.");
    return;
  }

  try {
    await query("SELECT 1");
    console.log("Postgres connection verified.");
  } catch (error) {
    console.log(`Postgres connection failed: ${error.message}`);
  }
});
