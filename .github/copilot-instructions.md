# Copilot Instructions for Spacic

## Project Overview

**Spacic** is a full-stack music streaming application with:
- **Frontend**: React 19 + TypeScript single-page app built with Vite
- **Backend**: Express.js API with MongoDB, AWS S3 for file storage, real-time capabilities via Socket.IO
- **Authentication**: Clerk for user management across both frontend and backend
- **Real-time Features**: Socket.IO for live updates and communications
- **Webhooks**: Svix integration for event handling

This is a monorepo with independent frontend and backend services that can be developed and deployed separately.

## Development Setup

### Prerequisites
- Node.js (LTS recommended)
- `npm` package manager
- Environment variables configured (see below)

### Running the Project

**Backend:**
```bash
cd backend
npm install
npm run dev  # Starts with Nodemon on port 4000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev  # Starts Vite dev server (typically port 5173)
```

### Building for Production

**Frontend:**
```bash
npm run build   # TypeScript compilation + Vite build → dist/
npm run preview # Preview production build locally
```

**Backend:**
No build step required (uses ES modules with Node directly).

## Code Quality

### Linting

**Frontend:**
```bash
npm run lint              # Run ESLint across all .ts and .tsx files
npm run lint -- src/      # Lint specific directory
npm run lint -- --fix     # Auto-fix issues
```

**Backend:**
No linting configured. Consider adding ESLint if needed.

### Testing

**Backend:**
```bash
npm test  # Runs Vitest
```
Currently only S3 presigned URL generation is tested (`test/test-s3.js`). Add tests as needed using Vitest.

**Frontend:**
No automated test suite currently configured.

## Environment Variables

Both services require environment files:

**Backend** (`.env`):
```
MONGODB_URI=<connection_string>
CLERK_SECRET_KEY=<secret_key>
AWS_REGION=<region>
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
SVIX_WEBHOOK_SECRET=<secret>
PORT=4000
SOCKET_IO_ORIGIN=http://localhost:5173
```

**Frontend** (`.env`):
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_API_URL=http://localhost:4000/api
```

## Architecture & Key Patterns

### Frontend Architecture

- **Entry Point**: `src/main.tsx` wraps the app with `ClerkProvider`
- **Routing**: React Router v7 in `src/App.tsx`
- **Layout**: `MainLayout.tsx` defines the core UI shell (Sidebar, Friends Activity, Playback Controls) using `react-resizable-panels`
- **State Management**: Zustand (stores/ directory, currently minimal)
- **HTTP Client**: Axios configured in `src/lib/axios.ts` with base URL to backend API
- **UI Components**: Custom Shadcn UI components in `src/components/ui/`
- **Path Alias**: Use `@/` to import from `src/` (configured in TypeScript and Vite)

**Key Directories:**
- `src/pages/` - Feature-specific pages (home, admin, album, auth-callback)
- `src/components/` - Reusable components (UI, app-specific)
- `src/stores/` - Zustand stores for global state
- `src/providers/` - React Context providers
- `src/lib/` - Utilities and API configuration

### Backend Architecture

- **Entry Point**: `src/index.js` (ES modules)
- **Routing**: Express routes in `src/routes/`
- **Controllers**: Business logic in `src/controllers/`
- **Models**: MongoDB schemas in `src/models/` (Mongoose)
- **Services**: Reusable logic (S3 operations, Clerk integration) in `src/services/`
- **Middleware**: Express middleware in `src/middlewares/` (Clerk auth)
- **Real-time**: Socket.IO event handlers managed alongside routes

**Key Features:**
- AWS S3 integration with presigned URLs for file uploads/downloads
- Clerk Express middleware for authentication/authorization
- MongoDB + Mongoose for data persistence
- Socket.IO for real-time features
- Svix webhooks for external event handling

## Code Conventions

### Frontend

- **TypeScript**: Strict mode enabled, use proper types for component props
- **Path Imports**: Always use `@/` alias for imports from `src/`
- **Component Structure**: Functional components with hooks; keep components under 300 lines
- **Naming**: 
  - Component files: PascalCase (`Button.tsx`)
  - Hook files: camelCase with `use` prefix (`useFetchUser.ts`)
  - Store files: camelCase (`userStore.ts`)
- **CSS**: Tailwind utility classes; use `clsx` for conditional classes and `tailwind-merge` for overrides
- **Environment Variables**: Prefix with `VITE_` for frontend access

### Backend

- **ES Modules**: All files use ES module syntax (`import`/`export`)
- **Async/Await**: Use async/await over callbacks or promise chains
- **Error Handling**: Return appropriate HTTP status codes; use centralized error middleware
- **Clerk Integration**: Use `@clerk/express` middleware for request context (user data available via `req.auth`)
- **MongoDB**: Use Mongoose schemas for type safety; create indexes for frequently queried fields
- **S3 Operations**: Use presigned URLs for client-side uploads/downloads (prefer `@aws-sdk/s3-request-presigner`)
- **Socket.IO**: Emit events with consistent naming (e.g., `song:playing`, `playlist:updated`)

## Monorepo Structure

```
spacic/
├── frontend/          # React + Vite application
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── eslint.config.js
├── backend/           # Express.js API
│   ├── src/
│   ├── test/
│   ├── package.json
│   └── .env
├── .github/
├── README.md
└── .gitignore
```

Each service has independent `package.json` and dependency management. Install dependencies separately in each directory.

## Common Tasks

### Adding a New API Endpoint

1. Create controller in `backend/src/controllers/`
2. Add route in `backend/src/routes/`
3. If using Clerk auth, add middleware to protect the route
4. Call from frontend using configured Axios instance in `src/lib/axios.ts`

### Adding a New Frontend Page

1. Create component in `src/pages/`
2. Add route to `src/App.tsx`
3. Use `MainLayout` wrapper for consistent UI
4. Fetch data via Axios to backend API

### Handling Real-time Updates

- **Backend**: Emit Socket.IO events after state changes (e.g., after saving to database)
- **Frontend**: Listen for events using `socket.io-client` in useEffect; clean up listeners on unmount

### File Uploads (S3)

1. Backend generates presigned URL and returns to client
2. Client uploads directly to S3 using presigned URL
3. Backend receives webhook or direct notification of upload completion
4. Both parties reference the file by its S3 key

## Important Notes

- **Frontend routing**: Currently configured with mostly commented-out routes for initial auth setup (see `App.tsx`)
- **Vietnamese comments**: Codebase contains some explanatory comments in Vietnamese
- **Path resolution**: Ensure TypeScript and Vite are aligned on path aliases when adding new configs
- **CORS**: Backend must allow frontend origin in CORS config for Socket.IO and API calls
