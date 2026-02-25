# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Spacic is a collaborative music listening platform where users join rooms to listen to songs in sync. It is a monorepo with two separate apps:

- `backend/` — Node.js/Express REST API + Socket.IO server (ES modules, port 4000)
- `frontend/` — React 19 + TypeScript SPA (Vite, port 5173)

## Sprint Status & Roadmap

### Completed (Sprint 1)
- **SPC-1:** Unified Auth System — Production-ready authentication (Clerk + MongoDB)
- **SPC-11:** DB Sync & Profile — User profile data synchronization
- **SPC-19:** RBAC Admin Access — Role-based access control for admins

### In Progress (Sprint 2)
- **SPC-76:** S3 Service — Audio delivery and S3 bucket management
- **SPC-13:** Global Playback Sync — Real-time playback state sync across clients (Socket.IO + REST fallback)

### To Do (Sprint 2 & 3)
- **SPC-16:** Interactive Room Chat — Real-time chat in listening rooms
- **SPC-15:** Donors Leaderboard — Visual leaderboard for top donors
- **SPC-14:** Gamified Donation — Interactive donation features for rooms
- **SPC-20:** Wallet & Payments — User balance management and transactions

### Backlog (Sprint 4+)
- **SPC-18:** Friends Activity — Feed showing what friends are listening to
- **SPC-56:** Direct Group Invite — Invite users to rooms
- **SPC-55:** Friend Request System — Send/accept friend connections
- **SPC-57:** Friends Discovery & Search — Find and add users

## Commands

### Backend (`backend/`)
```bash
npm run dev     # Start with nodemon
npm run test    # Run vitest
```

### Frontend (`frontend/`)
```bash
npm run dev     # Start Vite dev server
npm run build   # tsc -b && vite build
npm run lint    # ESLint
npm run preview # Preview production build
```

## Environment Variables

**Backend** (`backend/.env`):
- `PORT` — defaults to 4000
- `MONGODB_URI`
- `CLERK_SECRET_KEY`
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`

**Frontend** (`.env`):
- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_API_URL` — defaults to `http://localhost:4000/api`

## Architecture

### Backend

**Entry point:** `src/index.js` — creates Express app, attaches Socket.IO via `createServer`, connects to MongoDB, mounts routes.

**Route → Middleware → Controller → Service pattern:**
- `src/routes/` — Express routers mounted at `/api/auth`, `/api/admin`, `/api/songs`, `/api/playback`
- `src/middlewares/auth.middleware.js` — `protectRoute` (requires Clerk session) and `requireAdmin` (checks User.role === "ADMIN" in MongoDB)
- `src/controllers/` — thin handlers that call services
- `src/services/` — business logic (playback, S3)

**Two separate in-memory state managers:**
- `src/lib/playback-manager.js` — single global playback state (song, URL, isPlaying, currentTime). Used for global/non-room playback.
- `src/lib/socket-manager.js` — `SocketManager` class managing user sessions, room sessions, and online users as Maps. Tracks per-room playback state and listener sets.

**Audio delivery:** Songs have an `s3Key` stored in MongoDB. On play, the server generates a presigned S3 URL (5 min expiry) via `src/services/s3.services.js`, stores it in the playback state, and broadcasts it to clients via Socket.IO.

**Real-time playback sync (Sprint 1 - SPC-13):** 
- **Primary (Socket.IO):** `src/lib/socket.js` initializes Socket.IO and listens for `playback:play`, `playback:pause`, `playback:resume`, `playback:update-time` events. Broadcasting is real-time and reaches all connected users instantly.
- **Fallback (REST API):** `src/routes/playback.route.js` mounts at `/api/playback` with POST endpoints for `play`, `pause`, `resume`, `update-time`. Used when WebSocket connection drops. Frontend tries Socket.IO first, falls back to REST if disconnected.
- **State management:** `src/lib/playback-manager.js` stores in-memory global playback state (single object, not per-room): `{ currentSongId, presignedUrl, isPlaying, currentTime, updatedAt }`.
- **Flow:** Socket/REST event → `playback.controller.js` → `playback.service.js` (business logic) → `playback.manager.js` (update state) → broadcast via `io.emit('playback:state', newState)` to all clients.
- **S3 URLs:** On play, server generates 5-minute presigned URL via `src/services/s3.services.js`, stores in playback state, broadcasts to clients.

