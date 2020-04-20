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
const url = require('url');
const SerialPort = require("serialport").SerialPort;
const fs = require('fs');

// The request/response queue between MPU and MCU.
// queue[i].request are bytes to MCU and queue[i].response are bytes from MCU.
const queue = [];

// Static configuration
const HTTP_PORT = 8080;
const CONFIG_FILE = "/root/config.json";

// Internal state (including dynamic configuration)
const internalStatus = {
  setup: {
    // unit_name: undefined,
    // state_change_webhook: undefined
  },
  state: {
    latch: {},
    switch: {}
  }
}

// Http server
const server = http.createServer((request, response) => {
  const buffer = [];
  request.on('error', (error) => {
    handleHttpError(response, error);
  }).on('data', (chunk) => {
    buffer.push(chunk);
  }).on('end', () => {
    const queryString = request.url;
    const body = Buffer.concat(buffer).toString();
    try {
      if (request.method === 'GET') {
        if (queryString === '/') {
          handleResponse(request, response);
        } else {
          handleNotFound(response);
        }
      } else if (request.method === 'POST') {
        if (queryString === '/') {
          let hasError = false;
          try {
            handleRequest(body);
          } catch (e) {
            console.trace(e);
          }
          if (hasError) {
            handleHttpError(response);
          } else {
            handleResponse(request, response);
          }
        } else {
          handleNotFound(response);
        }
      } else if (request.method === 'OPTIONS') {
        handlePreFlight(request, response);
      } else {
        handleMethodNotAllowed(response);
      }
    } catch (e) {
      console.trace(e);
      response.end();
    }
  });
});

// Serial port to MCU
const serial = new SerialPort("/dev/ttyS0", { baudrate: 57600 });

serial.on('open', (err) => {
  if (err) {
    console.log('serial port opened has error:', err);
    return;
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
  console.log('Receive data from MCU: ', data);
  // console.log('Receive data from MCU: %s %s %s', data[0].toString(16), data[1].toString(16), data[2].toString(16));

  // if (requestQueue.length > 0) {

  //   let result = {};
  //   for (let i = 0; i < 8; i++) {
  //     result['' + i] = data[0] >> (7 - i) & 0x01 == 0x01 ? true : false;
  //   }
  //   for (let i = 0; i < 8; i++) {
  //     result['' + (i + 8)] = data[1] >> (7 - i) & 0x01 == 0x01 ? true : false;
  //   }
  //   for (let i = 0; i < 4; i++) {
  //     result['' + (i + 16)] = data[2] >> (7 - i) & 0x01 == 0x01 ? true : false;
  //   }

  //   console.log(result);
  // }
});

////////////////////////////////////////////////////////////////////////////////

// Load settings from config file.
const loadConfig = () => {
  console.log('Load Config...');
  try {

    // Create config file if it does not exist.
    if (!fs.existsSync(CONFIG_FILE)) {
      saveConfig();
    }

    // Load config file.
    const rawData = fs.readFileSync(CONFIG_FILE);
    const data = JSON.parse(rawData);
    internalStatus.setup = data;

  } catch(err) {
    console.error(err);
    process.exit(1);
  }
};

// Save settings to config file.
const saveConfig = () => {
  console.log('Save Config...');
  try {
    const data = JSON.stringify(internalStatus.setup);
    fs.writeFileSync(CONFIG_FILE, data);
  } catch(err) {
    console.error(err);
    process.exit(1);
  }
};

const handleHttpError = (response) => {
  console.log('Handle Bad Request');

  response.writeHead(400, {'Content-Type': 'text/plain'});
  response.write('400 Bad Request');
  response.end();
};

const handleResponse = (request, response) => {
  // if (Object.keys(internalStatus.setup).length === 0) {
  //   loadConfig();
  // }
  // console.log('Response: ', internalStatus);
  let data = '{}';
  // try {
  //   data = JSON.stringify(internalStatus);
  // } catch (e) {
  //   console.trace(e);
  // }

  // response.setHeader("Access-Control-Allow-Origin", "*");
  response.writeHead(400, {'Content-Type': 'application/json'});
  response.write(data);
  response.end();
};

const handleRequest = (body) => {
  console.log('Raw request: ', body);
  if (body) {
    const req = JSON.parse(body);
    console.log('Request: ', req);
  }


  createChangeLatchStateRequest();
};

const handlePreFlight = (request, response) => {
  console.log('Handle PreFlight');

  // response.setHeader("Connection", "keep-alive");
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  // response.setHeader("Access-Control-Max-Age", "86400");
  response.writeHead(204, {'Content-Type': 'text/plain'});
  response.write('204 No Content');
  response.end();
};

const handleNotFound = (response) => {
  console.log('404 Not Found');

  response.writeHead(404, {'Content-Type': 'text/plain'});
  response.write('404 Not Found');
  response.end();
};

const handleMethodNotAllowed = (response) => {
  console.log('405 Method Not Allowed');

  response.writeHead(405, {'Content-Type': 'text/plain'});
  response.write('405 Method Not Allowed');
  response.end();
};

// Request:
// 1. read latch state request
//    1000 0000
// 2. read switch state request
//    0100 0000
// 3. write latch state request
//    0010 0010 (data bytes is 2) -> 0x22
//    0010 0011 (data bytes is 3) -> 0x23
//    0010 0100 (data bytes is 4) -> 0x24
// Response:
// 1. Latch state
//    1000 0010 ... (data bytes is 2)
// 2. Switch state
//    1000 0010 ... (data bytes is 2)


const createLatchStateRequest = () => {

};

const createSwitchStateRequest = () => {

};

const createChangeLatchStateRequest = (requestState) => {
  const buffer = new Buffer(4);

  // header
  // buffer[0] = 0x80; // read latch state
  // buffer[0] = 0x40; // read switch state
  buffer[0] = 0x24; // write latch state

  // payload
  buffer[1] = 0x11;
  buffer[2] = 0x33;
  buffer[3] = 0x77;
  buffer[4] = 0xFF;

  serial.write(buffer, (err) => {
    if (err) {
      console.trace(err);
      return console.log('Error on write: ', err.message);
    }
  });
};

////////////////////////////////////////////////////////////////////////////////

// get latch state
// set all latch state
// set one latch state
// get switch state
// trigger switch state change
// request swtich state trigger

// configuration:
//   set latch byte count
//   set swtich byte count
//   set swtich state webhook

// request example:

// return example:
// {
//   setup: {
//     unit_name: "test"
//     latch_byte_count: 3
//     switch_byte_count: 3
//     state_change_webhook: "http://..."
//   },
//   state: {
//     latch: {
//       "0": true,
//       "1": true,
//       "2": false,
//       ...
//     }
//     switch: {
//       "0": true,
//       "1": true,
//       "2": false,
//       ...
//     }
//   }
// }

