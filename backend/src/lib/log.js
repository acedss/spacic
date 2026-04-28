// Lightweight structured event logger for Loki ingestion.
//
// Why not pino/winston? Loki indexes by Docker container label only,
// so all we need is a stable single-line prefix that LogQL can `|=` on
// plus a JSON payload for richer drill-downs via `| json`.
//
// Format: `[Event] <name> {"k":"v",...}`
// Examples:
//   log.event("room.created", { roomId, creatorId });
//   log.event("tip.sent", { fromUserId, toCreatorId, amount });

export function event(name, fields = {}) {
    // Single line, greppable by event name, parseable as JSON tail.
    process.stdout.write(`[Event] ${name} ${JSON.stringify(fields)}\n`);
}

export function logError(name, err, fields = {}) {
    process.stderr.write(
        `[Error] ${name} ${JSON.stringify({
            ...fields,
            message: err?.message,
            stack: err?.stack,
        })}\n`
    );
}

export default { event, logError };
