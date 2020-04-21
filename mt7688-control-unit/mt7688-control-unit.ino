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

int i, j, t;
bool isToWriteOutput;
uint8_t header[1]; // Request header.
bool readLatchState;
bool readSwitchState;
int byteCount; // Bytes to read/write 595.
uint8_t currentValue[IC_595_COUNT]; // Current value to 595.
uint8_t newValue[IC_595_COUNT]; // New value read from MPU and will send to 595.
uint8_t switchValue[IC_4021_COUNT]; // Current value to 4021.

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
    currentValue[i] = 0x00;
  }
}

void loop() {

  isToWriteOutput = false;

  // Read signal from MPU.  LED is on while reading.
  if (Serial1.available()) {

    // Wait a bit for the entire message to arrive
    delay(100);

    // Read request header
    Serial1.readBytes(header, 1);
    Serial.print("header = 0x");
    Serial.println(header[0], HEX);

    readLatchState = false;
    readSwitchState = false;

    if (header[0] >> 7 & 0x01 == HIGH) {
      Serial.println("Request to read latch state (595 state)");
      readLatchState = true;
    }
    
    if (header[0] >> 6 & 0x01 == HIGH) {
      Serial.println("Request to read switch state (4021 state)");
      readSwitchState = true;
    }

    if (header[0] >> 5 & 0x01 == HIGH) {
      Serial.println("Request to write latch state (595 state)");
      
      // Determine request bytes.
      byteCount = header[0] & 0x0F;
      Serial.print("byteCount = ");
      Serial.println(byteCount);
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
  for (i = 0; i < byteCount; i++) {
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

  if (readLatchState) {
    header[0] = 0x80 | IC_595_COUNT;
    Serial1.write(header, 1);
    Serial1.write(currentValue, IC_595_COUNT);
    readLatchState = false;
  }

  if (readSwitchState) {
    readInput();
    header[0] = 0x40 | IC_4021_COUNT;
    Serial1.write(header, 1);
    Serial1.write(switchValue, IC_4021_COUNT);
    readSwitchState = false;
  }

  delay(500);
}

void readInput() {
  digitalWrite(IC_4021_LATCH_PIN, LOW);
  delayMicroseconds(2);

  for (i = 0; i < IC_4021_COUNT; i++) {
    switchValue[i] = 0x00;
    for (j = 7; j >= 0; j--) {
      digitalWrite(IC_4021_CLOCK_PIN, LOW);
      delayMicroseconds(2);
      t = digitalRead(IC_4021_DATA_PIN);
      digitalWrite(IC_4021_CLOCK_PIN, HIGH);
      delayMicroseconds(2);
      switchValue[i] |= (t << j);
    }
  }

  digitalWrite(IC_4021_LATCH_PIN, HIGH);
  delayMicroseconds(2);
}

void writeOutput() {
  digitalWrite(IC_595_STCP_PIN, LOW);
  for (i = IC_595_COUNT - 1; i >= 0; i--) {
    shiftOut(IC_595_DS_PIN, IC_595_SHCP_PIN, MSBFIRST, currentValue[i]);

    Serial.print("Write ");
    Serial.print(i);
    Serial.print(": ");
    Serial.println(currentValue[i], BIN);
  }
  digitalWrite(IC_595_STCP_PIN, HIGH);
}
