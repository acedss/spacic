import 'dotenv/config';
import { S3Client } from "@aws-sdk/client-s3";

const client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
    // SDK v3 adds CRC32 checksum headers by default — disable so browser PUT
    // requests don't include x-amz-checksum-* in the preflight.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
});

// "Đóng gói" lại
const s3Config = {
    client,
    bucket: process.env.S3_BUCKET_NAME,
};

export default s3Config; 