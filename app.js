// JavaScript source code


// ==============================
// Visualization constants
// ==============================

const PRIMARY = "#2563eb";     // main overlay color
const PRIMARY_DARK = "#1e40af"; // for lines / emphasis
const IS_VIEW_MODE = location.pathname.startsWith("/v/");



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




// ==============================
// GeoJSON handling
// ==============================

const SOURCE_ID = "uploaded-geojson";

document.getElementById("fileInput").addEventListener("change", handleFile);

function handleFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        try {
            const geojson = JSON.parse(reader.result);
            renderGeoJSON(geojson);

            if (!location.pathname.startsWith("/v/")) {
                uploadAndGetLink(geojson);
            }


        } catch (err) {
            alert("Invalid GeoJSON file");
            console.error(err);
        }
    };
    reader.readAsText(file);

 
}

function renderGeoJSON(geojson) {

    document.getElementById("empty-state")?.remove();

    // Remove existing source/layers if present
    if (map.getSource(SOURCE_ID)) {
        removeLayerIfExists("points");
        removeLayerIfExists("lines");
        removeLayerIfExists("polygons");
        removeLayerIfExists("polygons-outline");
        map.removeSource(SOURCE_ID);
    }


    map.addSource(SOURCE_ID, {
        type: "geojson",
        data: geojson
    });

    // Polygons
    map.addLayer({
        id: "polygons",
        type: "fill",
        source: SOURCE_ID,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
            "fill-color": PRIMARY,
            "fill-opacity": 0.354
        }
    });

    map.addLayer({
        id: "polygons-outline",
        type: "line",
        source: SOURCE_ID,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
            "line-color": PRIMARY,
            "line-width": 3
        }
    });

    // Lines
    map.addLayer({
        id: "lines",
        type: "line",
        source: SOURCE_ID,
        filter: ["==", ["geometry-type"], "LineString"],
        paint: {
            "line-color": PRIMARY_DARK,
            "line-width": 4,
            "line-opacity": 0.9
        }
    });

    // Points
    map.addLayer({
        id: "points",
        type: "circle",
        source: SOURCE_ID,
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
            "circle-radius": 7,
            "circle-color": PRIMARY,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff"
        }


    });

    fitToBounds(geojson);
    enablePopups();

}

function removeLayerIfExists(id) {
    if (map.getLayer(id)) map.removeLayer(id);
}

// ==============================
// Drag & Drop Upload
// ==============================

const dropzone = document.getElementById("dropzone");

if (!IS_VIEW_MODE) {
    ["dragenter", "dragover"].forEach(eventName => {
        dropzone.addEventListener(eventName, e => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add("dragover");
        });
    });

    ["dragleave", "drop"].forEach(eventName => {
        dropzone.addEventListener(eventName, e => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove("dragover");
        });
    });

    dropzone.addEventListener("drop", e => {
        const file = e.dataTransfer.files[0];
        if (!file) return;

        if (!file.name.match(/\.(geojson|json)$/i)) {
            alert("Please drop a GeoJSON file");
            return;
        }

        handleFile({ target: { files: [file] } });
    });
}



// ==============================
// Fit bounds
// ==============================

function fitToBounds(geojson) {
    const bounds = new maplibregl.LngLatBounds();

    geojson.features.forEach(f => {
        const coords = extractCoords(f.geometry);
        coords.forEach(c => bounds.extend(c));
    });

    if (!bounds.isEmpty()) {
        map.fitBounds(bounds, {
            padding: 40,
            duration: 500
        });
    }
}

// Hover affordance (registered once)
map.on("mousemove", e => {
    const features = map.queryRenderedFeatures(e.point, {
        layers: ["points", "lines", "polygons"]
    });
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
//Helper Funciton for Link Creation
//==================================

async function uploadAndGetLink(geojson) {
    const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geojson)
    });

    if (!res.ok) {
        const msg = await res.text().catch(() => "");
        alert("Failed to create share link.\n" + msg);
        return;
    }

    const { id } = await res.json();
    const url = `${location.origin}/v/${id}`;

    showShareBox(url);
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
        renderGeoJSON(geojson);

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

function enablePopups() {
    map.on("click", e => {
        const features = map.queryRenderedFeatures(e.point, {
            layers: ["points", "lines", "polygons"]
        });

        if (!features.length) return;

        const props = features[0].properties || {};
        const html = renderProperties(props);

        new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(html)
            .addTo(map);
    });
}

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
