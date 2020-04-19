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
byte pattern; // Single byte to write to 595.
unsigned long t; // Temp values read from from 4021.
uint8_t bytes[4]; // Temp values read  from from Serial1 (MPU).
unsigned long oldValue; // Current output register values.
unsigned long newValue; // New output register values.


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

  oldValue = 0;
  newValue = 0;
}

void loop() {

  // Read signal from MPU.  LED is on while reading.
  if (Serial1.available()) {

    // Wait a bit for the entire message to arrive
    delay(100);

    // MPU should send request in exactly 3 bytes binary.
    Serial1.readBytes(bytes, sizeof(bytes) / sizeof(byte));
    newValue = 0;
    for (i = 0; i < 4; i++) {
      newValue |= bytes[0] << (8 * 0) & 0xFF;
    }

    if (newValue != oldValue) {
      digitalWrite(LED_BUILTIN, HIGH);
      oldValue = newValue;
      writeOutput(oldValue);
      Serial.println(oldValue, BIN);
      digitalWrite(LED_BUILTIN, LOW);
    }

    // Clear input
    while (Serial1.available()) {
      Serial1.read();
    }
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

void writeOutput(unsigned long value) {
  digitalWrite(IC_595_STCP_PIN, LOW);

  for (i = 0; i < IC_595_COUNT; i++) {
    pattern = value >> (8 * i) & 0xFF;
    shiftOut(IC_595_DS_PIN, IC_595_SHCP_PIN, LSBFIRST, pattern);
  }

  digitalWrite(IC_595_STCP_PIN, HIGH);
}
