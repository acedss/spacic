// Resolves a friendly room title (e.g. "Midnight Standards") to its Mongo _id
// by querying /api/rooms/public. The seed gives rooms stable titles but no
// public roomKey, so we look them up by title at run-time.

const PUBLIC_ROOMS_PATH = '/api/rooms/public';

export interface PublicRoom {
    _id:    string;
    title:  string;
    status: 'live' | 'offline' | 'closed';
}

export const resolveRoomIdByTitle = async (
    backendUrl: string,
    title: string,
    devToken: string,
): Promise<string> => {
    const url = `${backendUrl}${PUBLIC_ROOMS_PATH}?status=live&limit=50`;
    const res = await fetch(url, { headers: { 'x-dev-token': devToken } });
    if (!res.ok) throw new Error(`Failed to list rooms: ${res.status} ${await res.text()}`);

    const body = await res.json();
    const rooms: PublicRoom[] = body?.data?.rooms ?? body?.rooms ?? body?.data ?? [];

    const match = rooms.find(r => r.title.toLowerCase() === title.toLowerCase());
    if (!match) {
        throw new Error(
            `Room titled "${title}" not found among live rooms. ` +
            `Got: ${rooms.map(r => r.title).join(', ')}`,
        );
    }
    return match._id;
};
