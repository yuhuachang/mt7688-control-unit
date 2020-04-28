////////////////////////////////////////////////////////////////////////////////
//
// To enable ECMAScript 2015 features, use the following command to run:
//   node --harmony app.js
//
// Author: Yu-Hua Chang
//
////////////////////////////////////////////////////////////////////////////////
"use strict";
process.title = 'node-app';

// Import libraries
const http = require('http');
const SerialPort = require("serialport").SerialPort;
const fs = require('fs');

// Static configuration
const HTTP_PORT = 8080;
const CONFIG_FILE = "/root/config.json";

// Load config
let config;
console.log('Load Config...');
try {
  const rawData = fs.readFileSync(CONFIG_FILE);
  config = JSON.parse(rawData);
} catch(e) {
  console.error(e);
  process.exit(1);
}

// Http server
const server = http.createServer((request, response) => {
  request.on('error', (e) => {
    console.error(e);
  }).on('data', (chunk) => {
    // request body is not used.
  }).on('end', () => {
    try {
      const code = request.url.substring(1);
      console.log("%s Receive request %s", new Date(), code);
      let buffer = undefined;
      if (code.length >= 2) {
        const buffer = new Buffer(code, "hex");
        console.log("%s Write to serial", new Date(), buffer);
        serial.write(buffer, (err) => {
          if (err) {
            console.trace(err);
            return;
          }
        });
      }
      response.writeHead(200, {'Content-Type': 'application/json'});
      response.write(code + "\n");
      if (buffer) {
        response.write(buffer.toString('hex') + "\n");
      }
      response.write(JSON.stringify(config));
      response.end();
    } catch (e) {
      console.trace(e);

      response.writeHead(500, {'Content-Type': 'text/plain'});
      response.write('500 Internal Error');
      response.write(e.message);
      response.end();
    }
  });
});

// Serial port to MCU
const serial = new SerialPort("/dev/ttyS0", { baudrate: 57600 });

serial.on('open', (err) => {
  if (err) {
    console.log('serial port opened has error:', err);
    process.exit(1);
  }
  console.log('serial port opened.');

  // Start http server after serial is opened correctly.
  server.listen(HTTP_PORT, () => {
    console.log("%s HTTP Server listening on %s", new Date(), HTTP_PORT);
  });
});

serial.on('error', (e) => {
  console.trace(e);
});

serial.on('data', (data) => {
  console.log("%s Receive data from MCU: ", new Date(), data);
  if (config) {
    console.log("%s Update state to server: ", new Date(), data.toString("hex"));
    http.request({
      method: 'GET',
      host: config.webhook.host,
      port: config.webhook.port,
      path: config.webhook.path + '/' + config.id + '/' + data.toString("hex"),
      timeout: 1000
    }, response => {
      let data = [];
      response.on('data', (chunk) => {
        data.push(chunk);
      });
      response.on('end', () => {
        console.log("%s Transmit Completed (%s)", new Date(), data.toString());
      });
    }).on("error", (err) => {
      console.log("Error: " + err.message);
    }).end();
  }
});
