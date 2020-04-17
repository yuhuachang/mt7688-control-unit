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

int i, s;
byte pattern;
unsigned long oldValue;
unsigned long newValue;
unsigned long t;

void setup() {
  Serial.begin(9600);

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

  readInput(newValue);
  if (newValue != oldValue) {
    oldValue = newValue;
    writeOutput(oldValue);
    Serial.println(oldValue, BIN);
  }

  delay(100);
}

void readInput(unsigned long &value) {
  digitalWrite(LED_BUILTIN, HIGH);
  
  digitalWrite(IC_4021_LATCH_PIN, LOW);
  delayMicroseconds(2);

  value = 0;

  for (i = (8 * IC_4021_COUNT) - 1; i >= 0; i--) {
    digitalWrite(IC_4021_CLOCK_PIN, LOW);
    delayMicroseconds(2);
    t = digitalRead(IC_4021_DATA_PIN);
    digitalWrite(IC_4021_CLOCK_PIN, HIGH);
    delayMicroseconds(2);

    value = value | (t << i);
  }

  digitalWrite(IC_4021_LATCH_PIN, HIGH);
  delayMicroseconds(2);

  digitalWrite(LED_BUILTIN, LOW);
}

void writeOutput(unsigned long value) {
  digitalWrite(LED_BUILTIN, HIGH);
  
  digitalWrite(IC_595_STCP_PIN, LOW);

  for (i = 0; i < IC_595_COUNT; i++) {
    pattern = value >> (8 * i) & 0xFF;
    shiftOut(IC_595_DS_PIN, IC_595_SHCP_PIN, LSBFIRST, pattern);
  }

  digitalWrite(IC_595_STCP_PIN, HIGH);

  digitalWrite(LED_BUILTIN, LOW);
}
