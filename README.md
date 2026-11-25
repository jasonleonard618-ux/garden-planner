# Garden Planner

A web app that plans a garden from your site: location, sun and shade, slope, wind, climate zone and soil, then garden size, layout, construction and budget.

This branch holds **step 1: site mapping** (work in progress).

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Free public data it uses

| What | Source |
| --- | --- |
| Aerial photos | USDA NAIP via USGS The National Map; Esri World Imagery as a switch |
| Address search | US Census Geocoder, Photon (OpenStreetMap) suggestions |
| Tree and roof heights for shade | USGS 3DEP lidar point clouds (AWS `usgs-lidar-public`) |
| Sun path | SunCalc |
| Bare-earth elevation and slope | USGS 3DEP elevation service |
| Hardiness zone | phzmapi.org (USDA 2023 map) |
| Wind | Iowa Environmental Mesonet wind roses from nearby airport stations |
| Soil | USDA NRCS Soil Data Access (SSURGO) |
