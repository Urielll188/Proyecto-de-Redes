# 🚀 Guía Maestra de Despliegue y Demo en Vivo — Mallas Tlaxcalli
**Cliente:** Mallas Tlaxcalli (Ing. Paola Almanza / Ing. Rocha)  
**Modelo de Comisión Agencia:** **$200 MXN por paquete entregado y pagado** (+ cuota de instalación).

---

## 📂 Estructura Completa del Ecosistema Creado

```
AGENCIA_AUTOMATIZACION/MALLAS_TLAXCALLI/
│
├── docker-compose.yml                              # Orquestación n8n + Evolution API v2 + Postgres + Redis
├── .env                                            # Variables de entorno, llaves y red tlaxcalli_net
├── README_DEMO.md                                  # Esta guía paso a paso + Checklist de pendientes
├── DEMO_INTERACTIVO_TLAXCALLI.html                 # Simulador Web en vivo listo para mostrar sin internet/Docker
│
├── prompts/
│   └── system_prompt_tlaxcalli.md                  # Cerebro completo de "Martín" con todas las reglas reales
│
├── scripts/
│   └── generar_bd_demo.py                          # Script generador de las 3 tablas CRM en CSV
│
├── data/
│   ├── 1_Prospectos_Maps.csv                       # 25 tortillerías en Tultitlán, Coacalco, Naucalpan, Tlalnepantla, Izcalli, CDMX
│   ├── 2_Pedidos_y_Rutas.csv                       # Folios #TLX, rutas, métodos de pago y candado de $200 comisión
│   └── 3_Catalogo_Precios.csv                      # Paquete $1,713 menudeo y Mayoreo 10+ para mecánicos
│
└── workflows/
    ├── modulo_1_cazador_goteo.json                 # Scraper & Outbound con Wait de 25 min anti-bloqueo
    ├── modulo_2_y_3_cerrador_multimodal.json       # Webhook + Whisper + GPT-4o-mini + TTS + Despacho + Visión GPT-4o
    ├── modulo_4_perseguidor_followup.json          # Reactivación 24h en visto + Post-venta 15 días (baleros $26+)
    └── modulo_5_director_marketing.json            # Copys y directrices para fotos reales de taller
```

---

## 🛠️ PASO 1: Levantar los Contenedores Docker (En tu máquina o VPS)

