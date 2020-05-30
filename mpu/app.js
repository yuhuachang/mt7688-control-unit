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

let isProd = false;
process.argv.forEach(argc => {
  if (argc === '--prod') {
    isProd = true;
  }
});

const log = (msg, arg) => {
  if (isProd) return;
  if (arg === undefined) {
    console.log("%s %s", new Date(), msg);
  } else {
    console.log("%s %s", new Date(), msg, arg);
  }
};

// Load config
let config;
log('Load Config...');
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
        log("Received POST request:", buffer.toString());

        let body = JSON.parse(buffer.toString());
        log("body:", body);

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
          for (let j = 0; j < 8; j++, inx++) {
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
          log('' + i + ': mask ' + bytes[i] + ' data ' + bytes[i + byteCount]);
        }
        log('sends bytes to MCU = ', bytes);

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
    log('serial port opened has error:', err);
    process.exit(1);
  }
  log('serial port opened.');

  // Start http server after serial is opened correctly.
  server.listen(HTTP_PORT, () => {
    log("HTTP Server listening on " + HTTP_PORT);
  });
});

serial.on('error', (e) => {
  console.trace(e);
});

serial.on('data', (data) => {
  log("Receive data from MCU:", data);

  let b = 0;
  while (b < data.length) {
    let header = data[b];
    b++;
    let isLatchState = header >> 7 & 0x01 === 0x01;
    let isSwitchState = header >> 6 & 0x01 === 0x01;
    let byteCount = header & 0x0F;

    if (isLatchState) {
      log("Received latch state from MCU");

      let latch = {};

      let inx = 0;
      for (let i = 0; i < byteCount; i++, b++) {
        for (let j = 0; j < 8; j++, inx++) {
          let v = data[b] >> j & 0x01 === 0x01 ? true : false;
          latch[config.id + inx] = v;
        }
      }

      sendToServer('/latch', JSON.stringify({
        "latch": latch
      }));
    } else if (isSwitchState) {
      log("Received swtich state from MCU");

      let state = {};

      let inx = 0;
      for (let i = 0; i < byteCount; i++, b++) {
        let oldValue = data[b];
        let newValue = data[b + byteCount];
        let diffValue = oldValue ^ newValue;

        for (let j = 7; j >= 0; j--, inx++) {
          if (diffValue >> j & 0x01 === 0x01) {
            let v = newValue >> j & 0x01 === 0x01 ? true : false;
            state[config.id + inx] = v;
          }
        }
      }
      b += byteCount;

      sendToServer('/switch', JSON.stringify({
        "header": {
          "state change": true,
          "state sync": true
        },
        "switch": state
      }));
    } else {
      log("Unknown header value");
      break;
    }
  }
});

const sendToServer = (path, body) => {
  log(body);

  const req = http.request({
    method: 'POST',
    host: config.webhook.host,
    port: config.webhook.port,
    path: path,
    timeout: 1000,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': body.length
    }
  }, response => {
    let data = [];
    response.on('data', (chunk) => {
      data.push(chunk);
    });
    response.on('end', () => {
      log("Transmit Completed", data.toString());
    });
  });
  req.on("error", (err) => {
    log("Error: ", err);
  });
  req.write(body);
  req.end();
};
