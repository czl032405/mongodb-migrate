const MongoClient = require("mongodb").MongoClient;
const express = require("express");
const dotenv = require("dotenv");
const { PromisePool } = require("promise-pool-tool");

dotenv.config({ path: "local.env" });
dotenv.config();
const TARGET_URI = process.env.TARGET_URI || "mongodb://localhost:27017";
const TARGET_DATABASE_NAME = process.env.TARGET_DATABASE_NAME || "therapax";

const FROM_URI = process.env.FROM_URI || "mongodb://localhost:27017";
const FROM_DATABASE_NAME = process.env.FROM_DATABASE_NAME || "therapax";

const dump = async function() {
    console.info("CONNECTING FROM DATABASE", FROM_URI);
    let fromClient = await MongoClient.connect(FROM_URI);
    console.info("CONNECTING FROM DATABASE SUCCESS");

    console.info("CONNECTING TO DATABASE", TARGET_URI);
    let targetClient = await MongoClient.connect(TARGET_URI);
    console.info("CONNECTING TO DATABASE SUCCESS");

    let fromDb = fromClient.db(FROM_DATABASE_NAME);
    let targetDb = targetClient.db(TARGET_DATABASE_NAME);
    let collections = await fromDb.collections();
    let limit = process.env.MAX_INSERT || 100;

    let tasks = collections.map(collection => async () => {
        console.info("COLLECTION BEGIN ", collection.collectionName);
        let count = await collection.countDocuments({});
        await targetDb.collection(collection.collectionName).deleteMany({});
        let skip = 0;
        while (skip < count) {
            console.info("COLLECTION PART BEGIN ", collection.collectionName, skip, "/", count);
            let result = await collection
                .find({})
                .skip(skip)
                .limit(limit)
                .toArray();
            skip += limit;

            await targetDb.collection(collection.collectionName).insertMany(result);
            console.info("COLLECTION PART FINISH ", collection.collectionName, skip, "/", count);
        }
        console.info("COLLECTION ALL FINISH");
    });

    let pool = new PromisePool(tasks, { concurrency: 1, maxRetry: 1 });
    let result = await pool.start();

    console.info("ALL FINISH");
};

const app = express();
app.set("port", process.env.PORT || 3000);
app.get("/", async function(req, res) {
    res.send("hello world");
});

app.get("/test", async function(req, res) {
    let result = await dump();
    res.send(result);
});

app.listen(app.get("port"), async function() {
    console.info("Listen on", app.get("port"));
});
