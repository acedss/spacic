const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb')

const dotenv = require('dotenv');
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const uri = process.env.MONGODB_URI;

app.use(express.json());

const client = new MongoClient(uri, {
    serverApi: {
        strict: true,
        version: ServerApiVersion.v1,
        deprecationErrors: true,
    }
});
async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        await client.close();
    }
}
run().catch(console.dir);




