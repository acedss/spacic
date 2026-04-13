// Controller: Subscriptions — thin handlers, delegates to subscription.service
import * as subscriptionService from '../services/subscription.service.js';

const getClerkId = (req) => req.devBypass ? req.devClerkId : req.auth().userId;

export const getPlans = async (req, res, next) => {
    try {
        const data = await subscriptionService.getActivePlans();
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const subscribe = async (req, res, next) => {
    try {
        const slug = String(req.body?.slug ?? '').trim().toLowerCase();
        const billingCycle = String(req.body?.billingCycle ?? 'monthly').trim().toLowerCase();
        const requestOrigin = req.get('origin') || req.get('referer') || null;
        const result = await subscriptionService.createSubscribeSession(
            getClerkId(req), slug, billingCycle, requestOrigin
        );
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

export const getSubscriptionStatus = async (req, res, next) => {
    try {
        const data = await subscriptionService.getSubscriptionStatus(getClerkId(req));
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const cancelSubscription = async (req, res, next) => {
    try {
        const data = await subscriptionService.cancelSubscription(getClerkId(req));
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const reactivateSubscription = async (req, res, next) => {
    try {
        const data = await subscriptionService.reactivateSubscription(getClerkId(req));
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};
