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

  let uri = url.parse(request.url).pathname;
  let data = [];
  request.on('data', (chunk) => {
    data.push(chunk);
  });
  request.on('end', () => {

    // Get request resource name. Default index.html
    if (request.method === 'GET') {
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
      console.log(new Date() + " Filename: " + filename);

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
          response.writeHead(404, {'Content-Type': 'text/plain'});
          response.write('404 Not Found\n');
          response.end();
        }
      });
    } else if (request.method === 'POST') {

      if (uri === '/switch') {
        console.log(new Date() + " Received switch state request: ", data.toString());

        const body = JSON.parse(data);
        console.log('body:', body);

        const requestStateChange = body.header['state change'];
        const requestStateSync = body.header['state sync'];
        const switchState = body.switch;

        console.log('requestStateChange = ' + requestStateChange);
        console.log('requestStateSync = ' + requestStateSync);
        console.log('switchState: ', switchState);

        console.log('applying special logic to control latches...');
        // TODO: apply logic...
        // let state = {
        //   header: {

        //   }
        // };

        // for (let inx = 0; inx < 24; inx++) {
        //   if (switchState.hasOwnProperty('C' + inx)) {

        //   }
        // }
        let payload = JSON.stringify(body);

        const sendToMpu = (ip, payload) => {
          console.log(new Date() + " Send to MPU", data.toString());
          const req = http.request({
            method: 'POST',
            host: ip,
            port: 8080,
            path: '/',
            timeout: 1000,
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': payload.length
            }
          }, response => {
            let buffer = [];
            response.on('data', (chunk) => {
              buffer.push(chunk);
            });
            response.on('end', () => {
              console.log(new Date() + " Transmit Completed (%s)", buffer.toString());
            });
          });
          req.on("error", (err) => {
            console.log("Error: " + err.message);
          });
          req.write(payload);
          req.end();
        };

        sendToMpu('192.168.50.22', payload);
        sendToMpu('192.168.50.127', payload);
        sendToMpu('192.168.50.24', payload);

      } else if (uri === '/latch') {
        console.log(new Date() + " Received latch state from MPU", data.toString());
        let body = JSON.parse(data.toString());
        state = body.latch;
        publishAll();
      } else {
        response.writeHead(404, {'Content-Type': 'text/plain'});
        response.write('404 Not Found\n');
        response.end();
        return;
      }
      response.writeHead(200);
      response.end();
    }
  });
});

// Listen http port.
server.listen(HTTP_PORT, () => {
  console.log(new Date() + " HTTP Server listening on " + HTTP_PORT);
  requestStateSync('A');
  requestStateSync('B');
  requestStateSync('C');
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
      //let data = JSON.parse(message.utf8Data);

      publishAll();
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

  // Update state
  publish(connection);

  // Add client connection to connection list.
  connections.push(connection);
});

// Publising event to all clients
const publishAll = () => {
  for (let i = 0; i < connections.length; i++) {
    publish(connections[i]);
  }
};

// Publising event to one client
const publish = (connection) => {
  if (!connection) return;
  if (!state) return;
  console.log((new Date()) + ' Send to ' + connection.remoteAddress);
  connection.sendUTF(JSON.stringify(state));
};

const requestStateSync = unit => {
  console.log('request state sync. unit ' + unit);

  let host;
  let port = 8080;
  let header;
  if (unit === 'A') {
    host = '192.168.50.22';
    header = '80';
  } else if (unit === 'B') {
      host = '192.168.50.127';
      header = '80';
  } else if (unit === 'C') {
    host = '192.168.50.24';
    header = '80';
  } else {
    console.error('Unknown unit ', unit);
    return;
  }

  console.log(new Date() + " Request sync state: ");
  http.request({
    method: 'GET',
    host: host,
    port: port,
    path: '/' + header,
    timeout: 1000
  }, response => {
    let data = [];
    response.on('data', (chunk) => {
      data.push(chunk);
    });
    response.on('end', () => {
      console.log(new Date() + " Transmit Completed");
    });
  }).on("error", (err) => {
    console.log("Error: " + err.message);
  }).end();
};

////////////////////////////////////////////////////////////////////////////////
// Catch Ctrl-C Signal
process.on('SIGINT', () => {
  console.log("Caught interrupt signal");
  process.exit();
});



