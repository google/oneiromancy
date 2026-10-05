# Oneiromancy — Fantasy Football Draft Assistant

This is not an officially supported Google product. This project is not eligible for the [Google Open Source Software Vulnerability Rewards Program](https://bughunters.google.com/open-source-security).

A mobile-first, high-fidelity fantasy football draft application built with Next.js, featuring real-time Sleeper API synchronization, astrological and elemental divination scoring ("The Oneiromancy Engine"), and containerized deployment.

---

## Quick Reference / Cheatsheet

| Command | Environment | Purpose | What it Does |
| :--- | :--- | :--- | :--- |
| `npm install` | Local / OSS | Setup dependencies | Installs third-party packages into `node_modules/` (run once). |
| `npm run dev` | Local / OSS | **Local Development** | **Automatically clears cache (`rm -rf .next`)** and starts local dev server at `http://localhost:3000`. |
| `npm run dev -- -H 0.0.0.0` | Remote Workstation | Remote Development | Starts dev server bound across network interfaces. |
| `npm run clean` | Local / OSS | Manual Cache Reset | Wipes `.next/`, `out/`, and temporary runtime caches. |
| `npm run build` | Local / OSS | **Production Build** | Cleans cache and compiles static export into the `out/` folder. |
| `npm start` | Local / OSS | **Static Production Server** | Serves the statically exported `out/` directory via zero-dependency `server.js` on port `8080`. |
| `npm test` | All | Automated Test Suite | Executes all 328 master E2E and interactive component tests across 6 tiers. |
| `npm run verify` | All | Launch Prober | Runs automated HTTP/HTML probe against the server to verify status 200 and page title. |
| `npm run lint` | All | Code Linting | Runs ESLint across all TypeScript and React source files. |
| `npm run typecheck` | All | Type Checking | Verifies TypeScript types without emitting build files. |

---

## Local Development Workflow

### 1. Prerequisites & Setup
Ensure you have **Node.js** (v18 or higher) and **npm** installed:
```bash
npm install
```

### 2. Running the Development Server (Zero-Cache Mode)
To launch the interactive application while actively coding:
```bash
npm run dev
```

#### Why Caching is Not an Issue
Next.js by default compiles and caches pages in a hidden `.next/` directory. Stale cache files can occasionally cause edits to not appear immediately.

To eliminate this entirely, **`npm run dev` is pre-configured to automatically wipe the `.next/` build cache before starting** (`rm -rf .next && next dev`). Every time you launch `npm run dev`, you get a fresh, pristine compilation without any stale cached states.

#### Accessing the Application
- **Local machine**: Open your browser to [http://localhost:3000](http://localhost:3000).
- **From a Remote Workstation**:
  - Start the server bound to all interfaces:
    ```bash
    npm run dev -- -H 0.0.0.0
    ```
  - Or forward port 3000 via SSH from your laptop:
    ```bash
    ssh -L 3000:localhost:3000 <your-remote-hostname>
    ```
    Then browse to [http://localhost:3000](http://localhost:3000).

#### Stopping the Server
Press `Ctrl + C` in your terminal to stop the development server.

---

## Production Build & Deployment Guide

When you are ready to prepare the application for deployment (e.g. hosting on Google Cloud, Firebase, or static/container hosts), compile it into an optimized production build.

### 1. Building for Production
Run the build command:
```bash
npm run build
```

This command automatically:
1. Wipes all old build caches and previous outputs (`rm -rf .next out`).
2. Compiles, minifies, and optimizes all React components and Tailwind CSS.
3. Generates a standalone, static distribution package in the **`out/`** directory (via `output: 'export'` in `next.config.mjs`).

### 2. Inspecting the Production Output
The compiled output is located in the `out/` folder:
- `out/index.html` — Main entry point containing pre-rendered markup.
- `out/_next/` — Minified JavaScript chunks, CSS stylesheets, and assets.
- `out/404.html` — Custom 404 error page.

Because it is a pure static export, **the `out/` folder does not require a dynamic SSR server in production**. It can be served directly by `node server.js`, any static web server, CDN, or static host.

### 3. Testing the Production Build Locally
To test how the static production build behaves in a browser before deploying:
```bash
# Option A: Using the included zero-dependency static server
npm start

# Option B: Using Python's built-in web server
python3 -m http.server 3000 -d out

# Option C: Using Node's serve utility
npx serve out -p 3000
```
Then visit [http://localhost:8080](http://localhost:8080) (or port `3000`) to verify.

### 4. Production Deployment Options

#### Option A: Static Hosting (Cloud Storage / Firebase / CDN)
Deploy the contents of the `out/` folder directly to any static hosting provider:
- **Google Cloud Storage Bucket**: Upload `out/*` and enable Website Configuration with Cloud CDN.
- **Firebase Hosting**: Run `firebase deploy --only hosting` pointing `public` to `out`.
- **GitHub Pages / Netlify / Vercel**: Connect the repository and configure the publish directory to `out`.

#### Option B: Containerized Deployment (Cloud Run / Docker)
A production-ready, multi-stage `Dockerfile` is included in the project root:
```bash
# Build Docker container
docker build -t oneiromancy .

# Run container locally on port 8080
docker run -p 8080:8080 oneiromancy
```
The container is lightweight (based on `node:22-alpine`), runs as a non-root user (`UID 1001`), and is directly deployable to **Google Cloud Run**.

---

## Testing & Quality Verification

The project includes an extensive automated test suite covering unit logic, boundary conditions, cross-feature interactions, and interactive UI components:

```bash
# Run the Master E2E and Interactive Component Test Suite (328 tests)
npm test

# Run the automated launch and HTML structure verification
npm run verify

# Run TypeScript type-checker
npm run typecheck

# Run ESLint
npm run lint
```

---

## Official Sleeper API Documentation & Reference

- **Official Documentation**: [https://docs.sleeper.com/](https://docs.sleeper.com/)
- **Base URL**: `https://api.sleeper.app/v1`

### Architecture & Rate Limiting
The Sleeper API is an unauthenticated, read-only HTTP JSON service. Per official documentation on [docs.sleeper.com](https://docs.sleeper.com/), API rate limit guidance recommends staying under **1,000 requests per minute** to prevent IP throttling.

Our client implements:
- Sliding-window request tracking with a 300 req/min ceiling to eliminate artificial throttling during multi-season discovery and background polling.
- Reactive 60-second backoff cooldown triggered exclusively upon receiving genuine HTTP 429 status codes from Sleeper.
- Immediate rate limit reset on manual user actions (e.g. clicking "Apply & Sync" or editing username in settings).

### Implemented Endpoints
- **User Lookup**: `GET /v1/user/<username>` or `GET /v1/user/<user_id>`
  * [https://docs.sleeper.com/#user](https://docs.sleeper.com/#user)
- **User Leagues**: `GET /v1/user/<user_id>/leagues/<sport>/<season>`
  * [https://docs.sleeper.com/#leagues](https://docs.sleeper.com/#leagues)
- **League Drafts**: `GET /v1/league/<league_id>/drafts`
  * [https://docs.sleeper.com/#drafts](https://docs.sleeper.com/#drafts)
- **Draft Details & Picks**: `GET /v1/draft/<draft_id>` & `GET /v1/draft/<draft_id>/picks`
  * [https://docs.sleeper.com/#drafts](https://docs.sleeper.com/#drafts)
- **League Users & Rosters**: `GET /v1/league/<league_id>/users` & `GET /v1/league/<league_id>/rosters`
  * [https://docs.sleeper.com/#users-in-a-league](https://docs.sleeper.com/#users-in-a-league) & [https://docs.sleeper.com/#rosters](https://docs.sleeper.com/#rosters)
- **NFL Players Dictionary**: `GET /v1/players/nfl`
  * [https://docs.sleeper.com/#players](https://docs.sleeper.com/#players)

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our Contributor License Agreement (CLA), community guidelines, and pull request process.

---

## License

Licensed under the [Apache License, Version 2.0](LICENSE).
