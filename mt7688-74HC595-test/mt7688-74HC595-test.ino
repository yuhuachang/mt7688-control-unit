// Purpose:
//   Test all wiring of chips are correct.
//
// Wiring:
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

#define IC_595_DS_PIN 10 // Serial Data Input
#define IC_595_STCP_PIN 11 // Storage Register Clock Input (Digital Clock)
#define IC_595_SHCP_PIN 12 // Shift Register Clock Input (Bit Clock)

#define IC_COUNT 3

unsigned long value;

int i, s;
byte pattern;

void setup() {
  pinMode(IC_595_DS_PIN, OUTPUT);
  pinMode(IC_595_STCP_PIN, OUTPUT);
  pinMode(IC_595_SHCP_PIN, OUTPUT);

  pinMode(LED_BUILTIN, OUTPUT);
  
  digitalWrite(IC_595_DS_PIN, LOW);
  digitalWrite(IC_595_STCP_PIN, HIGH);
  digitalWrite(IC_595_SHCP_PIN, LOW);
  digitalWrite(LED_BUILTIN, LOW);

  value = 1;
  s = 0;
}

void loop() {
  setOutput();

  value = value << 1;

  s++; 
  if (s >= (8 * IC_COUNT)) {
    value = 1;
    s = 0;
  }

  delay(100);
}

void setOutput() {
  digitalWrite(LED_BUILTIN, HIGH);
  
  digitalWrite(IC_595_STCP_PIN, LOW);

  for (i = 0; i < IC_COUNT; i++) {
    pattern = value >> (8 * i) & 0xFF;
    shiftOut(IC_595_DS_PIN, IC_595_SHCP_PIN, LSBFIRST, pattern);
  }

  digitalWrite(IC_595_STCP_PIN, HIGH);

  digitalWrite(LED_BUILTIN, LOW);
}
