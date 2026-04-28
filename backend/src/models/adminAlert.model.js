import mongoose from 'mongoose';

const adminAlertSchema = new mongoose.Schema({
    // Source system that raised the alert. Always "grafana" for now;
    // kept open so we could later accept alerts from Stripe webhooks etc.
    source: { type: String, default: 'grafana', index: true },

    // Stable identifier for the alert *condition* (not the firing event).
    // Grafana sends a labels-derived fingerprint — we upsert on this so a
    // re-firing alert updates `lastSeenAt` instead of creating duplicates.
    fingerprint: { type: String, required: true, index: true },

    severity: {
        type: String,
        enum: ['critical', 'warning', 'info'],
        default: 'warning',
        index: true,
    },
    status: {
        type: String,
        enum: ['firing', 'resolved', 'acknowledged'],
        default: 'firing',
        index: true,
    },

    title:   { type: String, required: true },
    message: { type: String, default: '' },
    ruleName: { type: String, default: '' },
    valueString: { type: String, default: '' },
    dashboardUrl: { type: String, default: '' },
    panelUrl: { type: String, default: '' },

    raisedAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null },
    acknowledgedAt: { type: Date, default: null },
    acknowledgedByClerkId: { type: String, default: '' },

    // Raw payload for debugging — not for UI rendering
    rawPayload: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

// Listing: most-recent-first by status priority + recency
adminAlertSchema.index({ status: 1, createdAt: -1 });

export const AdminAlert = mongoose.model('AdminAlert', adminAlertSchema);