> **⚠️ Diagnóstico de esta máquina Windows 11:**  
> Al verificar tu terminal actual, **Docker Desktop** y **Node.js** aún no están instalados en este equipo local (estaban dentro del servidor VPS anterior).  
> - **Opción A (Para correr los contenedores aquí en Windows 11):** Instala [Docker Desktop para Windows](https://www.docker.com/products/docker-desktop/), ábrelo y ejecuta el comando de abajo.  
> - **Opción B (Para mostrar el Demo HOY MISMO sin instalar nada):** Abre el archivo **`DEMO_INTERACTIVO_TLAXCALLI.html`** con doble clic en tu navegador. Tiene programadas todas las reglas reales de Mallas Tlaxcalli ($1,713, mayoreo 10+, cobertura, cero efectivo y candado de $200 de comisión).

Cuando tengas Docker Desktop activo, abre PowerShell en esta carpeta y ejecuta:

```powershell
cd "C:\Users\Hugo\Desktop\Respaldo_VPS\AGENCIA_AUTOMATIZACION\MALLAS_TLAXCALLI"
docker compose up -d
```

Esto encenderá 4 contenedores conectados en la red `tlaxcalli_net`:
1. **`tlaxcalli_n8n`** → `http://localhost:5678`
2. **`tlaxcalli_evolution_api`** → `http://localhost:8080`
3. **`tlaxcalli_postgres`** → Base de datos interna de Evolution API
4. **`tlaxcalli_redis`** → Caché de sesiones de WhatsApp

---

## 🔗 PASO 2: Vincular el WhatsApp por Código QR en Evolution API

1. Con Docker corriendo, abre tu navegador en: `http://localhost:8080/manager`
2. Ingresa la Global API Key configurada en tu `.env`:
   ```
   tlaxcalli_evo_master_key_2026
   ```
3. Crea una instancia llamada exactamente:
   ```
   MallasTlaxcalli_Ventas
   ```
4. Haz clic en **"Connect / Get QR Code"** y escanea el código QR desde la app **WhatsApp Business** del teléfono destinado a Mallas Tlaxcalli.
5. En la sección **Webhook** de esa instancia:
   - Activa **Enabled**.
   - Pon la URL interna de la red Docker: `http://n8n:5678/webhook/whatsapp-tlaxcalli-inbound`
   - Marca el evento `MESSAGES_UPSERT`.

---

## ⚙️ PASO 3: Importar los Flujos en n8n

1. Entra a `http://localhost:5678` y crea tu cuenta de administrador local.
2. Haz clic en **"Add Workflow" -> Menú (⋮) -> "Import from File..."** e importa los 4 archivos de la carpeta `workflows/`:
   - `modulo_1_cazador_goteo.json`
   - `modulo_2_y_3_cerrador_multimodal.json`
   - `modulo_4_perseguidor_followup.json`
   - `modulo_5_director_marketing.json`
3. En tu archivo `.env`, coloca tu `OPENAI_API_KEY` real y reinicia n8n (`docker compose restart n8n`).
4. Activa el switch **"Active"** arriba a la derecha en el flujo `modulo_2_y_3_cerrador_multimodal`.

---

## 🎭 PASO 4: Cómo Hacer la Prueba en Vivo Frente a la Ing. Paola / Ing. Rocha

1. **Muestra la Base de Datos (`data/1_Prospectos_Maps.csv`):**
   - Ábrela en Excel para que vean las 25 tortillerías mapeadas en **Tultitlán, Coacalco, Naucalpan, Tlalnepantla, Cuautitlán Izcalli, Atizapán, Tepotzotlán y CDMX**.
2. **Haz la Prueba del Cerrador (Módulo 2):**
   - Desde tu celular personal, manda un WhatsApp (o prueba en el simulador `DEMO_INTERACTIVO_TLAXCALLI.html`) escribiendo:
     - *"Hola, ¿en cuánto sale la pura malla transportadora?"* → Verán cómo **Martín** explica que no se vende suelta por el envío gratis y ofrece el **Paquete Completo en $1,713 MXN** (ahorro de $1,000 vs refaccionaria).
     - *"Ahorita mi máquina Celorio anda bien, no ocupo"* → Verán cómo aplica el argumento de *"los fierros no avisan a medio turno"* y que **no pedimos anticipo**.
     - *"¿Puedo pagarle en efectivo al chofer?"* → Verán cómo explica la regla estricta de **solo Transferencia al momento o Tarjeta en terminal Mercado Pago**.
3. **Muestra el Candado de Ruta y Comisiones (Módulo 3):**
   - Enseña la tabla `data/2_Pedidos_y_Rutas.csv` donde cada pedido tiene su Folio (`#TLX-001`), ubicación GPS, estatus de entrega y cómo la columna `Comision_Agencia_MXN` solo libera los **$200 MXN** cuando el repartidor sube la foto del comprobante validado por IA.

---

## 📋 ¿QUÉ NOS HACE FALTA PARA SALIR A PRODUCCIÓN REAL? (PLANIFICACIÓN SIGUIENTE)

Aquí está el checklist exacto de lo que necesitamos definir o recabar con la Ing. Paola / Ing. Rocha tras aprobar el demo:

1. **Infraestructura:**
   - [ ] Instalar **Docker Desktop** en esta PC (si va a correr local) o contratar/levantar un **VPS Linux (Ubuntu 22.04, $5-$10 USD/mes en Hetzner/Hostinger/DigitalOcean)** para que el bot atienda 24/7 aunque apagues tu computadora.
2. **Credenciales y APIs:**
   - [ ] **OpenAI API Key** con saldo ($5 USD rinden para miles de mensajes en `gpt-4o-mini` y transcripciones Whisper).
   - [ ] **Apify API Token** (cuenta gratuita da $5 USD mensuales que alcanzan para extraer ~2,000 tortillerías reales de Google Maps).
   - [ ] *(Opcional)* **ElevenLabs API Key** si queremos clonar la voz real de un vendedor mexicano o usar el TTS de OpenAI (`onyx` / `alloy`).
3. **Activos Operativos del Cliente (Pedir a la Ing. Paola / Ing. Rocha):**
   - [ ] **Chip de WhatsApp Business exclusivo** para conectar al código QR (y calentarlo gradualmente).
   - [ ] **Crear el Grupo de WhatsApp de Repartidores** y obtener su ID (`...@g.us`) para que el Módulo 3 mande ahí las órdenes de ruta y reciba las fotos de pago.
   - [ ] **Lista detallada de Colonias / Zonas Rojas** adicionales que sus repartidores ya conocen que son peligrosas en CDMX y Edomex para agregarlas al filtro automático del prompt.
   - [ ] **Lista de Precios de los demás Baleros ($26+ MXN)** para cargarla en el disparo automático de los 15 días post-venta (Módulo 4).
   - [ ] **Fotos y Videos reales en crudo** tomados en el taller (rollos de malla testalera, transportadora Calibre 14, balero 7210B y entregas reales) para alimentar el Módulo 5 y mandar como evidencia de confianza por WhatsApp.
