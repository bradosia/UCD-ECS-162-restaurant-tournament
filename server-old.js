// server.js
// where your node app starts

// include modules
const express = require("express");
const http = require("http");
const https = require("https");

const multer = require("multer");
const bodyParser = require("body-parser");
const fs = require("fs");
const FormData = require("form-data");

// init sqlite db
const dbFile = "./.data/sqlite.db";
const exists = fs.existsSync(dbFile);
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database(dbFile);

// begin constructing the server pipeline
const app = express();

const options = {
  method: "GET",
  headers: {
    "Authorization": "",
  }
};

let postcardDataPath = "api_key.json"

fs.readFile(postcardDataPath, "utf8", function(err, data) {
  if (err) throw err;
  let apiKeyData = JSON.parse(data);
  apiKey = apiKeyData.API_KEY;
  console.log(apiKey);
  options.headers["Authorization"] = "Bearer " + apiKey;
  httpReqFunction();
});

let httpReqFunction = function() {
  query = "?latitude=38.543675&longitude=-121.741432&term=thai"
  let httpReq = https.request("https://api.yelp.com/v3/businesses/search" + query, options);
  httpReq.setHeader("name", "value");
  httpReq.write("hello, world");
  httpReq.end();

  httpReq.on("response", function(response) {
    console.log("response");

    let body = [];
    response.on("data", (chunk) => {
      body.push(chunk);
    });

    response.on("end", () => {
      body = Buffer.concat(body).toString();
      // at this point, `body` has the entire request body stored in it as a string
      console.log(body)
    });
  });

  httpReq.on("error", (err) => {
    console.log("Error: " + err.message);
  });
}
