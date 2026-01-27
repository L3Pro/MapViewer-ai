import express from "express";
import cors from "cors";
import { nanoid } from "nanoid";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Resolve project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

// ------------------------------
// In-memory GeoJSON store (v0)
// ------------------------------
const store = Object.create(null);

// ------------------------------
// API ROUTES FIRST
// ------------------------------
app.post("/api/share", (req, res) => {
    const geojson = req.body;

    if (!geojson || geojson.type !== "FeatureCollection") {
        return res.status(400).json({ error: "Invalid GeoJSON" });
    }

    const id = nanoid(8);
    store[id] = geojson;

    res.json({ id });
});

app.get("/api/view/:id", (req, res) => {
    const geojson = store[req.params.id];
    if (!geojson) return res.status(404).json({ error: "Not found" });

    res.json(geojson);
});

// ------------------------------
// STATIC FRONTEND
// ------------------------------
app.use(express.static(PROJECT_ROOT));

// ------------------------------
// SPA FALLBACK (LAST!)
// ------------------------------
app.use((req, res) => {
    res.sendFile(path.join(PROJECT_ROOT, "index.html"));
});


app.listen(3001, () => {
    console.log("Server running on http://localhost:3001");
});
