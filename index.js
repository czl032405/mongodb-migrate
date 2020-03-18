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

let runing = false;
const dump = async function() {
    if (runing) {
        return "running";
    }
    runing = true;
    let fromClient = await MongoClient.connect(FROM_URI);
    console.info("CONNECTING FROM DATABASE SUCCESS", FROM_URI);

    let targetClient = await MongoClient.connect(TARGET_URI);
    console.info("CONNECTING TO DATABASE SUCCESS", TARGET_URI);

    let fromDb = fromClient.db(FROM_DATABASE_NAME);
    let targetDb = targetClient.db(TARGET_DATABASE_NAME);
    let collections = await fromDb.collections();
    let limit = +process.env.MAX_INSERT || 100;

    let tasks = collections.map(collection => async () => {
        let count = await collection.countDocuments({});
        await targetDb.collection(collection.collectionName).deleteMany({});
        let skip = 0;
        while (skip < count) {
            console.info(collection.collectionName, `${Math.min(skip + limit, count)}`, "/", count, "");
            let result = await collection
                .find({})
                .skip(skip)
                .limit(limit)
                .toArray();

            await targetDb.collection(collection.collectionName).insertMany(result);
            console.info(collection.collectionName, `${Math.min(skip + limit, count)}`, "/", count, "...Done");
            skip += limit;
        }
    });

    let pool = new PromisePool(tasks, { concurrency: 1, maxRetry: 1 });
    let result = await pool.start();
    console.info("ALL FINISH");
    runing = false;
    return "ALL FINISH";
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

app.get("/test2", async function(req, res) {
    let tasks = [1, 2, 3, 4, 5, 6, 7].map(i => async () => {
        console.info(i);
        return i;
    });
    let pool = new PromisePool(tasks, {
        concurrency: 1,
        maxRetry: 1,
        onProgressRetry(index, retry, error) {
            if (error) {
                console.error(error);
            }
        }
    });
    let result = await pool.start();

    res.send(result);
});

app.listen(app.get("port"), async function() {
    console.info("Listen on", app.get("port"));
});
