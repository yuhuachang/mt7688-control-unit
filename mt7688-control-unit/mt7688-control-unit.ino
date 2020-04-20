// Wiring:
//               --u--
//          0 <- |   | <- 5V
//               | C | -> 1
//  (D9) Data <- | D | -> 2
//          4 <- | 4 | -> 3
//          5 <- | 0 | 
//          6 <- | 2 | 
//          7 <- | 1 | <- Clock Data (D7)
//        GND -> | B | <- Latch Data (D8)
//               -----
//         --u--
//    1 <- | 7 | <- 5V
//    2 <- | 4 | -> 0
//    3 <- | H | <- DS_PIN (D10)
//    4 <- | C | <- GND
//    5 <- | 5 | <- STCP_PIN (D11)
//    6 <- | 9 | <- SHCP_PIN (D12)
//    7 <- | 5 | <- 5V
//  GND -> | N |
//         -----

#define IC_4021_CLOCK_PIN 7
#define IC_4021_LATCH_PIN 8
#define IC_4021_DATA_PIN 9
#define IC_595_DS_PIN 10
#define IC_595_STCP_PIN 11
#define IC_595_SHCP_PIN 12

#define IC_4021_COUNT 3
#define IC_595_COUNT 3

int i;
bool isToWriteOutput;

unsigned long t; // Temp values read from from 4021.
uint8_t header; // Request header.
uint8_t currentValue[IC_595_COUNT]; // Current value to 595.
uint8_t newValue[IC_595_COUNT]; // New value read from MPU and will send to 595.

void setup() {
  Serial.begin(9600); // debug serial
  Serial1.begin(57600); // to MPU

  pinMode(IC_4021_CLOCK_PIN, OUTPUT);
  pinMode(IC_4021_LATCH_PIN, OUTPUT);
  pinMode(IC_4021_DATA_PIN, INPUT);
  pinMode(IC_595_DS_PIN, OUTPUT);
  pinMode(IC_595_STCP_PIN, OUTPUT);
  pinMode(IC_595_SHCP_PIN, OUTPUT);

  pinMode(LED_BUILTIN, OUTPUT);
  
  digitalWrite(IC_595_DS_PIN, LOW);
  digitalWrite(IC_595_STCP_PIN, HIGH);
  digitalWrite(IC_595_SHCP_PIN, LOW);
  digitalWrite(LED_BUILTIN, LOW);

  for (int i = 0; i < IC_595_COUNT; i++) {
    currentValue[i] = 0x01;
  }
}

void loop() {

  isToWriteOutput = false;

  // Read signal from MPU.  LED is on while reading.
  if (Serial1.available()) {

    // Wait a bit for the entire message to arrive
    delay(100);

    // Read request header
    Serial1.readBytes(&header, 1);

    if (header & 0xF0 == 0x80) {
      Serial.println("Request to read latch state (595 state)");

      uint8_t temp = 0x80 | IC_595_COUNT;
      Serial1.write(&temp, 1);
      Serial1.write(currentValue, IC_595_COUNT);
    } else if (header & 0xF0 == 0x40) {
      Serial.println("Request to read switch state (4021 state)");
      
    } else {
      Serial.println("Request to write latch state (595 state)");
      
      // Determine request bytes.
      int byteCount = header & 0x0F;
      if (byteCount > IC_595_COUNT) {
        byteCount = IC_595_COUNT;
      }

      // Read serial values
      Serial1.readBytes(newValue, byteCount);
    }

    // Clear input
    while (Serial1.available()) {
      Serial1.read();
    }
  }

  // Copy values and check if need to write to 595.
  for (i = 0; i < IC_595_COUNT; i++) {
    if (currentValue[i] != newValue[i]) {
      isToWriteOutput = true;
      currentValue[i] = newValue[i];
    }
  }

  if (isToWriteOutput) {
    digitalWrite(LED_BUILTIN, HIGH);
    writeOutput();
    digitalWrite(LED_BUILTIN, LOW);
  }

//  readInput(newValue);
//  if (newValue != oldValue) {
//    digitalWrite(LED_BUILTIN, HIGH);
//
//    oldValue = newValue;
//    writeOutput(oldValue);
//    Serial.println(oldValue, BIN);
//
//    digitalWrite(LED_BUILTIN, LOW);
//  }
//
//  delay(100);
}

void readInput(unsigned long &value) {

  digitalWrite(IC_4021_LATCH_PIN, LOW);
  delayMicroseconds(2);

  value = 0;

  for (i = (8 * IC_4021_COUNT) - 1; i >= 0; i--) {
    digitalWrite(IC_4021_CLOCK_PIN, LOW);
    delayMicroseconds(2);
    t = digitalRead(IC_4021_DATA_PIN);
    digitalWrite(IC_4021_CLOCK_PIN, HIGH);
    delayMicroseconds(2);

    value |= (t << i);
  }

  digitalWrite(IC_4021_LATCH_PIN, HIGH);
  delayMicroseconds(2);
}

void writeOutput() {
  digitalWrite(IC_595_STCP_PIN, LOW);
  for (i = IC_595_COUNT - 1; i >= 0; i--) {
    shiftOut(IC_595_DS_PIN, IC_595_SHCP_PIN, MSBFIRST, currentValue[i]);
    Serial.println(currentValue[i], BIN);
  }
  digitalWrite(IC_595_STCP_PIN, HIGH);
}
