import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
    console.warn("[Stripe] STRIPE_SECRET_KEY not set — wallet features disabled");
}

export const stripe = process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" })
    : null;
