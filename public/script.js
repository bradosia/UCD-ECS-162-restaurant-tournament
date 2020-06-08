// client-side js, loaded by index.html
// run by the browser each time the page is loaded
const url = "ws://" + window.location.host + "/";
const connection = new WebSocket(url);

/* Global variables for keeping track
 * of the session.
 */
let userId = 0;
let roomId = 0;
let businessSelectList = [];
let businessChooseList = [];
// business Id => business data
let businessTable = {}

/* Display the host User Interface or
 * the friend user interface depending on url address.
 */
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('id')) {
  const windowRoomId = urlParams.get('id');
  let friendStartUiNode = document.getElementById("friendStartUI");
  friendStartUiNode.style.display = "block";
  connection.onopen = () => {
    console.log("Connected to server!");
    joinRoom(windowRoomId);
  }
} else {
  let startUiNode = document.getElementById("startUI");
  startUiNode.style.display = "block";
}

/* Connection handling
 */
connection.onerror = error => {
  console.log(`WebSocket error: ${error}`);
};

connection.onmessage = (event) => {
  let msgObj = JSON.parse(event.data);
  if (msgObj.type == "message") {
    console.log("CLIENT: #" + msgObj.from + ": " + msgObj.msg);
  } else if (msgObj.type == "server_message") {
    console.log("SERVER: " + msgObj.msg);
  } else if (msgObj.type == "user_data") {
    userId = msgObj.userId;
    console.log("userId=" + userId)
  } else if (msgObj.type == "room_data") {
    roomId = msgObj.roomId;
    console.log("roomId=" + roomId)
  } else if (msgObj.type == "business_selected_data") {
    businessSelectList = msgObj.businessSelectList;
    console.log(businessSelectList)
  } else if (msgObj.type == "new_room_return") {
    userId = msgObj.userId;
    roomId = msgObj.roomId;
    showPopup();
    newRoomReturn();
  } else if (msgObj.type == "join_room_return") {
    joinRoomReturn(msgObj);
  } else if (msgObj.type == "autocomplete_return") {
    autocompleteReturn(msgObj);
  } else if (msgObj.type == "search_return") {
    searchReturn(msgObj);
  } else if (msgObj.type == "start_game_return") {
    startGameReturn();
  } else if (msgObj.type == "give_round") {
    giveRound(msgObj);
  } else {
    console.log("WARNING: Unkown type: type=" + msgObj.type);
    console.log(msgObj);
  }
};

// game buttons
document.getElementById('startGame').addEventListener('click', newRoom);
document.getElementById('locationInput').addEventListener('keyup', (event) => {
  if (event.keyCode === 13) {
    searchBusinesses();
  }
});
document.getElementById('keywordInput').addEventListener('keyup', (event) => {
  if (event.keyCode === 13) {
    searchBusinesses();
  }
});
document.getElementById('searchButton').addEventListener('click', searchBusinesses);
document.getElementById('beginGameButton').addEventListener('click', startGame);

function newRoom() {
  if (connection) {
    connection.send(JSON.stringify({
      "type": "new_room"
    }));
  }
}

function newRoomReturn() {
  let startUiNode = document.getElementById("startUI");
  let setupUINode = document.getElementById("setupUI");
  startUiNode.style.display = "none";
  setupUINode.style.display = "block";
}

function joinRoom(roomId) {
  if (connection) {
    connection.send(JSON.stringify({
      "type": "join_room",
      "roomId": roomId
    }));
  }
}

function joinRoomReturn(responseObj) {
  if (responseObj.error) {
    let messageNode = document.getElementById("friendWaitingMessage");
    if (responseObj.error == 1) {
      messageNode.innerHTML = "There was a problem joining the room!";
    }
    return;
  }
  userId = msgObj.userId;
  roomId = msgObj.roomId;
}

function selectBusiness(node) {
  if (connection) {
    let id = node.dataset.id;
    if (businessSelectList.includes(id)) {
      // user wants to deselect
      node.className = "";
      connection.send(JSON.stringify({
        "type": "deselect_business",
        "idList": [id]
      }));
    } else {
      // user wants to select
      node.className = "active";
      connection.send(JSON.stringify({
        "type": "select_business",
        "idList": [id],
        "busData": businessTable
      }));
    }
  }
}

function startGame() {
  if (connection) {
    connection.send(JSON.stringify({
      "type": "start_game"
    }));
  }
}

function startGameReturn() {
  businessSelectList = [];
  let friendStartUiNode = document.getElementById("friendStartUI");
  let setupUINode = document.getElementById("setupUI");
  let playUINode = document.getElementById("playUI");
  friendStartUiNode.style.display = "none";
  setupUINode.style.display = "none";
  playUINode.style.display = "block";
}

