const WebSocket = require('ws');
const express = require("express");
const app = express();
const http = require("http");
const https = require("https");
const fs = require("fs");
const yelp = require('yelp-fusion');

// init sqlite db
const dbFile = "./.data/sqlite.db";
const exists = fs.existsSync(dbFile);
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database(dbFile);

db.run("CREATE TABLE IF NOT EXISTS autocomplete(" +
  "id text PRIMARY KEY," +
  "json text NOT NULL" +
  ")");
db.run("CREATE TABLE IF NOT EXISTS search(" +
  "id text PRIMARY KEY," +
  "json text NOT NULL" +
  ")");

// make all the files in 'public' available
app.use(express.static("public"));

// Route using directory names without extensions
app.get("/", (request, response) => {
  response.sendFile(__dirname + "/public/index.html");
});
app.get("/client", (request, response) => {
  response.sendFile(__dirname + "/public/client.html");
});

const server = http.createServer(app);

const wss = new WebSocket.Server({
  server
});

/* Yelp Fusion API
 */
let apiKeyDataPath = "api_key.json"
let apiKey;
let yelpClient;
const yelpHttpOptions = {
  method: "GET",
  headers: {
    "Authorization": "",
  }
};

// Load API key from file
fs.readFile(apiKeyDataPath, "utf8", function(err, data) {
  if (err) throw err;
  let apiKeyData = JSON.parse(data);
  apiKey = apiKeyData.API_KEY;
  yelpClient = yelp.client(apiKey);
  yelpHttpOptions.headers["Authorization"] = "Bearer " + apiKey;
});

/* rooms and user */
roomData = {};
userData = {};
roomDataIdNext = 0;
userDataIdNext = 0;

function heartbeat() {
  this.isAlive = true;
}

const timeoutInterval = 5000;

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', heartbeat);
  // setup user or session
  ws.userId = userDataIdNext;
  userDataIdNext++;
  userData[ws.userId] = {
    "userId": ws.userId,
    "roomId": null
  };
  console.log("User connected userId=" + ws.userId);
  // handle messages
  ws.on('message', (message) => {
    handleWebsocketMessage(ws, message);
  });
  // handle close
  ws.on('close', () => {
    console.log("Websocket client closed! userId=" + ws.userId);
    if (userData[ws.userId]) {
      leaveRoomCurrent(ws.userId);
      // remove disconnected user
      delete userData[ws.userId];
    }
  });
});

function handleWebsocketMessage(ws, message) {
  let msgObj = JSON.parse(message);
  if (msgObj.type == "new_room") {
    socketNewRoom(ws, msgObj);
  } else if (msgObj.type == "join_room") {
    socketJoinRoom(ws, msgObj);
  } else if (msgObj.type == "autocomplete") {
    let yelpRequest = {
      "text": msgObj.msg
    };
    yelpAutocomplete(yelpRequest, (responseJSON) => {
      yelpAutocompleteCallback(ws, yelpRequest, responseJSON);
    });
  } else if (msgObj.type == "search") {
    let yelpRequest = {
      "term": msgObj.keyword,
      "location": msgObj.location,
    };
    yelpSearch(yelpRequest, (responseJSON) => {
      yelpSearchCallback(ws, yelpRequest, responseJSON);
    });
  } else if (msgObj.type == "message") {
    broadcast(message);
  } else if (msgObj.type == "select_business") {
    socketSelectBusiness(ws, msgObj);
  } else if (msgObj.type == "deselect_business") {
    socketDeselectBusiness(ws, msgObj);
  } else if (msgObj.type == "start_game") {
    socketStartGame(ws);
  } else if (msgObj.type == "vote_round") {
    voteRound(ws, msgObj);
  }
  // console.log(msgObj);
}

wss.on('close', () => {
  console.log("Websocket server closed!");
});

// socket new room
function socketNewRoom(ws, msgObj) {
  // user leaves current room
  leaveRoomCurrent(ws.userId);
  // new room
  let roomId = newRoom(ws.userId);
  // return message
  ws.send(JSON.stringify({
    "type": "new_room_return",
    "userId": ws.userId,
    "roomId": roomId
  }));
  ws.send(JSON.stringify({
    "type": "server_message",
    "msg": "New Room id: " + roomId
  }));
}

