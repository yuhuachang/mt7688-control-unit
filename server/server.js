#!/usr/bin/env node
//
// To enable ECMAScript 2015 features, use the following command to run:
//   node --harmony server.js
//
"use strict";
process.title = 'iot-server';

// Import libraries
const webSocketServer = require('websocket').server;
const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Settings
const HTTP_PORT = 8080;
const WEBSOCKET_PORT = 1337;

const connections = [];
let state;

////////////////////////////////////////////////////////////////////////////////
// Get current server ip address.
const interfaces = os.networkInterfaces();
const addresses = [];
for (let k in interfaces) {
  for (let k2 in interfaces[k]) {
    let address = interfaces[k][k2];
    if (address.family === 'IPv4' && !address.internal) {
      addresses.push(address.address);
    }
  }
}
console.log('ip addresses: ', addresses);

////////////////////////////////////////////////////////////////////////////////
// http server to server the static pages
const server = http.createServer((request, response) => {

  // Get request resource name. Default index.html
  let uri = url.parse(request.url).pathname;
  if (uri === '/') {
    uri = '/index.html';
  }
  console.log('uri: ', uri);

  // Settings. (have server settings sent back to the client)
  if (uri === '/settings.js') {
    response.writeHead(200, {'Content-Type': 'text/javascript'});
    let ip = '127.0.0.1';
    if (addresses.length == 1) {
      ip = addresses[0];
    } else {
      for (let i = 0; i < addresses.length; i++) {
        if (addresses[i] != '192.168.100.1') {
          ip = addresses[i];
          break;
        }
      }
    }

    response.write('const ip = "' + ip + '";' + "\n");
    response.write('console.log("ip = " + ip);' + "\n");
    response.end();
    return;
  }

  // Get path name on the server's file system.
  let filename = path.join(process.cwd(), uri);
  console.log('filename: ', filename);

  // Return the request resources.
  fs.exists(filename, (exists) => {
    if(exists) {
      let mimeTypes = {
        "html": "text/html",
        "jpeg": "image/jpeg",
        "jpg": "image/jpeg",
        "png": "image/png",
        "js": "text/javascript",
        "css": "text/css"
      };
      let mimeType = mimeTypes[path.extname(filename).split(".")[1]];
      // console.log('mimeType: ', mimeType);
      response.writeHead(200, mimeType);
      let fileStream = fs.createReadStream(filename);
      // console.log('fileStream: ', fileStream);
      fileStream.pipe(response);
    } else {
      response.writeHead(200, {'Content-Type': 'text/plain'});
      response.write('404 Not Found\n');
      response.end();
    }
  });
});

// Listen http port.
server.listen(HTTP_PORT, () => {
  console.log(new Date() + " HTTP Server listening on %s", HTTP_PORT);
});

////////////////////////////////////////////////////////////////////////////////
// WebSocket server
let wsServer = new webSocketServer({
  httpServer: server
});

wsServer.on('request', (request) => {
  console.log((new Date()) + ' Connection from origin ' + request.origin + '.');
  const connection = request.accept(null, request.origin);
  console.log((new Date()) + ' Connection accepted.');

  // Handle user request
  connection.on('message', (message) => {
    console.log('received: ', message);
    if (message.type === 'utf8') {
      let data = JSON.parse(message.utf8Data);
      state = {
        color: data.color
      };
      publish();
    }
  });

  // Client disconnected
  connection.on('close', (connection) => {
      console.log('client disconnected.');
  });

  connections.push(connection);
});

////////////////////////////////////////////////////////////////////////////////
setInterval(() => {
  state = {
    color: "red"
  };
  publish();
}, 5000);

const publish = () => {
  for (let i = 0; i < connections.length; i++) {
    connections[i].sendUTF(JSON.stringify(state));
  }
};

////////////////////////////////////////////////////////////////////////////////
// Catch Ctrl-C Signal
process.on('SIGINT', () => {
  console.log("Caught interrupt signal");
  process.exit();
});



