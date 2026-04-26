// Stable-ID toast helpers — Sonner replaces toasts that share an id.
// Use these for events that can fire repeatedly in a short window
// (socket reconnects, balance updates, sync warnings) so the user
// sees one moving toast instead of a tower of duplicates.
//
// Reach for plain `toast.X()` for one-shot user-initiated feedback
// (form submitted, friend added) — there's no benefit to dedup there.
import { toast } from 'sonner';

type ToastFn = typeof toast.success;

const make = (fn: ToastFn) => (key: string, message: string, opts?: Parameters<ToastFn>[1]) =>
    fn(message, { id: `notify:${key}`, ...opts });

export const notify = {
    success: make(toast.success),
    error:   make(toast.error),
    info:    make(toast.info),
    warning: make(toast.warning),
    /** Force-replace any toast with this key. */
    dismiss: (key: string) => toast.dismiss(`notify:${key}`),
};