// socket join room
function socketJoinRoom(ws, msgObj) {
  let userId = ws.userId;
  let roomId = msgObj.roomId;
  if (!roomData[roomId]) {
    ws.send(JSON.stringify({
      "type": "join_room_return",
      "error": 1
    }));
    return;
  }
  // user leaves current room
  leaveRoomCurrent(userId);
  // join room
  userData[userId].roomId = roomId;
  roomData[roomId].userList.push(userId);
  // return message
  ws.send(JSON.stringify({
    "type": "join_room_return",
    "userId": userId,
    "roomId": roomId
  }));
}

// socket select business
function socketSelectBusiness(ws, msgObj) {
  let userId = ws.userId;
  let roomId = userData[userId].roomId;
  // verify this is host user
  if (roomId != null && roomData[roomId] && roomData[roomId].hostUserId == userId) {
    let roomObj = roomData[roomId];
    let businessList = roomObj.businessList;
    let businessTable = roomObj.businessTable;
    for (const busId of msgObj.idList) {
      if (!businessList.includes(busId)) {
        businessList.push(busId);
        businessTable[busId] = msgObj.busData[busId];
      }
    }
    // return message
    ws.send(JSON.stringify({
      "type": "business_selected_data",
      "businessSelectList": businessList
    }));
    console.log("----------selected---------");
    console.log(Object.keys(businessTable).length);
    console.log(businessList);
  }
}

// socket deselect business
function socketDeselectBusiness(ws, msgObj) {
  let userId = ws.userId;
  let roomId = userData[userId].roomId;
  // verify this is host user
  if (roomId != null && roomData[roomId] && roomData[roomId].hostUserId == userId) {
    let roomObj = roomData[roomId];
    let businessList = roomObj.businessList;
    let businessTable = roomObj.businessTable;
    for (const busId of msgObj.idList) {
      const index = businessList.indexOf(busId);
      if (index > -1) {
        businessList.splice(index, 1);
        if (businessTable[busId]) {
          delete businessTable[busId];
        }
      }
    }
    // return message
    ws.send(JSON.stringify({
      "type": "business_selected_data",
      "businessSelectList": businessList
    }));
  }
}

// Start game
function socketStartGame(ws) {
  let userId = ws.userId;
  let roomId = userData[userId].roomId;
  // verify this is host user
  if (roomId != null && roomData[roomId] && roomData[roomId].hostUserId == userId) {
    let roomObj = roomData[roomId];
    let businessList = roomObj.businessList;
    let businessTable = roomObj.businessTable;
    // start for everyone in room
    let jsonStr = JSON.stringify({
      "type": "start_game_return"
    })
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && roomObj.userList.includes(client.userId)) {
        client.send(jsonStr);
      }
    });
    // Now set up rounds
    let busNum = businessList.length;
    keyList = [...Array(busNum).keys()];
    shuffle(keyList);
    keyPairList = splitPairs(keyList);
    roomObj.keyPairList = keyPairList;
    console.log("---pair list----");
    console.log(keyPairList);
    socketgiveRound(roomId);
  }
}

function voteRound(ws, msgObj) {
  let userId = ws.userId;
  let roomId = userData[userId].roomId;
  // verify room exists
  if (roomId != null && roomData[roomId]) {
    let roomObj = roomData[roomId];
    let businessList = roomObj.businessList;
    let voteTable = roomObj.voteTable;
    if(voteTable[msgObj.id]){
      voteTable[msgObj.id]++;
    } else {
      voteTable[msgObj.id] = 0;
    }
    console.log("vote: " + msgObj.id);
  }
}

function shuffle(arr) {
  arr.sort(() => Math.random() - 0.5);
}

function splitPairs(arr) {
  var pairs = [];
  let n = arr.length;
  for (var i = 0; i < n; i += 2) {
    if (arr[i + 1] !== undefined) {
      pairs.push([arr[i], arr[i + 1]]);
    } else {
      // randomly pair up odd
      let r = getRandomInt(0, n - 1);
      pairs.push([arr[i], arr[r]]);
    }
  }
  return pairs;
}

/**
 * Returns a random integer between [min, max] (inclusive)
 */
function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function socketgiveRound(roomId) {
  let roomObj = roomData[roomId];
  let businessList = roomObj.businessList;
  let businessTable = roomObj.businessTable;
  roomObj.votedList = [];
  if (roomObj.roundNum >= roomObj.keyPairList.length) {
    // decide winner
    return;
  }
  let pair = roomObj.keyPairList[roomObj.roundNum];
  let idPair = [businessList[pair[0]], businessList[pair[1]]];
  roomObj.roundNum++;
  console.log(idPair);
  // give round
  let jsonStr = JSON.stringify({
    "type": "give_round",
    "round": roomObj.roundNum,
    "idPair": idPair,
    "businessTable": businessTable
  });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && roomObj.userList.includes(client.userId)) {
      client.send(jsonStr);
    }
  });
}


