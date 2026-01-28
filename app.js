// JavaScript source code


// ==============================
// Visualization constants
// ==============================

const PRIMARY = "#2563eb";     // main overlay color
const PRIMARY_DARK = "#1e40af"; // for lines / emphasis
const IS_VIEW_MODE = location.pathname.startsWith("/v/");
let fileCounter = 0;
const filesRegistry = []; // [{ id, name, geojson, bounds, sourceId, layerIds, visible }]



// ==============================
// Map bootstrap
// ==============================

if (IS_VIEW_MODE) {
    document.getElementById("readonly-banner").hidden = false;
}


const map = new maplibregl.Map({
    container: "map",
    style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    center: [0, 0],
    zoom: 2
});

map.addControl(new maplibregl.NavigationControl(), "top-right");

map.on("load", () => {
    const style = map.getStyle();

    style.layers
        .filter(l => l.type === "fill" && l.id.includes("water"))
        .forEach(l => {
            map.setPaintProperty(l.id, "fill-color", "#dbeafe");
        });

    // ✅ hydrate shared map only after map is ready
    maybeLoadSharedMapFromUrl();
});



// Enforce read-only behavior
map.getCanvas().addEventListener("contextmenu", e => {
    e.preventDefault();
});

//=================================
// Add GeoJSON File Layer Function
//================================

function addGeoJSONFileLayer(name, geojson) {
    document.getElementById("empty-state")?.remove();

    const id = `f${++fileCounter}`;
    const sourceId = `geojson-${id}`;

    const bounds = computeBounds(geojson);

    map.addSource(sourceId, { type: "geojson", data: geojson });

    // unique layer ids per file
    const polygonsId = `polygons-${id}`;
    const polygonsOutlineId = `polygons-outline-${id}`;
    const linesId = `lines-${id}`;
    const pointsId = `points-${id}`;

    // Add layers (order: polygons -> outline -> lines -> points)
    map.addLayer({
        id: polygonsId,
        type: "fill",
        source: sourceId,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": PRIMARY, "fill-opacity": 0.354 }
    });

    map.addLayer({
        id: polygonsOutlineId,
        type: "line",
        source: sourceId,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "line-color": PRIMARY, "line-width": 3 }
    });

    map.addLayer({
        id: linesId,
        type: "line",
        source: sourceId,
        filter: ["==", ["geometry-type"], "LineString"],
        paint: { "line-color": PRIMARY_DARK, "line-width": 4, "line-opacity": 0.9 }
    });

    map.addLayer({
        id: pointsId,
        type: "circle",
        source: sourceId,
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
            "circle-radius": 7,
            "circle-color": PRIMARY,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff"
        }
    });

    const entry = {
        id,
        name,
        geojson,
        bounds,
        sourceId,
        layerIds: [polygonsId, polygonsOutlineId, linesId, pointsId],
        visible: true
    };

    filesRegistry.push(entry);
    renderFilesPanel();

    // Auto-zoom only on first file
    if (filesRegistry.length === 1 && bounds) {
        map.fitBounds(bounds, { padding: 40, duration: 500 });
    }

}



//=============================================
// Copute Bounds Helper function
//=============================================
function computeBounds(geojson) {
    try {
        const bounds = new maplibregl.LngLatBounds();

        for (const f of geojson.features || []) {
            const coords = extractCoords(f.geometry);
            coords.forEach(c => bounds.extend(c));
        }

        return bounds.isEmpty() ? null : bounds;
    } catch {
        return null;
    }
}

//===============================================
// Function to render the file panel on left side
//==============================================

function renderFilesPanel() {
    const panel = document.getElementById("files-panel");
    const list = document.getElementById("files-list");
    if (!panel || !list) return;

    // Show panel only when >1 file
    panel.hidden = filesRegistry.length < 2;

    list.innerHTML = "";

    for (const file of filesRegistry) {
        const row = document.createElement("div");
        row.className = "file-row";

        const eye = document.createElement("button");
        eye.className = "file-eye";
        eye.type = "button";
        eye.textContent = file.visible ? "👁" : "🚫";

        // Prevent row click when clicking eye
        eye.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleFileVisibility(file.id);
            renderFilesPanel();
        });

        const name = document.createElement("div");
        name.className = "file-name";
        name.textContent = file.name;

        row.appendChild(eye);
        row.appendChild(name);

        row.addEventListener("click", () => {
            if (file.bounds) {
                map.fitBounds(file.bounds, { padding: 50, duration: 450 });
            }
        });

        list.appendChild(row);
    }
}


//================================================
// Toggle Visibility Function
//===============================================
function toggleFileVisibility(fileId) {
    const file = filesRegistry.find(f => f.id === fileId);
    if (!file) return;

    file.visible = !file.visible;
    const visibility = file.visible ? "visible" : "none";

    for (const layerId of file.layerIds) {
        if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, "visibility", visibility);
        }
    }
}



// ==============================
// GeoJSON handling
// ==============================


