# California Crash Heatmap

Interactive geospatial analytics application for exploring California crash-reporting data.

## Purpose
This project visualizes public crash-record data to identify geographic crash-density patterns
across California. It was built to practice public-data ingestion, query validation, geospatial
transformation, aggregation, and map-based reporting.

## Technical Highlights
- Next.js / TypeScript application
- Public-data API integration through CKAN/Socrata-style endpoints
- Validated API query parameters with Zod
- Bounding-box, date, severity, county, and result-limit filters
- GeoJSON transformation for map display
- Binned aggregation for broad zoom levels
- Mapbox heatmap, point overlays, and interactive popups
- Debounced viewport queries and abortable fetch requests

## Relevance
The project demonstrates data validation, discrepancy-resistant query handling, public dataset
analysis, visual reporting, and software-supported analytical workflows.
