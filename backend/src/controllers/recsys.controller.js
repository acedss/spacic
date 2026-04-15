// In Docker: RECSYS_URL=http://spacic-recsys:8000 (container name on web_gateway network)
// In dev:    RECSYS_URL=http://localhost:8000
const RECSYS_URL = process.env.RECSYS_URL ?? 'http://localhost:8000';
const INTERNAL_KEY = process.env.RECSYS_INTERNAL_API_KEY ?? 'spacic-recsys-internal-2026';

const internalHeaders = {
    'Content-Type': 'application/json',
    'x-internal-key': INTERNAL_KEY,
};

export const getRecSysStatus = async (req, res, next) => {
    try {
        const response = await fetch(`${RECSYS_URL}/admin/status`, {
            headers: internalHeaders,
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) return res.status(502).json({ message: 'RecSys service returned an error' });
        const data = await response.json();
        res.json({ data });
    } catch (err) {
        if (err.name === 'TimeoutError' || err.code === 'ECONNREFUSED') {
            return res.status(503).json({ message: 'RecSys service is offline', offline: true });
        }
        next(err);
    }
};

export const triggerTraining = async (req, res, next) => {
    try {
        const response = await fetch(`${RECSYS_URL}/admin/train`, {
            method: 'POST',
            headers: internalHeaders,
            body: JSON.stringify({ force: req.body?.force ?? false }),
            signal: AbortSignal.timeout(5000),
        });
        if (response.status === 409) return res.status(409).json({ message: 'Training already in progress' });
        if (!response.ok) return res.status(502).json({ message: 'RecSys service returned an error' });
        const data = await response.json();
        res.json({ data });
    } catch (err) {
        if (err.name === 'TimeoutError' || err.code === 'ECONNREFUSED') {
            return res.status(503).json({ message: 'RecSys service is offline', offline: true });
        }
        next(err);
    }
};

export const getUserRecs = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const response = await fetch(`${RECSYS_URL}/recs/${userId}?limit=${limit}`, {
            headers: internalHeaders,
            signal: AbortSignal.timeout(3000),
        });
        if (!response.ok) return res.status(502).json({ message: 'RecSys service error' });
        const data = await response.json();
        res.json({ data });
    } catch (err) {
        if (err.name === 'TimeoutError' || err.code === 'ECONNREFUSED') {
            return res.status(503).json({ message: 'RecSys service offline', songIds: [] });
        }
        next(err);
    }
};
