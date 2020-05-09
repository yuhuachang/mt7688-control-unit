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

  // Callback from control unit.
  if (uri.startsWith('/switch')) {
    console.log(new Date() + " Received callback from control unit " + uri);
    let piece = uri.split('/');
    const unit = piece[piece.length - 2];
    const data = Buffer.from(piece[piece.length - 1], "hex");

    let b = 0;
    while (b < data.length) {
      let header = data[b];
      b++;
      let isLatchState = header >> 7 & 0x01 == 0x01;
      let isSwitchState = header >> 6 & 0x01 == 0x01;
      let byteCount = header & 0x0F;

      if (isLatchState) {
        console.log(new Date() + " Receive latch state to update UI");
        if (state === undefined) { state = {}; }
        if (state[unit] === undefined) { state[unit] = {}; }
        state[unit]['latch'] = {};
        let inx = 0;
        for (let i = 0; i < byteCount; i++, b++) {
          for (let j = 0; j < 8; j++, inx++) {
            let v = (data[b + i] >> j & 0x01) === 0x01;
            state[unit]['latch'][inx] = v;
          }
        }
        // console.log(state);
      } else if (isSwitchState) {
        console.log(new Date() + " Receive swtich state to change latch state");
        let inx = 0;
        for (let i = 0; i < byteCount; i++, b++) {
          for (let j = 0; j < 8; j++, inx++) {
            if (data[b + i] >> j & 0x01 === 0x01) {
              changeLatchState(unit, inx);
            }
          }
        }
      } else {
        console.log(new Date() + " Unknown header value");
        break;
      }
    }
    // console.log('done...');

    response.writeHead(200, {'Content-Type': 'text/plain'});
    response.write(unit + "=" + data.toString("hex"));
    response.end();
    return;
  }

  // Callback from control unit.
  if (uri.startsWith('/state')) {
    console.log(new Date() + " Received callback from control unit " + uri);
    let piece = uri.split('/');
    const unit = piece[piece.length - 2];
    const data = Buffer.from(piece[piece.length - 1], "hex");

    // Decode current state and publish to client.
    if (!state) {
      state = {};
    }
    if (!state[unit]) {
      state[unit] = {};
    }

    for (let i = 0; i < data.length; ) {
      let header = data[i];
      let isLatchState = header >> 7 & 0x01 == 0x01;
      let isSwitchState = header >> 6 & 0x01 == 0x01;
      let byteCount = header & 0x0F;

      console.log('byte[' + i + '] header = ', header.toString(16));
      console.log('isLatchState = ', isLatchState);
      console.log('isSwitchState = ', isSwitchState);
      console.log('byteCount = ', byteCount);

      if (state === undefined) { state = {}; }
      if (state[unit] === undefined) { state[unit] = {}; }

      let part;
      if (isLatchState === 1) {
        part = 'latch';
        if (state[unit][part] === undefined) { state[unit][part] = {}; }
        state[unit][part] = {};
      } else if (isSwitchState === 1) {
        part = 'switch';
        if (state[unit][part] === undefined) { state[unit][part] = {}; }
        requestStateSync(unit);
      } else {
        console.error("Unknown header type");
        break;
      }

      let j, inx;
      for (i++, j = 0, inx = 0; j < byteCount && j < data.length; i++, j++) {
        let v = data[i];
        console.log("byte[" + i + "]: ", v.toString(16));
        for (let k = 0; k < 8; k++, inx++) {
          let newValue = v >> k & 0x01 === 0x01 ? true : false;

          if (isSwitchState === 1) {
            let oldValue = state[unit][part]['' + inx];

            // console.log('turn on/off ' + inx);
            // console.log('old = ' + oldValue);
            // console.log('new = ' + newValue);

            if (oldValue != newValue) {
              changeLatchState(unit, inx);
            }
          }

          state[unit][part]['' + inx] = newValue;
        }
      }

      if (isLatchState) {
        publishAll();
      } else if (isSwitchState === 1) {
        // Apply customized rules to control latch...

        // // A
        // let value = new Buffer(3);
        // let t;
        // let j = 0;
        // for (let i = 0; i < 24; i++, t--) {
        //   if (i % 8 == 0) {
        //     t = 7;
        //     if (i > 0) {
        //       j++;
        //     }
        //     value[j] = 0x00;
        //   }
        //   if (state[unit]['switch']['' + i]) {
        //     value[j] |= 0x01 << t;
        //   }
        // }
        // changeLatchState(unit, value.toString('hex'));
      }
    }
    // console.log(state);

    response.writeHead(200, {'Content-Type': 'text/plain'});
    response.write(unit + "=" + data.toString("hex"));
    response.end();
    return;
  }

  // Callback from control unit.
  if (uri.startsWith('/control')) {
    console.log(new Date() + " Received callback from panel unit " + uri);
    let piece = uri.split('/');
    const unit = piece[piece.length - 2];
    const inx = piece[piece.length - 1];

    changeLatchState(unit, inx);

    // if (state && state[unit] && state[unit]['latch']) {

    //   // A
    //   let value = new Buffer(3);
    //   let t;
    //   let j = 0;
    //   for (let i = 0; i < 24; i++, t++) {
    //     if (i % 8 == 0) {
    //       t = 0;
    //       if (i > 0) {
    //         j++;
    //       }
    //       value[j] = 0x00;
    //     }
    //     let currentValue = state[unit]['latch']['' + i];
    //     if (i == inx) {
    //       currentValue = !currentValue;
    //     }
    //     if (currentValue) {
    //       value[j] |= 0x01 << t;
    //     }
    //   }
    //   changeLatchState(unit, value.toString('hex'));
    // }

    response.writeHead(200, {'Content-Type': 'application/json'});
    response.write(JSON.stringify({
      unit: unit,
      inx: inx
    }));
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
      response.writeHead(200, {'Content-Type': 'text/plain'});
      response.write('404 Not Found\n');
      response.end();
    }
  });
});

// Listen http port.
server.listen(HTTP_PORT, () => {
  console.log(new Date() + " HTTP Server listening on " + HTTP_PORT);
  requestStateSync('C');
});

server.on('connection', socket => {

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
  if (unit === 'C') {
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

const changeLatchState = (unit, inx) => {
  console.log(new Date() + ' Change latch state. unit ' + unit + ' inx ' + inx);

  let host;
  let port = 8080;
  let header;
  if (unit === 'C') {
    host = '192.168.50.24';
    header = 'A3'; // A3
  } else {
    console.error('Unknown unit ', unit);
    return;
  }

  if (state === undefined) {
    console.log('no state');
    return;
  }
  if (state[unit] === undefined) {
    console.log('no unit state');
    return;
  }
  if (state[unit]['latch'] === undefined) {
    console.log('no unit latch state');
    return;
  }

  let value = new Buffer(3);
  let t;
  let j = 0;
  for (let i = 0; i < 24; i++, t++) {
    if (i % 8 == 0) {
      t = 0;
      if (i > 0) {
        j++;
      }
      value[j] = 0x00;
    }
    let currentValue = state[unit]['latch']['' + i];
    if (i == inx) {
      currentValue = !currentValue;
    }
    if (currentValue) {
      value[j] |= 0x01 << t;
    }
  }

  console.log(new Date() + " Change latch state to control unit: ", value.toString("hex"));
  http.request({
    method: 'GET',
    host: host,
    port: port,
    path: '/' + header + value.toString("hex"),
    timeout: 1000
  }, response => {
    let data = [];
    response.on('data', (chunk) => {
      data.push(chunk);
    });
    response.on('end', () => {
      console.log(new Date() + " Transmit Completed", data.toString());
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