// Leave room
function leaveRoomCurrent(userId) {
  if (userData[userId]) {
    let roomId = userData[userId].roomId;
    if (roomData[roomId]) {
      // remove user from room
      let index = roomData[roomId].userList.indexOf(userId);
      if (index > -1) {
        roomData[roomId].userList.splice(index, 1);
      }
      // remove empty rooms
      if (roomData[roomId].userList.length == 0) {
        delete roomData[roomId];
      }
    }
  }
}

/* Rooms must be initiated with a host
 */
function newRoom(userId) {
  let roomId = roomDataIdNext;
  roomDataIdNext++;
  roomData[roomId] = {
    "hostName": "",
    "roomName": "",
    "roomId": roomId,
    "hostUserId": userId,
    "userList": [userId], // includes host
    "businessList": [],
    "businessTable": {},
    "voteTable": {},
    "votedList": [],
    "roundNum": 0
  };
  userData[userId].roomId = roomId;
  return roomId;
}

// How to detect and close broken connections?
const interval = setInterval(function ping() {
  wss.clients.forEach((client) => {
    if (client.isAlive === false) {
      return ws.terminate();
    }

    client.isAlive = false;
    client.ping(() => {
      //console.log("pong: userId=" + client.userId);
    });
  });
}, timeoutInterval);

function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

/* Yelp Fusion API
 */
function yelpAutocomplete(req, callback) {
  if (req.text.length > 0) {
    // Try cache first
    let sqlStatement = "SELECT * FROM autocomplete " +
      "WHERE id=?";
    db.get(sqlStatement, [JSON.stringify(req)], (err, rows) => {
      if (err) {
        console.log(err);
      } else {
        if (rows) {
          console.log("autocomplete cache used");
          callback(rows.json);
          return;
        }
      }
      // now try the API
      yelpClient.autocomplete(req).then(response => {
        callback(JSON.stringify(response))
      }).catch(e => {
        console.log(e);
      });
    });
  }
}

function yelpAutocompleteCallback(ws, req, responseJSON) {
  /* There is a 5000 API call limit for Yelp Fusion API
   * Autocomplete uses up a lot of calls since it activates
   * on each key press. We must cache the responses.
   */
  let stmt = db.prepare("INSERT OR IGNORE INTO autocomplete (id, json) " +
    "VALUES(json(?),json(?));");
  stmt.run(JSON.stringify(req), responseJSON, (err) => {
    if (err) {
      console.log(err);
    }
  });
  stmt.finalize();
  ws.send(JSON.stringify({
    "type": "autocomplete_return",
    "response": responseJSON
  }));
}

/*
 * Davis: lat=38.543675, long=-121.741432
 * term example: term=thai
 */
function yelpSearch(req, callback) {
  if (req.location.length > 0) {
    // Try cache first
    let sqlStatement = "SELECT * FROM search " +
      "WHERE id=?";
    db.get(sqlStatement, [JSON.stringify(req)], (err, rows) => {
      if (err) {
        console.log(err);
      } else {
        if (rows) {
          console.log("search cache used");
          callback(rows.json);
          return;
        }
      }
      // now try the API
      yelpClient.search(req).then(response => {
        callback(JSON.stringify(response))
      }).catch(e => {
        console.log(e);
      });
    });
  }
}

function yelpSearchCallback(ws, req, responseJSON) {
  /* There is a 5000 API call limit for Yelp Fusion API
   * Autocomplete uses up a lot of calls since it activates
   * on each key press. We must cache the responses.
   */
  let stmt = db.prepare("INSERT OR IGNORE INTO search (id, json) " +
    "VALUES(json(?),json(?));");
  stmt.run(JSON.stringify(req), responseJSON, (err) => {
    if (err) {
      console.log(err);
    }
  });
  stmt.finalize();
  ws.send(JSON.stringify({
    "type": "search_return",
    "response": responseJSON
  }));
}

/* HTTP request function
 * replaced by the yelp fusion API which already
 * handles the http request.
 */
function httpReqFunction(uri, callback) {
  let httpReq = https.request(uri, options);
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
      //console.log(body)
      callback(body);
    });
  });

  httpReq.on("error", (err) => {
    console.log("Error: " + err.message);
  });
}

//start our server
server.listen(process.env.PORT, () => {
  console.log(`Server started on port ${server.address().port} :)`);
});
