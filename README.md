# LeadEngine

LeadEngine is a polished, mobile-first MVP for local home-service teams to capture, qualify, assign, and track leads. It includes a dashboard, lead intake and pipeline, lead detail editing, contractor management, analytics, notification settings, and realistic demonstration data.

## Quick start

Requirements: **Node.js 18 or newer**. There are no third-party runtime dependencies.

```bash
npm start
```

Open [http://localhost:4173](http://localhost:4173). The app stores changes in browser `localStorage`, so sample data can be edited safely during a demo.

## Commands

```bash
npm start     # serve the app locally
npm test      # run server smoke tests
npm run build # create the deployable dist/ directory
```

The output of `npm run build` is a static site that can be deployed to any static host. `server.js` is a minimal zero-dependency development server.

## MVP features

- Responsive dashboard with key performance indicators and recent activity
- Fast lead intake designed for phones
- Searchable/filterable lead pipeline
- Lead status, notes, value, and provider assignment management
- Contractor/provider directory
- Lead source and conversion analytics
- Business profile and notification settings
- Persistent browser storage with realistic Austin-area sample data
