import axios from 'axios';

const normalizeApiBaseUrl = (raw?: string) => {
    if (!raw || raw.trim() === '') return '/api';
    const trimmed = raw.trim().replace(/\/+$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

const baseURL = normalizeApiBaseUrl(import.meta.env.VITE_API_URL);

export const axiosInstance = axios.create({
    baseURL,
    // 20 s request timeout — prevents hung requests from blocking the UI indefinitely.
    timeout: 20_000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Global response error logging.
// Centralises visibility for auth failures, rate-limiting, and server errors
// without hijacking control flow — individual call sites still handle their own errors.
axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        if (status === 401) {
            // Clerk refreshes tokens automatically; a 401 here means the session
            // has fully expired. The next user action will re-trigger authentication.
            console.warn('[API] 401 Unauthorized — session may have expired');
        } else if (status === 429) {
            console.warn('[API] 429 Too Many Requests — rate limit hit');
        } else if (status >= 500) {
            console.error('[API] Server error', status, error.config?.url);
        }
        return Promise.reject(error);
    },
);
