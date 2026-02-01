import express from "express";
import cors from "cors";
import { nanoid } from "nanoid";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ limit: '30mb', extended: true }));

// -------------------------------------
// Resolve project root
// -------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

// -------------------------------------
// In-memory bundle store (v0)
// -------------------------------------
// {
//   [id]: {
//     files: [{ name, geojson }],
//     createdAt: Date
//   }
// }
const store = Object.create(null);

// -------------------------------------
// API: Share bundle
// -------------------------------------
app.post("/api/share", (req, res) => {
    const { files } = req.body || {};

    if (!Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: "Expected files[]" });
    }

    for (const f of files) {
        if (
            !f ||
            typeof f.name !== "string" ||
            !f.geojson ||
            f.geojson.type !== "FeatureCollection"
        ) {
            return res.status(400).json({
                error: "Each file must have { name, geojson: FeatureCollection }"
            });
        }
    }

    const id = nanoid(8);

    store[id] = {
        files,
        createdAt: new Date()
    };

    res.json({ id });
});

// -------------------------------------
// API: View bundle
// -------------------------------------
app.get("/api/view/:id", (req, res) => {
    const bundle = store[req.params.id];
    if (!bundle) {
        return res.status(404).json({ error: "Not found" });
    }

    res.json(bundle);
});

// -------------------------------------
// Static frontend
// -------------------------------------
app.use(express.static(PROJECT_ROOT));

// -------------------------------------
// SPA fallback (LAST)
// -------------------------------------
app.use((req, res) => {
    res.sendFile(path.join(PROJECT_ROOT, "index.html"));
});

// -------------------------------------
app.listen(3001, () => {
    console.log("Server running on http://localhost:3001");
});
