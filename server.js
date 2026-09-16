import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calculate, vlsm, _internal } from "./lib/cidr.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "cidr-calculator", time: new Date().toISOString() });
});

app.get("/api/calculate", (req, res) => {
  try {
    const { ip, prefix } = req.query;
    if (!ip || prefix === undefined) {
      return res.status(400).json({ error: "Query params 'ip' and 'prefix' are required." });
    }
    res.json(calculate(ip, prefix));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/vlsm", (req, res) => {
  try {
    const { baseCidr, requirements } = req.body ?? {};
    if (!baseCidr) {
      return res.status(400).json({ error: "Body field 'baseCidr' is required (e.g. 192.168.1.0/24)." });
    }
    res.json(vlsm(baseCidr, requirements));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Unknown API endpoint." });
});

app.use((err, _req, res, _next) => {
  res.status(500).json({ error: err.message });
});

const isMainModule =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule && process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`CIDR calculator running at http://localhost:${PORT}`);
  });
}

export { app, _internal };
