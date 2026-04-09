import axios from 'axios';

const normalizeApiBaseUrl = (raw?: string) => {
    if (!raw || raw.trim() === '') return '/api';
    const trimmed = raw.trim().replace(/\/+$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

const baseURL = normalizeApiBaseUrl(import.meta.env.VITE_API_URL);

export const axiosInstance = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json'
    }
});
