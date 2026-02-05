import 'dotenv/config';
import { S3Client } from "@aws-sdk/client-s3";

const client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// "Đóng gói" lại
const s3Config = {
    client,
    bucket: process.env.S3_BUCKET_NAME,
};

export default s3Config; 