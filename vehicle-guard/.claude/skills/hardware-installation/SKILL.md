---
name: hardware-installation
description: Use this skill whenever Maximiliano asks about physical hardware, electronic components, soldering, wiring to a vehicle, OBD-II connection, 12V to 5V power conversion, antenna placement, BOM (bill of materials), Aliexpress/Mercado Libre purchases, or installation procedure on cars/motorcycles. Triggers on words like "comprar", "soldar", "cable", "OBD", "voltaje", "antena", "instalar en el auto", "fuente de poder", "fusible", "relé", "PCB". Activate before any physical work to prevent damaging vehicles or burning components.
---

# Hardware & Installation

Skill para todo lo físico: qué comprar, cómo conectar, dónde montar, cómo no quemar la ECU del auto.

## Lista de compras — Fase 1 MVP (1 dispositivo)

| Componente | Modelo sugerido | Cant. | Precio aprox CLP | Donde comprar |
|------------|----------------|-------|------------------|---------------|
| ESP32 DevKit V1 | ESP-WROOM-32 38 pines | 1 | $5.000–8.000 | Aliexpress / Mercado Libre |
| Módulo SIM7600G-H | Versión 4G + GPS + LTE multi-banda Latam | 1 | $35.000–50.000 | Aliexpress (Waveshare es buena marca) |
| Antena GPS activa | SMA macho, 3-5V, ganancia 28dB | 1 | $3.000–5.000 | Aliexpress |
| Antena 4G LTE | SMA macho, banda 700-2700MHz | 1 | $3.000–5.000 | Aliexpress |
| Step-down 12V→5V | LM2596 con disipador, mín. 3A | 1 | $2.000–3.000 | Aliexpress |
| Relé automotriz 12V SPDT 30A | Bosch genérico con socket | 1 | $3.000 | Cualquier ferretería automotriz |
| Módulo relé 5V con optoacoplador | 1 canal, activación LOW | 1 | $1.500 | Aliexpress |
| Fusibles inline 5A + 10A + portafusibles | | 3 | $2.000 | Ferretería |
| Cable automotriz AWG 16 y AWG 20 | 5m de cada uno, varios colores | | $5.000 | Ferretería |
| Conectores faston, terminales ojal, termorretráctil | Kit surtido | | $5.000 | Ferretería |
| Capacitor electrolítico 1000µF 16V | Para el SIM7600 | 2 | $500 | Casa de electrónica |
| Multímetro básico | Si no tienes | 1 | $10.000–15.000 | Sodimac / electrónica |
| Soldador + estaño | Si no tienes | 1 | $15.000 | Sodimac |
| Caja IP65 plástica pequeña | ~10x7x4cm | 1 | $4.000 | Ferretería |
| SIM card datos M2M | Entel/WOM/Movistar — plan IoT | 1 | $3.000–5.000/mes | Operador |

**Total aprox: $90.000–130.000 CLP** (~US$95–140) por la primera unidad incluyendo herramientas.
**Unidades replicadas:** ~$60.000 CLP cada una (sin re-comprar herramientas).

> ⚠️ **Verificar precios al momento de comprar.** Estos son estimados Q4 2025/2026 en Chile y cambian.

## Diagrama eléctrico de instalación

```
                 ┌─────────────────────────────────────────┐
                 │                                         │
   Batería 12V ──┼── Fusible 10A ──┐                       │
                 │                 │                       │
                 │                 ├──► Step-down 12V→5V ──┼─► VCC ESP32
                 │                 │                       │       │
                 │                 │                       │       └─► GPIO ─► Módulo relé 5V ─┐
                 │                 │                       │                                    │
                 │                 └────────► VBAT SIM7600 │                                    │
                 │                                         │                                    │
                 │                                         │                                    │
   Ignición   ──┼── Fusible 5A ───────────────────────────┼─► GPIO ESP32 (lectura ON/OFF)      │
                 │                                         │                                    │
                 │                                         │                                    │
   Bobina/Inj ──┼── (CABLE A CORTAR) ──── Relé 12V 30A ───┼────────────────────────────────────┘
                 │                       (NC: cerrado por defecto)                              │
                 │                                                                              │
   GND       ──┼── ─────────────────────────────────────── ┼─► GND ESP32 + GND SIM7600          │
                 │                                         │                                    │
                 └─────────────────────────────────────────┘                                    │
                                                                                                 │
                            Cuando el ESP32 activa el GPIO ────────────────────────────────────┘
                            → optoacoplador conduce → relé 5V activa → relé automotriz se abre
                            → corta el circuito de bobina/inyectores → motor se detiene
```

### Por qué dos relés en serie

- **Módulo relé 5V con optoacoplador** aísla eléctricamente el ESP32 del sistema de 12V (si hay un pico, el ESP32 sobrevive).
- **Relé automotriz 30A** maneja la corriente que el módulo de 5V no aguantaría (los pequeños van hasta ~10A nominal pero los inductivos del auto requieren tolerancia).

### Qué cable cortar

