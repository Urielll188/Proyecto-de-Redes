# Arquitectura SaaS Multi-Tenant y Matriz Comercial — BLITZR

## 1. Visión General del Sistema
**BLITZR** opera como una plataforma SaaS de prospección, marketing y cierre comercial automatizado con aislamiento estricto por cuenta de usuario (`owner_email`) y negocio (`cliente_id`):

* **Frontend (Next.js en Vercel):** Autenticación con Google/Supabase, flujo de arranque (`01 • IDEA` → `02 • ESTRATEGIA` → `03 • ESTUDIO`) y proxy autenticado (`/api/vps/proxy`) que inyecta el correo del usuario desde el servidor para evitar suplantación entre tenants.
* **Backend Operativo (Python `8090` + SQLite en contenedor `f610d06918b1`):** Gestión de perfiles en `perfiles_nicho`, Worker Cazador 24/7 (INEGI DENUE, Apify Google Maps, Facebook), cerebro conversacional de Andrea y registro de cierres/logística.
* **Puente WhatsApp Multi-Sesión (Node.js + Baileys `8095`):** Administrador concurrente de sesiones aisladas por `cliente_id`.

### Candado de Tenant Base (`mallas_tlaxcalli`)
* El correo **`ferrergbryanu10@gmail.com`** está anclado de forma permanente e inmutable al tenant **`mallas_tlaxcalli`** (`protegido = 1`, `modelo_negocio = 'DISTRIBUIDOR_B2B'`).
* Conserva su directorio exclusivo `sesion_whatsapp_tlaxcalli/` (bloqueado contra borrado con `HTTP 403`), sus prospectos históricos, bitácora y reglas de paquete (`$1,713 MXN`).
* Cualquier correo nuevo de Google inicia con paneles en blanco (`0` leads, `0` pedidos, Bóveda aislada por `userId` en Supabase) y moldea toda la plataforma al completar **`01 • IDEA`**.

---

## 2. Clasificador Inteligente de 3 Modelos (`POST /api/diagnosticar-modelo`)
Al escribir su producto o servicio en **`01 • IDEA`**, Gemini evalúa el negocio (`timeout` de `8s` con fallback heurístico por palabras clave) y recomienda uno de **3 motores operativos**:

| Código de Modelo | Perfil de Negocio | Cazador 24/7 y Mensajes en Frío | Rol de Andrea IA y Cierre (Módulos 2 y 3) |
| :--- | :--- | :--- | :--- |
| **`DISTRIBUIDOR_B2B`** | Venta de insumos, refacciones, mayoreo o productos físicos a empresas/comercios. | **Activo:** Busca negocios en INEGI, Maps y Facebook + primer contacto en frío (máx. `30/día`, pausa `8.5–12 min`, `06:00–22:59` CDMX). | Cotiza paquetes por volumen, valida compatibilidad y cierra pedidos con envío o contra entrega. |
| **`SERVICIOS_B2B`** | Instalaciones técnicas (redes, cableado, CCTV), mantenimiento industrial, obra o consultoría. | **Activo (Corporativo):** Prospecta oficinas, bodegas, clínicas, escuelas y locales comerciales + contacto consultivo. | Califica alcance técnico en sitio y adapta los formularios de Módulo 2/3 para agendar **levantamientos o visitas técnicas**. |
| **`EMPRENDEDOR_B2C`** | Venta directa al consumidor final, catálogos (ej. Tupperware), comida local o comercio minorista. | **Apagado (`0` envíos en frío):** Bloquea scraping automático y spam a particulares para evitar reportes y suspensión de WhatsApp. | **100% Inbound 24/7:** Atiende y cierra pedidos de clientes atraídos mediante los anuncios creados en **`03 • ESTUDIO`** con enlaces `wa.me`. |

---

## 3. Arquitectura del Puente WhatsApp Multi-Sesión (`puente_whatsapp_qr.js`)
* **Aislamiento en disco y memoria:** `sesiones = new Map()` mapea cada `cliente_id` sanitizado hacia su propia carpeta `sesiones_wa/<cliente_id>/` (excepto `mallas_tlaxcalli`, que permanece en `sesion_whatsapp_tlaxcalli/`).
* **Protección contra corrupción de llaves (`Bad MAC` / `401`):** Lock `vinculando: true` por sesión en `/vincular_wa` y cierre limpio (`sock?.ws?.close()`) antes de regenerar QR o código de 8 dígitos.
* **Control de recursos en VPS:** Limpieza automática de memoria (`sesiones.delete`) tras `5 minutos` si una sesión nueva no completa su vinculación, y arranque escalonado (`5–45s` de offset aleatorio) para evitar colisiones `database is locked` en SQLite.
* **Enrutamiento bidireccional:** Cada socket envía su `cliente_id` explícito en `messages.upsert` al servidor Python `8090`, garantizando que Andrea responda con el catálogo exacto del negocio dueño de esa línea.

---

## 4. Matriz Comercial de Planes (Referencia para Pasarela de Pagos)

| Característica / Módulo | Plan Emprendedor (`EMPRENDEDOR_B2C`) | Plan Distribuidor / Servicios (`B2B`) | Plan Agencia / Multi-Nicho |
| :--- | :--- | :--- | :--- |
| **Precio sugerido** | **$349 – $499 MXN / mes** | **$1,499 – $1,999 MXN / mes** | **$3,499+ MXN / mes** |
| **Negocios por cuenta** | `1` negocio activo | `1` negocio activo | Múltiples negocios / líneas en paralelo |
| **`03 • ESTUDIO` (Publicidad IA)** | **Incluido** (flyers, copys y enlaces `wa.me`) | **Incluido** (creatividades y ofertas B2B) | **Incluido** (multi-marca) |
| **WhatsApp + Andrea IA** | **Inbound 24/7** (cierre de tráfico entrante) | **Inbound + Outbound** (hasta `30` leads/día) | Múltiples sesiones Baileys aisladas |
| **Módulo 1: Cazador 24/7** | **Desactivado** (protección anti-baneo) | **Activo 24/7** (INEGI, Maps, Facebook) | **Activo 24/7** con rotación multi-nicho |
| **Módulos 2 y 3 (Cierre/Logística)** | **Incluido** (pedidos y entregas locales) | **Incluido** (paquetes o visitas técnicas) | **Incluido** + panel consolidado |
| **Costo de infraestructura** | **Bajo** (sin consumo de Apify ni scraping) | **Medio** (créditos Apify + Worker 24/7) | **Escalable** por tenant conectado |
