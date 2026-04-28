import { AdminAlert } from '../models/adminAlert.model.js';
import { event as logEvent } from '../lib/log.js';

// ── Grafana webhook auth middleware ───────────────────────────────────────────
// Grafana's "Webhook" contact point sends a JSON POST. We protect with a
// shared bearer token (GRAFANA_WEBHOOK_TOKEN) instead of Clerk because
// Grafana cannot acquire a user JWT.
export const verifyGrafanaToken = (req, res, next) => {
    const expected = process.env.GRAFANA_WEBHOOK_TOKEN;
    if (!expected) return res.status(500).json({ message: 'Webhook token not configured' });
    const auth = req.header('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
    if (token !== expected) return res.status(401).json({ message: 'Unauthorized' });
    next();
};

// ── POST /api/admin/alerts/grafana-webhook ────────────────────────────────────
// Grafana payload shape (Unified Alerting v9+): { alerts: [...], status, ... }.
// Each alert has: status, labels, annotations, fingerprint, valueString, ...
// We upsert by fingerprint so a re-firing alert updates lastSeenAt.
export const ingestGrafanaWebhook = async (req, res) => {
    const payload = req.body || {};
    const alerts = Array.isArray(payload.alerts) ? payload.alerts : [];

    if (alerts.length === 0) return res.json({ ingested: 0 });

    const ops = alerts.map((a) => {
        const labels = a.labels || {};
        const annotations = a.annotations || {};
        const fingerprint = a.fingerprint || `${labels.alertname || 'unknown'}:${a.startsAt || Date.now()}`;
        const isResolved = a.status === 'resolved';
        const severity = (labels.severity || 'warning').toLowerCase();

        return {
            updateOne: {
                filter: { fingerprint },
                update: {
                    $set: {
                        source: 'grafana',
                        severity: ['critical', 'warning', 'info'].includes(severity) ? severity : 'warning',
                        status: isResolved ? 'resolved' : 'firing',
                        title: annotations.summary || labels.alertname || 'Alert',
                        message: annotations.description || annotations.summary || '',
                        ruleName: labels.alertname || '',
                        valueString: a.valueString || '',
                        dashboardUrl: a.dashboardURL || '',
                        panelUrl: a.panelURL || '',
                        lastSeenAt: new Date(),
                        ...(isResolved ? { resolvedAt: new Date() } : {}),
                        rawPayload: a,
                    },
                    $setOnInsert: {
                        raisedAt: a.startsAt ? new Date(a.startsAt) : new Date(),
                    },
                },
                upsert: true,
            },
        };
    });

    await AdminAlert.bulkWrite(ops);

    logEvent('admin.alert_ingested', {
        count: alerts.length,
        firing: alerts.filter((a) => a.status !== 'resolved').length,
    });

    res.json({ ingested: alerts.length });
};

// ── GET /api/admin/alerts ─────────────────────────────────────────────────────
export const listAlerts = async (req, res, next) => {
    try {
        const { status, limit = 50 } = req.query;
        const filter = status ? { status } : {};
        const alerts = await AdminAlert.find(filter)
            .sort({ createdAt: -1 })
            .limit(Math.min(parseInt(limit, 10) || 50, 200))
            .lean();
        const counts = await AdminAlert.aggregate([
            { $group: { _id: '$status', n: { $sum: 1 } } },
        ]);
        const summary = counts.reduce((acc, c) => ({ ...acc, [c._id]: c.n }), {});
        res.json({ alerts, summary });
    } catch (e) { next(e); }
};

// ── PATCH /api/admin/alerts/:id/ack ───────────────────────────────────────────
export const acknowledgeAlert = async (req, res, next) => {
    try {
        const clerkId = req.devBypass ? req.devClerkId : req.auth().userId;
        const alert = await AdminAlert.findByIdAndUpdate(
            req.params.id,
            {
                status: 'acknowledged',
                acknowledgedAt: new Date(),
                acknowledgedByClerkId: clerkId,
            },
            { new: true },
        );
        if (!alert) return res.status(404).json({ message: 'Alert not found' });
        res.json({ alert });
    } catch (e) { next(e); }
};
