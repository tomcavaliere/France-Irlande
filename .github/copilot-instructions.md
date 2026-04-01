# AI Coding Instructions for Bikepacking Irlande Project

## Overview
This is a Progressive Web App (PWA) for bikepacking EuroVelo 1 in Ireland, from Cork to Sligo. It's a single-page application using Leaflet for maps, displaying stages, progress tracking, and a travel journal.

## Architecture
- **Main file**: `bikepacking-irlande.html` - Contains HTML, CSS, and JavaScript in one file.
- **Data**: `IRELANDE-TRACK.gpx` - GPX track data loaded via JavaScript.
- **Stages**: Defined in `STAGES` array with coordinates, elevation, accommodation options.
- **UI**: Tab-based interface (Map, Stages, Journal, Info) with French language.

## Key Patterns
- **Stage Structure**: Each stage object includes `title`, `km`, `elevation_gain/loss`, `start/end` coords, `points` array, `cum_km`, `accommodation` (paid vs bivouac).
- **Accommodation Types**: `camping`, `hostel`, `bb` (B&B), `bivouac` for wild camping.
- **Map Integration**: Use Leaflet to display GPX tracks, markers for stages, position badge.
- **Progress Tracking**: Update `mapKmD`, `rKmD` etc. based on current position (simulated or GPS).
- **Journal Entries**: Store in localStorage with `date`, `stage`, `text`, `rating`, `tags`.

## Development Workflow
- Edit `bikepacking-irlande.html` for changes.
- Open in browser to test (no build required).
- Use browser dev tools for debugging.
- For PWA features, serve over HTTPS.

## Conventions
- **Language**: French UI text and comments.
- **Units**: Kilometers, meters for elevation.
- **Colors**: CSS variables like `--green`, `--orange`.
- **Icons**: Unicode emojis for tab icons.
- **Data Format**: GPX for tracks, JSON-like for stages.

## Examples
- Adding a stage: Push to `STAGES` array with required fields.
- Updating progress: Modify `updateProgress()` function to calculate based on position.
- Journal: Use `localStorage` to persist entries.

Focus on maintaining French interface, accurate GPX data, and user-friendly PWA experience.