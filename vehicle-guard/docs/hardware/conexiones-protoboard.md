# Guía de conexiones — Prototipo en protoboard

> Sin soldadura. Solo cables dupont insertados en la protoboard.

---

## Lo que necesitas sobre la mesa

- ESP32 DevKit V1
- GPS Neo-6M (GY-NEO6MV2)
- Módulo relé 5V 1 canal
- Protoboard 830 puntos
- Cables dupont (macho-macho y macho-hembra)
- Cable micro-USB → PC

---

## Paso 1 — Insertar el ESP32 en la protoboard

Inserta el ESP32 a lo largo del centro de la protoboard, con cada fila de pines en una mitad distinta. Debe quedar así:

```
Protoboard (vista desde arriba):

  fila A  [ ESP32 pin izquierdo ]
  fila B  [                     ]  ← espacio libre para cables
  fila C  [ ESP32 pin derecho   ]
```

El ESP32 tiene 2 filas de pines. Al insertarlo en el centro queda espacio en los costados para conectar cables.

---

## Paso 2 — Conectar el GPS Neo-6M

El GPS tiene 4 pines. Usa 4 cables dupont **macho-hembra** (macho al ESP32, hembra al GPS).

```
GPS Neo-6M        Cable        ESP32 DevKit V1
─────────────────────────────────────────────
VCC         →    rojo    →    3V3   (pin "3V3")
GND         →    negro   →    GND   (cualquier pin GND)
TX          →    verde   →    GPIO16  (marcado "16" o "RX2")
RX          →    amarillo→    GPIO17  (marcado "17" o "TX2")
```

> ⚠️ **Importante:** conecta VCC del GPS al pin **3V3**, NO al 5V.
> El ESP32 solo tolera 3.3V en sus pines de datos. Si conectas al 5V puedes dañarlo.

> ⚠️ **TX del GPS va al RX del ESP32, y viceversa.** Esto es correcto — siempre se cruzan.

---

## Paso 3 — Conectar el módulo relé

El relé tiene 3 pines de control (lado izquierdo del módulo).

```
Módulo relé       Cable        ESP32 DevKit V1
─────────────────────────────────────────────
VCC         →    rojo    →    VIN   (pin "VIN" — este es 5V del USB)
GND         →    negro   →    GND   (cualquier pin GND)
IN          →    azul    →    GPIO26  (marcado "26")
```

> ⚠️ El relé necesita **5V** para funcionar. Usa el pin **VIN**, no el 3V3.

---

## Paso 4 — Verificar antes de conectar al PC

Antes de enchufar el USB, revisa visualmente:

- [ ] VCC del GPS está en **3V3** (no en VIN ni 5V)
- [ ] TX del GPS está en **GPIO16**
- [ ] RX del GPS está en **GPIO17**
- [ ] VCC del relé está en **VIN** (5V)
- [ ] IN del relé está en **GPIO26**
- [ ] Ningún cable toca dos puntos de la protoboard que no deberían estar conectados

---

## Diagrama visual completo

```
                    ┌─────────────────────────────┐
                    │       ESP32 DevKit V1        │
                    │                              │
          3V3 ──────┤ 3V3              VIN ────────┼────── VCC (Relé)
          GND ──────┤ GND              GND ────────┼────── GND (Relé)
  TX(GPS) ──────────┤ GPIO16          GPIO26 ──────┼────── IN  (Relé)
  RX(GPS) ──────────┤ GPIO17                       │
          GND ──────┤ GND                          │
          VCC ──────┤ 3V3                          │
                    │                              │
                    │         [USB]                │
                    └───────────┬──────────────────┘
                                │
                            Cable micro-USB
                                │
                               PC
```

```
GPS Neo-6M                          Módulo Relé 5V
┌──────────┐                        ┌──────────────┐
│ VCC ─────┼── rojo ── 3V3          │ VCC ─────────┼── rojo ── VIN
│ GND ─────┼── negro ─ GND          │ GND ─────────┼── negro ─ GND
│ TX  ─────┼── verde ─ GPIO16       │ IN  ─────────┼── azul ── GPIO26
│ RX  ─────┼── amaril─ GPIO17       └──────────────┘
└──────────┘
```

---

## Paso 5 — Conectar al PC y verificar

1. Conecta el cable micro-USB del ESP32 al PC.
2. El ESP32 debe encender un LED rojo (indicador de poder).
3. El módulo GPS debe encender un LED (puede parpadear — es normal).
4. Abre VS Code → Monitor serial a **115200 baud**.
5. Si ya tienes el firmware cargado, verás los mensajes de arranque.

---

## ¿Qué hace cada componente en el prototipo?

| Componente | Rol en el prototipo |
|---|---|
| ESP32 | Cerebro: corre el firmware, conecta al WiFi, publica MQTT |
| GPS Neo-6M | Lee la ubicación y velocidad del dispositivo |
| Módulo relé | Simula el corte de corriente (enciende/apaga un LED en vez del motor) |
| Protoboard | Sostiene todo sin soldar |
| LM2596 | **No se usa todavía** — es para cuando conectes al auto (12V→5V) |

---

## Errores comunes al conectar

| Error | Causa | Solución |
|---|---|---|
| GPS no aparece en monitor | TX/RX invertidos | Intercambia los cables GPIO16 y GPIO17 |
| ESP32 se reinicia solo | Relé conectado a 3V3 en vez de VIN | Mueve VCC del relé al pin VIN |
| No aparece puerto COM en PC | Driver no instalado | Instala driver CP210x o CH340 |
| GPS nunca obtiene fix | Sin visión del cielo | Acerca a ventana o sal afuera 2-3 min |
