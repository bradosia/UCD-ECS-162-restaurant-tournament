# Restaurant Tournament
Team Members: Branden Lee

Built on top of the Glitch Websocket chat app. Helps pick out restaurants to go to with your friends.

## Challenges

I had to secure the API Key and also discovered glitch uses a secure HTTPS connection making websockets not work until I added a fix.
This project was a lot more work than I thought for one person. I thought groups were assigned, but no one grouped up with me. 
This project turned out okay. It does the what is on the specs.

## How to use

It works just as described on the specs for the restaurant tournament option.

1. Host creates a game room and gives the link to friends
2. Then host chooses restaurants using yelp search to find restaurants the friends are deciding on. This is good for situations where everyone has a place in mind, but not sure if everyone else will like it. Typically all members would be able to chat about potential restaurants on an external messaging or voice program such as zoom or in person.
3. After beginning the game, the server creates random pairs of restaurants to vote on. 
Every restaurant will show up at least once. 
4. Winner appears after all restaurants have a chance to be voted on.

## Features

* Multiple room support
* Infinite users in a room
* Mobile UI
* API request caching to reduce API calls
* Supports many more locations than the two in the drop down menu. The locations in drop down menu are for convenience.

## Yelp Fusion API

* https://www.yelp.com/developers/documentation/v3

# Glitch Websocket chat app

An example using Websockets to allow the Server to broadcast messages to a group of clients.

Authors: Mainly Michael Tianchen Sun, with a little messing about by Nina Amenta

