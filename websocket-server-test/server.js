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

const HTTP_PORT = 8080;

// WebSocket client connections
const connections = [];

let state;

////////////////////////////////////////////////////////////////////////////////
// Get current server ip address.
const interfaces = os.networkInterfaces();
const addresses = [];
for (let i in interfaces) {
  for (let j in interfaces[i]) {
    let address = interfaces[i][j];
    if (address.family === 'IPv4' && !address.internal) {
      addresses.push(address.address);
    }
  }
}
console.log('Host IP Address: ', addresses);

////////////////////////////////////////////////////////////////////////////////
// http server to server the static pages
const server = http.createServer((request, response) => {

  // Get request resource name. Default index.html
  let uri = url.parse(request.url).pathname;
  if (uri === '/') {
    uri = '/index.html';
  }

  // Settings. (have server settings sent back to the client)
  if (uri === '/settings.js') {
    let host = request.headers.host;

    response.writeHead(200, {'Content-Type': 'text/javascript'});
    let s = 'const addresses = [ ';
    for (let i = 0; i < addresses.length; i++) {
      s += '"' + addresses[i] + '"';
      if (i < addresses.length - 1) {
        s += ', ';
      }
    }
    s += "];\n";
    response.write(s);
    response.write("const port = " + HTTP_PORT + ";\n");
    response.write("const host = '" + host + "';\n");
    response.write('console.log("addresses = ", addresses);' + "\n");
    response.write('console.log("port = ", port);' + "\n");
    response.write('console.log("host = ", host);' + "\n");
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
      response.writeHead(200, mimeType);
      let fileStream = fs.createReadStream(filename);
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
  connection.on('close', (reasonCode, description) => {
    console.log((new Date()) + ' Peer ' + connection.remoteAddress
        + ' disconnected. reasonCode = ' + reasonCode
        + ' description = ' + description);
    for (let i = connections.length - 1; i >= 0; i--) {
      if (connections[i].remoteAddress === connection.remoteAddress) {
        console.log((new Date()) + ' Remove peer ' + connections[i].remoteAddress + ' from subscription.');
        connections[i].close();
        connections.splice(i, 1);
      }
    }
  });

  // Add client connection to connection list.
  connections.push(connection);
});

// Simulate the server pushing event to clients
setInterval(() => {
  state = {
    color: "red"
  };
  publish();
}, 5000);

// Publising event to all clients
const publish = () => {
  for (let i = 0; i < connections.length; i++) {
    console.log((new Date()) + ' Send to ' + connections[i].remoteAddress);
    connections[i].sendUTF(JSON.stringify(state));
  }
};

////////////////////////////////////////////////////////////////////////////////
// Catch Ctrl-C Signal
process.on('SIGINT', () => {
  console.log("Caught interrupt signal");
  process.exit();
});



