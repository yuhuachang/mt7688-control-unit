# mt7688-control-unit

This is a home automation project with three controller (A, B, and C) to controll 64 relay channels and receive 80 on/off switches.

## Relay Control

74HC595 and ULN2803 are used to control 24V relay system.  All 74HC595 chips are linked and controlled by 3 digit pins on MT7688.  Each ULN2803 has an LED array as an indicator of relay status.

## Switches

CD4021 is used to detect the swtich status change.  The swtich can be any on/off switch.  All CD4021 chips are linked and send signals to 3 digit pins on MT7688.

## Control Unit Details
### Unit A
![Controller A](https://yuhuachang.github.io/repo/mt7688-control-unit/controller-A-s.jpg)
[Larger Picture](https://yuhuachang.github.io/repo/mt7688-control-unit/controller-A.jpg)

### Unit B
![Controller B](https://yuhuachang.github.io/repo/mt7688-control-unit/controller-B-s.jpg)
[Larger Picture](https://yuhuachang.github.io/repo/mt7688-control-unit/controller-B.jpg)

### Unit C
![Controller C](https://yuhuachang.github.io/repo/mt7688-control-unit/controller-C-s.jpg)
[Larger Picture](https://yuhuachang.github.io/repo/mt7688-control-unit/controller-C.jpg)

