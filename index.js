const MongoClient = require("mongodb").MongoClient;
const express = require("express");
const dotenv = require("dotenv");
const fs = require("fs");
dotenv.config({ path: "local.env" });
dotenv.config();
const TARGET_URI = process.env.TARGET_URI || "mongodb://localhost:27017";
const TARGET_DATABASE_NAME = process.env.TARGET_DATABASE_NAME || "therapax";

const FROM_URI = process.env.FROM_URI || "mongodb://localhost:27017";
const FROM_DATABASE_NAME = process.env.FROM_DATABASE_NAME || "therapax";

const init = async function() {
    !fs.existsSync("dump") && fs.mkdirSync("dump");
};

const dump = async function() {
    console.info("connecting from", FROM_URI);
    let fromClient = await MongoClient.connect(FROM_URI);
    console.info("connecting from success");
    console.info("connecting to", TARGET_URI);
    let targetClient = await MongoClient.connect(TARGET_URI);
    console.info("connecting to success");
    let fromDb = fromClient.db(FROM_DATABASE_NAME);
    let targetDb = targetClient.db(TARGET_DATABASE_NAME);
    let collections = await fromDb.collections();
    let limit = 2000;
    await Promise.all(
        collections.map(async collection => {
            console.info("begin ", collection.collectionName);
            let count = await collection.countDocuments({});
            await targetDb.collection(collection.collectionName).deleteMany({});
            let skip = 0;
            while (skip < count) {
                console.info("begin ", collection.collectionName, skip, "/", count);
                let result = await collection
                    .find({})
                    .skip(skip)
                    .limit(limit)
                    .toArray();
                skip += limit;

                await targetDb.collection(collection.collectionName).insertMany(result);
                console.info("finish ", collection.collectionName, skip, "/", count);
            }
        })
    );

    console.info("all finish");
};

init();
const app = express();
app.set("port", process.env.PORT || 3000);
app.get("/", async function(req, res) {
    res.send("hello world");
});

app.get("/test", async function(req, res) {
    let result = await dump();
    res.send(result);
});

app.listen(app.get("PORT"), async function() {
    console.info("Listen on", app.get("PORT"));
});
