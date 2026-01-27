# Spacic Frontend

This is the frontend repository for **Spacic**, a music streaming application. It is a single-page application built with React, Vite, and Tailwind CSS.

## Tech Stack

*   **Framework:** [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
*   **Language:** TypeScript
*   **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) + [Shadcn UI](https://ui.shadcn.com/) (components in `src/components/ui`)
*   **Authentication:** [Clerk](https://clerk.com/) (`@clerk/clerk-react`)
*   **Routing:** React Router v7
*   **Icons:** Lucide React
*   **HTTP Client:** Axios
*   **Utilities:** `clsx`, `tailwind-merge`

## Directory Structure

*   `src/`
    *   `App.tsx`: Main route definitions (currently heavily commented out for debugging/initial setup).
    *   `main.tsx`: Entry point, wraps App with `ClerkProvider`.
    *   `layout/`: Contains `MainLayout.tsx` which defines the application shell (Sidebar, Friends Activity, Playback Controls).
    *   `pages/`: Feature-specific pages (`home`, `admin`, `album`, `auth-callback`).
    *   `components/`:
        *   `ui/`: Generic reusable components (Button, Resizable, etc.).
        *   `TopBar.tsx`, `skeleton/`: Specific app components.
    *   `lib/`:
        *   `axios.ts`: Configured Axios instance (Base URL: `VITE_API_URL` or `localhost:4000`).
        *   `utils.ts`: Helper functions (likely class name merger).
    *   `stores/`: (Currently empty) Intended for state management.
    *   `providers/`: (Currently empty) Intended for React Context providers.

## Getting Started

### Prerequisites

*   Node.js (LTS recommended)
*   NPM

### Environment Variables

Create a `.env` file in the root directory. You will likely need:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_API_URL=http://localhost:4000/api
```

*(Note: Check `.env.example` if available or ask a team member for specific keys)*

### Scripts

*   `npm run dev`: Start the development server.
*   `npm run build`: Build for production.
*   `npm run lint`: Run ESLint.
*   `npm run preview`: Preview the production build.

## Development Notes

*   **Path Alias:** Use `@/` to import from `src/`.
    *   Example: `import { Button } from "@/components/ui/button"`
*   **Layout:** The `MainLayout` uses `react-resizable-panels` to manage the sidebar and main content areas.
*   **Comments:** The codebase currently contains comments in Vietnamese explaining some logic (e.g., in `MainLayout.tsx`).
*   **Current State:** `App.tsx` is currently modifying the routing to only show `SignInOAuthButtons` for testing/auth setup. The full routing logic is commented out.

## Key Files

*   `src/lib/axios.ts`: Handles API connection settings.
*   `src/layout/MainLayout.tsx`: The core UI structure including the player and sidebars.
*   `src/main.tsx`: Sets up the Clerk auth provider.
