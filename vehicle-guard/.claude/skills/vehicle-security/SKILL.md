---
name: vehicle-security
description: Use this skill whenever working on the kill-switch logic, anti-tampering, anti-jamming, secure command authentication, or any feature where a malicious actor or accident could endanger the vehicle, occupants, or third parties. Triggers when Maximiliano mentions "corte de corriente", "kill switch", "apagar el auto", "tampering", "anti-jamming", "robo", "seguridad física", "remote command security", or proposes any feature that involves stopping/disabling the vehicle. CRITICAL: load this skill BEFORE writing any code that controls the relay or stops the engine.
---

# Vehicle Security

Skill enfocada en los aspectos de seguridad **donde una falla podría causar daño físico real o ser explotada por un atacante**. Esto no es la skill de "ciberseguridad genérica" — es la skill de "no apagues el motor en una autopista".

## Threat model

Atacantes potenciales del sistema:

1. **Ladrón profesional con jammer GPS/4G**: bloquea señal para que no podamos rastrear ni cortar.
2. **Insider malicioso** (empleado deshonesto si comercializamos): acceso al backend.
3. **Atacante remoto** que compromete una cuenta de usuario.
4. **Atacante físico** que abre la caja del dispositivo y manipula el firmware.
5. **Bug propio**: nuestro código tiene un fallo que activa el corte cuando no debería.

El más peligroso de todos es el #5 — somos nosotros mismos. Por eso este skill existe.

## Reglas inviolables del corte de corriente

Estas reglas viven en el firmware (no solo en el backend) para que NO dependan de conectividad:

### Regla 1 — No cortes en movimiento

```cpp
bool SafetyGuard::canKillEngine() {
    auto v = GpsManager::lastValidSpeed();
    auto age = millis() - GpsManager::lastFixMs();

    if (age > 30'000) return false;             // GPS stale → no
    if (v.kmh > 5.0)  return false;             // moviéndose → no
    if (!v.isStableBelow(5.0, 10'000)) return false; // no llevamos 10s detenidos
    return true;
}
```

### Regla 2 — Verifica firma del comando

Cada comando del backend hacia el dispositivo viene firmado con HMAC-SHA256 usando una clave precompartida única por device. Si la firma falla, ignorar y registrar evento.

```cpp
bool CommandValidator::verify(const Command& cmd) {
    if (cmd.timestamp < (now() - 300)) return false;  // anti-replay (5 min)
    if (seenNonces.contains(cmd.nonce)) return false; // anti-replay
    auto expected = hmacSha256(cmd.payload, deviceSecret);
    return cmd.signature == expected;
}
```

### Regla 3 — Confirmación obligatoria antes de ejecutar

El backend manda `commands/kill-request`. El firmware **responde** `commands/kill-confirm-needed` con un nonce. El backend (validando UI/biometría del usuario) responde `commands/kill-confirm` con ese nonce firmado. Solo entonces se activa el relé.

Esto previene ataques donde un comando "antiguo" o malicioso se reenvía.

### Regla 4 — Reversa segura

Si el corte está activo y se pierde conexión por > 5 minutos, el firmware **mantiene** el corte (no liberar automáticamente — un atacante podría cortar internet para liberar el auto robado). Pero hay un **botón físico de bypass** en el dispositivo (tipo botón de pánico oculto) que el dueño legítimo conoce. Tras presionarlo + un PIN se libera.

### Regla 5 — Whitelisting estricto de usuarios

Cada device solo acepta comandos firmados por su `deviceSecret`. El secret se setea **una sola vez** en provisioning y no puede cambiarse remotamente. Si un atacante obtiene acceso al backend pero no al secret, no puede emitir comandos válidos.

## Anti-tampering

El dispositivo debe detectar si está siendo manipulado físicamente:

| Sensor / técnica | Detecta | Acción |
|------------------|---------|--------|
| Acelerómetro alta-G | Golpe brusco → robo de dispositivo | Alerta + foto si hay cámara |
| Microswitch en la caja | Apertura física | Alerta inmediata + corte automático si está armado |
| Detección de pérdida de GPS por > 5 min con vehículo cerrado | Posible jammer | Alerta "POSSIBLE_JAMMING" |
| Detección de pérdida de 4G + GPS simultáneamente | Jammer dual | Alerta crítica |
| Voltaje de batería del vehículo | Si cae a 0V → desconectado | Alerta + el dispositivo cambia a batería interna pequeña |