document.getElementById("fileInput").addEventListener("change", (e) => {
    if (!e.target.files?.length) return;
    handleFiles(Array.from(e.target.files));
    e.target.value = ""; // allow re-uploading same file name
});


async function handleFiles(files) {
    for (const file of files) {
        if (!file.name.match(/\.(geojson|json)$/i)) {
            alert(`Unsupported file: ${file.name}`);
            continue;
        }

        try {
            const text = await file.text();
            const geojson = JSON.parse(text);

            if (!geojson || geojson.type !== "FeatureCollection") {
                alert(`Invalid GeoJSON (expected FeatureCollection): ${file.name}`);
                continue;
            }

            addGeoJSONFileLayer(file.name, geojson);
        } catch (err) {
            console.error(err);
            alert(`Failed to load: ${file.name}`);
        }
    }
}



// ==============================
// Global drag activation (minimal & correct)
// ==============================

window.addEventListener("dragenter", e => {
    e.preventDefault();
    document.body.classList.add("dragging");
});

window.addEventListener("dragover", e => {
    e.preventDefault();
});

window.addEventListener("dragleave", e => {
    if (e.target === document.body || e.target === document.documentElement) {
        document.body.classList.remove("dragging");
    }
});

window.addEventListener("drop", e => {
    e.preventDefault();
    document.body.classList.remove("dragging");
});


// ==============================
// Drag & Drop Upload (correct)
// ==============================

const dropzone = document.getElementById("dropzone");

if (!IS_VIEW_MODE) {

    // Prevent browser from opening files
    window.addEventListener("dragover", e => e.preventDefault());
    window.addEventListener("drop", e => e.preventDefault());

    dropzone.addEventListener("dragenter", e => {
        e.preventDefault();
        dropzone.classList.add("dragover");
    });

    dropzone.addEventListener("dragover", e => {
        e.preventDefault();
    });

    dropzone.addEventListener("dragleave", e => {
        e.preventDefault();

        // Only remove if actually leaving the dropzone
        if (e.target === dropzone) {
            dropzone.classList.remove("dragover");
        }
    });

    dropzone.addEventListener("drop", e => {
        e.preventDefault();
        dropzone.classList.remove("dragover");

        const files = Array.from(e.dataTransfer.files || []);
        if (!files.length) return;

        handleFiles(files);
    });
}




// ==============================
// Fit bounds
// ==============================

// Hover affordance (registered once)
map.on("mousemove", e => {
    const layerIds = filesRegistry.flatMap(f => f.layerIds);
    if (!layerIds.length) {
        map.getCanvas().style.cursor = "";
        return;
    }

    const features = map.queryRenderedFeatures(e.point, { layers: layerIds });
    map.getCanvas().style.cursor = features.length ? "pointer" : "";
});



function extractCoords(geometry) {
    const coords = [];

    const recurse = g => {
        if (!g) return;
        if (typeof g[0] === "number") {
            coords.push(g);
        } else {
            g.forEach(recurse);
        }
    };

    recurse(geometry.coordinates);
    return coords;
}


//==================================
// Helper Function for Link box
//==================================

function showShareBox(url) {
    if (IS_VIEW_MODE) return;

    const box = document.getElementById("share-box");
    const input = document.getElementById("share-url");
    const button = document.getElementById("copy-btn");

    input.value = url;
    box.hidden = false;

    button.onclick = async () => {
        try {
            await navigator.clipboard.writeText(url);
            button.textContent = "Copied";
            setTimeout(() => (button.textContent = "Copy"), 1200);
        } catch {
            input.select();
        }
    };
}



//====================================
// Hydration Logic for /v/:id
//====================================

async function maybeLoadSharedMapFromUrl() {
    const match = location.pathname.match(/^\/v\/([A-Za-z0-9_-]+)$/);
    if (!match) return;

    const id = match[1];

    try {
        const res = await fetch(`/api/view/${id}`);
        if (!res.ok) {
            alert("Shared map not found (maybe expired).");
            return;
        }
        const geojson = await res.json();
        addGeoJSONFileLayer("Shared file", geojson);


        // Optional: hide upload UI in view mode
        const fileInput = document.getElementById("fileInput");
        if (fileInput) fileInput.style.display = "none";
    } catch (e) {
        console.error(e);
        alert("Failed to load shared map.");
    }
}


// ==============================
// Popups
// ==============================

map.on("click", e => {
    const layerIds = filesRegistry.flatMap(f => f.layerIds);

    if (!layerIds.length) return;

    const features = map.queryRenderedFeatures(e.point, {
        layers: layerIds
    });

    if (!features.length) return;

    const props = features[0].properties || {};
    const html = renderProperties(props);

    new maplibregl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(html)
        .addTo(map);
});


function renderProperties(properties) {
    const rows = Object.entries(properties)
        .map(([k, v]) =>
            `<tr><td class="key">${k}</td><td>${String(v)}</td></tr>`
        )
        .join("");

    return `
    <div class="popup">
      <table>${rows}</table>
    </div>
  `;
}
