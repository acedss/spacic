// broadcastService — API calls for creator broadcast assets.
// Upload flow: requestUploadUrl → PUT blob to S3 → confirmAsset
import { axiosInstance } from '@/lib/axios';
import type { BroadcastAsset, RoomFeatureFlags } from '@/types/types';

// ── Asset CRUD ────────────────────────────────────────────────────────────────

export const listBroadcastAssets = async (): Promise<BroadcastAsset[]> => {
    const { data } = await axiosInstance.get('/broadcast-assets');
    return data.data;
};

interface UploadUrlResponse {
    uploadUrl: string;
    assetId:   string;
    s3Key:     string;
}

export const requestUploadUrl = async (payload: {
    label:    string;
    type:     'recording' | 'file';
    mimeType: string;
}): Promise<UploadUrlResponse> => {
    const { data } = await axiosInstance.post('/broadcast-assets/upload-url', payload);
    return data.data;
};

// Upload the blob directly to S3 via presigned PUT URL (no auth header — S3 rejects it)
export const uploadToS3 = async (uploadUrl: string, blob: Blob, mimeType: string): Promise<void> => {
    const res = await fetch(uploadUrl, {
        method:  'PUT',
        body:    blob,
        headers: { 'Content-Type': mimeType },
    });
    if (!res.ok) throw new Error(`S3 upload failed: ${res.status}`);
};

export const confirmAsset = async (assetId: string, opts?: {
    durationSeconds?: number;
    sizeBytes?:       number;
}): Promise<BroadcastAsset> => {
    const { data } = await axiosInstance.patch(`/broadcast-assets/${assetId}/confirm`, opts ?? {});
    return data.data;
};

export const deleteAsset = async (assetId: string): Promise<void> => {
    await axiosInstance.delete(`/broadcast-assets/${assetId}`);
};

// ── Full upload flow helper ───────────────────────────────────────────────────
// Returns the confirmed asset. durationSeconds must be measured by the caller.

export const uploadBroadcastBlob = async (
    blob:    Blob,
    label:   string,
    type:    'recording' | 'file',
    opts?:   { durationSeconds?: number },
): Promise<BroadcastAsset> => {
    const mimeType = blob.type || 'audio/webm';
    const { uploadUrl, assetId } = await requestUploadUrl({ label, type, mimeType });
    await uploadToS3(uploadUrl, blob, mimeType);
    return confirmAsset(assetId, { durationSeconds: opts?.durationSeconds, sizeBytes: blob.size });
};

// ── Feature flags ─────────────────────────────────────────────────────────────

export const updateFeatureFlags = async (
    flags: Partial<RoomFeatureFlags>,
): Promise<RoomFeatureFlags> => {
    const { data } = await axiosInstance.patch('/rooms/me/feature-flags', flags);
    return data.data;
};
