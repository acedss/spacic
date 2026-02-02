// test-s3.js
import 'dotenv/config'; // Để load các biến môi trường từ .env
import { getPresignedUrl } from '../src/lib/s3.js';

const test = async () => {
    const key = "songs/Edward Sharpe & The Magnetic Zeros - Home (Official Video).mp3"; // Thay bằng tên file bạn vừa upload lên S3
    console.log("--- Testing S3 Presigned URL ---");

    try {
        const url = await getPresignedUrl(key);
        console.log("Generated URL thành công:");
        console.log(url);
        console.log("\nCopy link trên dán vào trình duyệt để kiểm tra!");
    } catch (err) {
        console.error("Test thất bại:", err.message);
    }
};

test();