import { ZodError } from 'zod';

// Validates req.body / req.query / req.params against a Zod schema object.
// Schema shape: z.object({ body?: z.object(...), query?: z.object(...), params?: z.object(...) })
// Replaces req fields with Zod-coerced values so controllers get clean types.
//
// NOTE on req.query: Express 5 exposes `req.query` as a getter-only property,
// so a direct assignment (`req.query = …`) throws "Cannot set property query
// of #<IncomingMessage> which has only a getter". We use Object.defineProperty
// to redefine the property with a writable value descriptor.
export const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse({
        body:   req.body,
        query:  req.query,
        params: req.params,
    });

    if (!result.success) {
        const errors = result.error.issues.map(e => ({
            field:   e.path.slice(1).join('.'),
            message: e.message,
        }));
        return res.status(422).json({ message: 'Validation error', errors });
    }

    if (result.data.body !== undefined) req.body = result.data.body;
    if (result.data.query !== undefined) {
        Object.defineProperty(req, 'query', {
            value: result.data.query, writable: true, configurable: true, enumerable: true,
        });
    }
    if (result.data.params !== undefined) {
        Object.defineProperty(req, 'params', {
            value: result.data.params, writable: true, configurable: true, enumerable: true,
        });
    }

    next();
};

// ZodError type-import retained for downstream callers; safeParse handles failures here.
void ZodError;
