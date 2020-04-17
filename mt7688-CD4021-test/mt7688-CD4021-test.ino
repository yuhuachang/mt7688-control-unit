// Purpose:
//   Test all wiring of chips are correct.
//
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

#define IC_4021_CLOCK_PIN 7
#define IC_4021_LATCH_PIN 8
#define IC_4021_DATA_PIN 9

#define IC_COUNT 3

unsigned long value;

int i;
unsigned long t;

void setup() {
  Serial.begin(9600);

  pinMode(IC_4021_CLOCK_PIN, OUTPUT);
  pinMode(IC_4021_LATCH_PIN, OUTPUT);
  pinMode(IC_4021_DATA_PIN, INPUT);

  pinMode(LED_BUILTIN, OUTPUT);

  digitalWrite(LED_BUILTIN, LOW);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  
  digitalWrite(IC_4021_LATCH_PIN, LOW);
  delayMicroseconds(2);

  value = 0;

  for (i = (8 * IC_COUNT) - 1; i >= 0; i--) {
    digitalWrite(IC_4021_CLOCK_PIN, LOW);
    delayMicroseconds(2);
    t = digitalRead(IC_4021_DATA_PIN);
    digitalWrite(IC_4021_CLOCK_PIN, HIGH);
    delayMicroseconds(2);

    value = value | (t << i);
  }

  digitalWrite(IC_4021_LATCH_PIN, HIGH);
  delayMicroseconds(2);

  Serial.println(value, BIN);

  digitalWrite(LED_BUILTIN, LOW);
  delay(1000);
}