function giveRound(responseObj) {
  let containerNode = document.getElementById("restaurantContainer");
  let headerNode = document.getElementById("roundHeader");
  headerNode.innerHTML = "Round #" + responseObj.round;
  // terms
  let busIdList = responseObj.idPair;
  businessTable = responseObj.businessTable;
  htmlArray = [];
  for (const busId of busIdList) {
    busObj = businessTable[busId];
    htmlArray.push(restaurantTile({
      "image_url": busObj.image_url,
      "name": busObj.name,
      "price": busObj.price,
      "rating": busObj.rating,
      "address": busObj.location.display_address.join("<br />"),
      "id": busObj.id
    }));
  }
  containerNode.innerHTML = htmlArray.join("");
  let buttonNodeList = containerNode.querySelectorAll('button');
  for (const buttonNode of buttonNodeList) {
    buttonNode.addEventListener("click", () => {
      voteRound(buttonNode);
    })
  }
}

function voteRound(node) {
  let containerNode = document.getElementById("restaurantContainer");
  containerNode.innerHTML = "waiting for next round...";
  if (connection) {
    let id = node.dataset.id;
    connection.send(JSON.stringify({
      "type": "vote_round",
      "id": id
    }));
  }
}

// show popup
function showPopup() {
  let popup = document.querySelector('#popup');
  let popupLinkEle = document.querySelector('#popup p');
  let popupShade = document.querySelector('#popup_shade');

  let uriAbsolute = window.location.protocol + "//" +
    window.location.host + "/?id=" +
    roomId;
  popup.style.display = "flex";
  popupShade.style.display = "block";
  popupLinkEle.href = uriAbsolute;
  popupLinkEle.textContent = uriAbsolute;
}

// hide popup
document.querySelector('#popup').addEventListener('click', (e) => {
  let popup = document.querySelector('#popup');
  let popupShade = document.querySelector('#popup_shade');
  popup.style.display = "none";
  popupShade.style.display = "none";
});

// stop clicking popup from closing popup
document.querySelector('#popup div').addEventListener('click', (e) => {
  e.stopPropagation();
});

/* Input
 */
document.querySelector('#keywordInput').addEventListener('input', function(evt) {
  let keywordInputNode = document.getElementById("keywordInput");
  connection.send(JSON.stringify({
    "type": "autocomplete",
    "msg": keywordInputNode.value
  }));
});

function searchBusinesses() {
  let locationInputNode = document.getElementById("locationInput");
  let keywordInputNode = document.getElementById("keywordInput");
  connection.send(JSON.stringify({
    "type": "search",
    "location": locationInputNode.value,
    "keyword": keywordInputNode.value
  }));
}

function autocompleteReturn(msgObj) {
  let responseObj = JSON.parse(msgObj.response);
  console.log(responseObj);
  if (responseObj.jsonBody.terms) {
    let keywordListNode = document.getElementById("keywordList");
    keywordListNode.innerHTML = "";
    // terms
    let termArray = responseObj.jsonBody.terms;
    for (const iterateObj of termArray) {
      let optionNode = document.createElement("option");
      optionNode.value = iterateObj.text;
      keywordListNode.appendChild(optionNode);
    }
  }
}

function searchReturn(msgObj) {
  let responseObj = JSON.parse(msgObj.response);
  if (responseObj.jsonBody.businesses) {
    let containerNode = document.getElementById("restaurantSearchContainer");
    // terms
    let businessArray = responseObj.jsonBody.businesses;
    htmlArray = [];
    for (const iterateObj of businessArray) {
      businessTable[iterateObj.id] = iterateObj;
      htmlArray.push(restaurantTile({
        "image_url": iterateObj.image_url,
        "name": iterateObj.name,
        "price": iterateObj.price,
        "rating": iterateObj.rating,
        "address": iterateObj.location.display_address.join("<br />"),
        "id": iterateObj.id
      }));
    }
    containerNode.innerHTML = htmlArray.join("");
    let buttonNodeList = containerNode.querySelectorAll('button');
    for (const buttonNode of buttonNodeList) {
      buttonNode.addEventListener("click", () => {
        selectBusiness(buttonNode);
      })
    }
  }
}

function restaurantTile(tileObj) {
  let activeStr = "";
  if (businessSelectList.includes(tileObj.id)) {
    activeStr = ' class="active"';
  }
  return `<div class="restaurantTile">
  <img src="` + tileObj.image_url + `">
  <div class="content">
  <h1>` + tileObj.name + `</h1>
  <p class="price">` + tileObj.price + `</p>
  <p class="rating">Rating: ` + tileObj.rating + ` / 5</p>
  <p class="address">` + tileObj.address + `</p>
  <div class="save">
  <button data-id="` + tileObj.id + `"` + activeStr + `></button>
  </div>
  </div>
</div>`;
}

/*
const buttons = document.querySelectorAll("#select .button")
for (const button of buttons) {
  button.addEventListener('click', function(event) {
    //...
  })
}
*/