### Batería de respaldo interna

Recomendación para Fase 2+: agregar una **LiPo de 1000mAh con cargador IC (TP4056)** dentro del dispositivo. Si alguien desconecta la batería del auto pensando que neutraliza el GPS, el dispositivo sigue transmitiendo por 4-6h.

## Anti-jamming

Los jammers GPS/4G son ilegales pero existen2. Defensas:

1. **Detección, no prevención.** Si pierdes ambas señales simultáneamente y de golpe, casi seguro es jammer (no es típico de túneles ni estacionamientos subterráneos, donde la pérdida es gradual).
2. **Dead reckoning** con acelerómetro: si pierdes GPS pero tienes acelerómetro de 6 ejes, puedes estimar movimiento por minutos hasta recuperar señal. Almacenar localmente y enviar cuando vuelva la red.
3. **Cuando se recupere la señal**, transmitir el burst de datos almacenados — el atacante ya se fue pero tenemos su trayectoria estimada.

## Vectores de ataque al backend (no específico vehicular pero crítico aquí)

- **mTLS obligatorio entre backend y dispositivos.** Cada device tiene su cert único firmado por nuestra CA. El broker rechaza conexiones sin cert válido.
- **Rate limiting agresivo** en `/auth/login` (5 intentos por IP por 15 min).
- **Comando de corte requiere 2FA** (biometría en la app) — no basta con la contraseña.
- **Auditoría inmutable** de comandos (idealmente append-only en otra DB, ej: tabla con triggers que prohíben UPDATE/DELETE).
- **Alertas a admin** cuando se ejecuta un kill switch en cualquier device de la flota.

## Tests obligatorios antes de instalar el corte en cualquier auto

Esta lista debe pasar **al 100%** antes de que el corte de corriente quede armado en un vehículo en uso real:

- [ ] Corte solo se activa con vehículo detenido > 10s
- [ ] Corte se ignora si la velocidad GPS es > 5 km/h (probar con simulador GPS)
- [ ] Corte se ignora si el GPS está stale > 30s
- [ ] Corte requiere comando firmado válido (probar con firma inválida → debe rechazar)
- [ ] Corte registra evento en backend con `userId, timestamp, deviceId`
- [ ] Comando de "encender" libera el corte
- [ ] Si se pierde conexión durante el corte, el corte se mantiene
- [ ] Reset físico del dispositivo (desenchufar y reenchufar) no libera el corte automáticamente
- [ ] Botón de bypass + PIN libera el corte localmente
- [ ] El relé está en estado seguro (NO cortando) durante el boot del firmware
- [ ] El watchdog reinicia el firmware si se cuelga, sin activar el corte espureamente

## Aspectos legales (Chile) — IMPORTANTE

- El **corte remoto de motor** es jurídicamente borderline. La ley chilena no lo prohíbe expresamente para uso por el dueño, pero sí podría haber responsabilidad civil si causa accidente.
- **Recomendación:** la Fase 1 es para uso personal y de amigos, con consentimiento escrito. **Antes de comercializar, consultar abogado y eventualmente ofrecer el feature solo para flotas con conductor profesional informado.**
- Para el reglamento de tránsito chileno (DS 212), el dueño del vehículo es responsable de su estado mecánico. Documentar exhaustivamente que el corte solo opera en stop.

## Checklist filosófico — pregunta antes de codear

Antes de escribir cualquier código que pueda inmovilizar un vehículo, pregúntate:

1. ¿Este código podría activarse por un bug y dejar a alguien varado?
2. ¿Este código podría ser explotado si el usuario perdiera su contraseña?
3. ¿Hay un escenario donde el corte se active en una autopista a 100 km/h?
4. ¿Si pierdo el backend completo, el dispositivo queda en estado inseguro?

Si la respuesta a alguna es "sí" o "no sé", **no merge-eamos**. Iteramos hasta que sean 4 "no" rotundos.

## Para profundizar

- `references/threat-model.md` — análisis STRIDE completo
- `references/safe-state-machine.md` — diagrama de estados del corte
- Skill `esp32-firmware` para implementación
- Skill `mqtt-protocol` para el formato de comandos firmados
