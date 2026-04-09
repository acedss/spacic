// Controller: Wallet — thin handlers, delegates to wallet.service
import * as walletService from "../services/wallet.service.js";

const getClerkId = (req) => req.devBypass ? req.devClerkId : req.auth().userId;

export const getPackages = async (req, res, next) => {
    try {
        const data = await walletService.getActivePackages();
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const getWallet = async (req, res, next) => {
    try {
        const cursor = req.query.cursor || null;
        const data = await walletService.getWallet(getClerkId(req), cursor);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const createTopupSession = async (req, res, next) => {
    try {
        const { packageId } = req.body;
        const result = await walletService.createTopupSession(getClerkId(req), packageId);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

// Raw body is passed directly — express.json() must NOT run before this handler
export const handleWebhook = async (req, res, next) => {
    try {
        const signature = req.headers["stripe-signature"];
        const result = await walletService.handleWebhook(req.body, signature);
        res.json(result);
    } catch (error) {
        // Return 400 so Stripe knows the webhook failed and retries
        res.status(400).json({ error: error.message });
    }
};
