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
        const { slug, billingCycle = 'monthly' } = req.body;
        const origin = req.headers.origin || 'http://localhost:5173';
        const result = await subscriptionService.createSubscribeSession(
            getClerkId(req), slug, billingCycle, origin
        );
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};
