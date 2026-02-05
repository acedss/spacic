import s3Config from "../lib/s3.js";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";


export const getPresignedUrl = async (key, expiresIn = 600) => {
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