**Mongoose models:**
- `User` — `clerkId`, `role` (USER/ADMIN/CREATOR), `userTier` (FREE/PREMIUM/CREATOR), `balance`
- `Song` — `title`, `artist`, `imageUrl`, `s3Key`, `duration`, `albumId`
- `Room` — `creatorId`, `title`, `capacity`, `playlist` (Song refs), `streamGoal`, `statsId`
- `RoomStats` — linked to Room for stream analytics
- `Profile` — user profile data

**User tiers** (capacity for rooms): FREE=10, PREMIUM=50, CREATOR=unlimited.

### Frontend

**Auth flow:** `AuthProvider` (`src/providers/AuthProvider.tsx`) wraps the app, retrieves a Clerk JWT via `getToken()`, sets it as `Authorization: Bearer <token>` on the axios instance, then calls `checkAdminStatus`. All protected API calls include this header automatically.

**Layout:** `MainLayout` provides the 3-panel shell: `LeftSidebar` | `<Outlet />` | `FriendsActivity`, with `PlaybackControls` as a fixed footer. `AudioPlayer` renders invisibly for audio logic.

**State management:** Zustand stores in `src/stores/`. Currently: `useAuthStore` (isAdmin, checkAdminStatus).

**Routing** (React Router v7):
- `/` — HomePage
- `/rooms/:roomId` — RoomPage
- `/admin` — AdminPage (no layout wrapper)
- `/auth-callback` — post-Clerk-login user creation in MongoDB
- `*` — NotFoundPage

**HTTP client:** `src/lib/axios.ts` exports `axiosInstance` with base URL pointing to the backend. The `AuthProvider` injects the Bearer token on initialization and on userId changes.

**UI stack:** shadcn-style components (Radix UI + CVA + Tailwind CSS v4), Lucide icons, Sonner for toasts.

**Socket.IO client (Sprint 1):** `src/lib/socket.ts` initializes socket connection with reconnection logic and fallback transports (WebSocket → polling).

**Playback store (Sprint 1):** `usePlaybackStore` (Zustand) subscribes to `playback:state` socket events and manages frontend playback UI state.

## Code Patterns & Conventions

### Backend (Senior Developer Pattern)

**Request Lifecycle (6 layers):**
```
User Request
  ↓
routes/ — Match URL to endpoint
  ↓
middlewares/ — Validate & guard (auth, authorization)
  ↓
controllers/ — Orchestrate (extract data, call services)
  ↓
services/ — Business logic (heavy lifting, DB queries)
  ↓
models/ — Data persistence (MongoDB schemas)
  ↓
Response
```

**Key Rules:**
- Controllers: Never exceed 50 lines. Just extract request data and call services.
- Services: Contain all business logic. Reusable from controllers, sockets, cron jobs, CLI.
- Models: Define schemas and basic queries only. Heavy logic goes to services.
- Middleware: Exit early on validation failure. Bad requests die here before reaching controllers.

**Error Handling:** All errors follow format `{ success: false, error: "message", statusCode: code }`.

### Frontend (React + TypeScript)

**Path imports:** Always use `@/` alias for imports from `src/`.

**Component structure:** Functional components with hooks. Keep under 300 lines. Heavy logic → custom hooks.

**State management:** Zustand stores in `src/stores/`. Simple state operations only; complex logic in services.

**Socket events:** Listen via Zustand stores (not directly in components). Subscribe on mount, unsubscribe on unmount.

**REST fallback:** Frontend emits Socket.IO events as primary, catches errors and falls back to REST if WebSocket drops.
