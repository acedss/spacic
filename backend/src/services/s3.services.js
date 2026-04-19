import s3Config from "../lib/s3.js";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";


export const getPresignedUrl = async (key, expiresIn = 10000) => {
    try {
        const command = new GetObjectCommand({
            Bucket: s3Config.bucket,
            Key: key,
        });
        return await getSignedUrl(s3Config.client, command, { expiresIn: expiresIn });
    } catch (error) {
        throw error;
    }
};

// Presigned PUT URL — client uploads directly to S3 (no server proxy).
// expiresIn: 5 min default (short window: URL is single-use effectively).
export const getPutPresignedUrl = async (key, mimeType = 'audio/webm', expiresIn = 300) => {
    const command = new PutObjectCommand({
        Bucket: s3Config.bucket,
        Key: key,
        ContentType: mimeType,
    });
    return getSignedUrl(s3Config.client, command, { expiresIn });
};

export const deleteS3Object = async (key) => {
    const command = new DeleteObjectCommand({ Bucket: s3Config.bucket, Key: key });
    return s3Config.client.send(command);
};