**NUNCA el cable principal de batería ni el de arranque.** Cortar uno de estos:

1. **Línea de alimentación de la bomba de combustible** (preferida en autos modernos — la bomba es 12V, fácil de aislar, el motor se detiene en 30s sin gasolina sin apagones bruscos).
2. **Línea de la bobina de encendido o inyectores** (motor se detiene inmediatamente — más agresivo).
3. **Negativo de la batería vía relé inverso** (NO recomendado — puede dañar la ECU si se hace en marcha).

**Recomendación: corta la bomba de combustible.** Es lo que hacen los kits comerciales (Cobra, Pandora) por seguridad.

## OBD-II como fuente de poder

El conector OBD-II tiene un pin con **12V permanentes** (no pasa por el switch de ignición), lo que permite alimentar el dispositivo sin cableado adicional.

Pinout OBD-II estándar:
- Pin 16: +12V (siempre activo)
- Pin 4 o 5: GND (chasis)

⚠️ **El consumo del SIM7600 en transmisión puede ser de 2A en peaks.** Si el auto está estacionado mucho tiempo, esto descarga la batería. **Para Fase 1**, un auto en uso diario lo soporta sin problema. Para Fase 2 implementar deep sleep.

## Procedimiento de instalación — checklist

### Antes de tocar el auto

- [ ] El dispositivo pasó **20 horas de tabletop testing** sin colgarse
- [ ] El relé de corte fue probado con LED simulando motor — activa solo si firmware lo manda
- [ ] El firmware está en versión estable y commiteado
- [ ] Tienes seguro contra terceros (por las dudas)
- [ ] El dueño del auto (si no es tuyo) firmó consentimiento escrito

### Instalación física (tiempo estimado: 2h en auto, 3-4h en moto)

1. **Desconecta el negativo de la batería** del vehículo. Espera 15 minutos (para que se descarguen los capacitores de la ECU).
2. **Identifica los cables a intervenir** consultando el diagrama eléctrico del modelo específico (busca PDF del workshop manual).
3. **Cablea el step-down a +12V permanentes y GND**. Verifica con multímetro que entrega 5.0V ± 0.1V antes de conectar al ESP32.
4. **Conecta el módulo relé en serie con el cable objetivo** (bomba de combustible). Usa terminales soldados + termorretráctil, no clips. Agrega fusible inline.
5. **Coloca las antenas:**
   - GPS: bajo el parabrisas, mirando al cielo. Lejos de metal sólido encima.
   - 4G: en cualquier ubicación con buena cobertura, separada > 10cm de la GPS.
6. **Monta el dispositivo** dentro de la caja IP65, idealmente bajo el tablero o en el compartimiento del fusible. **Lejos de fuentes de calor (motor, escape).**
7. **Reconecta la batería**. Verifica que el auto arranca normalmente.
8. **Verifica funcionamiento sin apagar:** el dispositivo debe registrarse en el backend en < 2 minutos. La velocidad GPS debe leerse como 0 km/h. La luz del relé debe estar APAGADA.
9. **Test estático del corte:** desde la app, con el auto encendido pero detenido, prueba el corte. El motor debe detenerse en 5-30s (depende del cable cortado). Vuelve a encender. Confirma que el ciclo funciona.
10. **Test dinámico:** anda 5 minutos a velocidad baja. Verifica tracking. **NO pruebes el corte en marcha.**

### Para motos (Suzuki Gixxer 250 de Maximiliano)

Las motos son más difíciles porque:
- Espacio físico mínimo bajo el asiento.
- El sistema eléctrico es más sensible a ruido.
- Si la moto se cae, el dispositivo recibe golpes.

Recomendaciones:
- Caja más pequeña (puedes hacer una placa custom en la Fase 2 para reducir tamaño).
- Antenas adhesivas planas en lugar de con base.
- Cableado con doble protección (manga espiralada + cinta auto-amalgamante).
- El cable a cortar en moto generalmente es la línea de la bobina (en motos sin inyección) o de la bomba (en inyectadas como la Gixxer 250).

## Errores que dañan vehículos (NO HACER)

- ❌ Soldar directo a la ECU.
- ❌ Tomar +12V del cable de un sensor (los sensores tienen líneas de 5V de referencia que no aguantan).
- ❌ Conectar el dispositivo al CAN-bus sin aislamiento (riesgo de cortocircuito que mata módulos de US$1000+).
- ❌ Usar cable de telecomunicaciones (cobre delgado, no aguanta vibración).
- ❌ Dejar cables sueltos cerca del múltiple de escape.
- ❌ Omitir fusibles ("no pasa nada" = primer paso al incendio).
- ❌ Probar el corte de corriente en marcha la primera vez. **Siempre detenido.**

## Para profundizar

- `references/wiring-diagram.svg` — diagrama eléctrico detallado
- `references/installation-photos.md` — fotos de instalaciones de referencia
- `references/obd2-pinout.md` — pinout completo del OBD-II
- Skill `vehicle-security` para la lógica del corte
- Skill `device-provisioning` cuando sea hora de hacer el segundo dispositivo
