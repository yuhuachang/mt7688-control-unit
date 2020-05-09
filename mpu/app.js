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
  let buffer = [];
  request.on('error', (e) => {
    console.error(e);
  }).on('data', (chunk) => {
    buffer.push(chunk);
  }).on('end', () => {
    if (request.method === 'GET') {
      response.writeHead(200, {'Content-Type': 'application/json'});
      response.write(JSON.stringify(config));
      response.end();
    } else if (request.method === 'POST') {
      try {
        let body = JSON.parse(Buffer.concat(buffer).toString());

        console.log(body);

        let byteCount = 0;
        if (config.id === 'A') {
          byteCount = 4;
        } else if (config.id === 'B') {
          byteCount = 1;
        } else if (config.id === 'C') {
          byteCount = 3;
        } else {
          throw ("Unit ID is not set in MPU config.");
        }

        let bytes = new Buffer(1 + (byteCount * 2));
        bytes[0] = 0x00;
        if (body.header['state change']) {
          bytes[0] |= 0x20;
        }
        if (body.header['state sync']) {
          bytes[0] |= 0x80;
        }
        bytes[0] |= byteCount;

        for (let i = 1, inx = 0; i <= byteCount; i++) {
          bytes[i] = 0x00;
          bytes[i + byteCount] = 0x00;
          for (let j = 7; j >= 0; j--, inx++) {
            let key = config.id + inx;
            let v = 0x01 << j;
            if (body.switch.hasOwnProperty(key)) {
              if (body.switch[key]) {
                // data
                bytes[i + byteCount] |= v;
              }
            } else {
              // mask
              bytes[i] |= v;
            }
          }
          console.log('' + i + ': mask ' + bytes[i] + ' data ' + bytes[i + byteCount]);
        }
        console.log('sends bytes to MCU = ', bytes);

        serial.write(bytes, (err) => {
          if (err) {
            console.trace(err);
            return;
          }
        });

        response.writeHead(200);
        response.end();
      } catch (e) {
        console.trace(e);
        response.writeHead(500, {'Content-Type': 'text/plain'});
        response.write('500 Internal Error');
        response.write(e.message);
        response.end();
      }
    } else if (request.method === 'OPTIONS') {
      response.setHeader("Access-Control-Allow-Origin", "*");
      response.setHeader("Access-Control-Allow-Methods", "GET, PUT");
      response.setHeader("Access-Control-Allow-Headers", "Content-Type");
      response.writeHead(200);
      response.end();
    } else {
      response.writeHead(405, {'Content-Type': 'text/plain'});
      response.write('405 Method Not Allowed\n');
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

  let b = 0;
  while (b < data.length) {
    let header = data[b];
    b++;
    let isLatchState = header >> 7 & 0x01 === 0x01;
    let isSwitchState = header >> 6 & 0x01 === 0x01;
    let byteCount = header & 0x0F;

    if (isLatchState) {
      console.log("%s Received latch state from MCU", new Date());

      let latch = {};

      let inx = 0;
      for (let i = 0; i < byteCount; i++, b++) {
        for (let j = 0; j < 8; j++, inx++) {
          let v = data[b] >> j & 0x01 === 0x01 ? true : false;
          // console.log("  %s = %s", inx, v);

          latch[config.id + inx] = v;
        }
      }
      console.log(JSON.stringify({
        "latch": latch
      }));

    } else if (isSwitchState) {
      console.log("%s Received swtich state from MCU", new Date());

      let state = {};

      let inx = 0;
      for (let i = 0; i < byteCount; i++, b++) {
        let oldValue = data[b];
        let newValue = data[b + byteCount];
        let diffValue = oldValue ^ newValue;
        // console.log('old = ', b);
        // console.log('new = ', b + byteCount);
        // console.log('oldValue = ', oldValue);
        // console.log('newValue = ', newValue);
        // console.log('diffValue = ', diffValue);
        // console.log('------------------------');

        for (let j = 7; j >= 0; j--, inx++) {
          if (diffValue >> j & 0x01 === 0x01) {
            let v = newValue >> j & 0x01 === 0x01 ? true : false;
            // console.log('  S ' + inx + ' = ' + v);

            state[config.id + inx] = v;
          }
        }
      }
      b += byteCount;

      console.log(JSON.stringify({
        "header": {
          "state change": true,
          "state sync": true
        },
        "switch": state
      }));

    } else {
      console.log(new Date() + " Unknown header value");
      break;
    }
  }

  // if (config) {
  //   console.log("%s Update state to server: ", new Date(), data.toString("hex"));
  //   http.request({
  //     method: 'GET',
  //     host: config.webhook.host,
  //     port: config.webhook.port,
  //     path: config.webhook.path + '/' + config.id + '/' + data.toString("hex"),
  //     timeout: 1000
  //   }, response => {
  //     let data = [];
  //     response.on('data', (chunk) => {
  //       data.push(chunk);
  //     });
  //     response.on('end', () => {
  //       console.log("%s Transmit Completed (%s)", new Date(), data.toString());
  //     });
  //   }).on("error", (err) => {
  //     console.log("Error: " + err.message);
  //   }).end();
  // }
});
