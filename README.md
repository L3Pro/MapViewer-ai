# MapViewer.ai

A lightweight, browser-based GeoJSON viewer with shareable, read-only links.

MapViewer.ai lets you drag-and-drop GeoJSON files into a clean MapLibre-powered map,
automatically visualize points, lines, and polygons, and generate shareable URLs
that others can open without editing.

## Features

- Drag & drop GeoJSON upload
- Automatic styling for points, lines, and polygons
- Fit-to-bounds visualization
- Property popups
- Read-only shared links (`/v/:id`)
- No accounts, no auth, no lock-in

## Tech Stack

- Frontend: Vanilla JS + MapLibre GL
- Backend: Node.js + Express
- Storage: In-memory (v0)

## Local Development

```bash
cd server
npm install
node index.js
