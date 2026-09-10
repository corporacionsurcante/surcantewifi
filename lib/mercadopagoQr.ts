// ──────────────────────────────────────────────────────────────
// Integración con el "QR en el local" de Mercado Pago (el mismo
// producto que usan los comercios: un QR impreso y pegado, que
// siempre es el mismo cartel pero cobra el importe que le hayamos
// indicado por API justo antes de que lo escaneen). Esto es un
// producto DISTINTO al Checkout Pro que ya se usa en
// app/api/crear-pago/route.ts.
//
// Documentación oficial usada como referencia (API "QR Code" /
// "Instore orders", Mercado Pago Developers):
//   - Crear sucursal:        POST /users/{user_id}/stores
//   - Crear caja (POS + QR): POST /pos
//   - Fijar importe del QR:  PUT  /instore/orders/qr/seller/collectors/{user_id}/pos/{external_pos_id}/qrs
//
// REQUISITO: la cuenta de Mercado Pago tiene que tener habilitado
// "Cobrar con QR" / Punto de venta (lo confirmamos con Surcante
// antes de escribir este archivo). Usa el mismo
// MERCADOPAGO_ACCESS_TOKEN que ya está configurado para Checkout
// Pro; no hace falta un token distinto.
//
// Variable opcional:
//   MERCADOPAGO_POS_CATEGORY → código de rubro (MCC) a usar al crear
//   una caja. Por defecto NO se envía (Mercado Pago la deja sin
//   categoría), porque los valores válidos no están documentados
//   públicamente y enviar uno inventado causa el error
//   "pos_unknown_mcc". Solo configurar esta variable si Mercado
//   Pago Soporte confirma el código correcto para la cuenta.
//
// Variables opcionales (dirección fiscal de la sucursal): Mercado
// Pago exige una ubicación física para crear la "sucursal" aunque
// las ventanillas estén en un ómnibus. Por defecto se usa la
// dirección de Surcante (Av. General Paz 12235, partido de La
// Matanza, Buenos Aires — Mercado Pago valida city_name contra su
// propia lista de partidos/localidades, no acepta cualquier texto).
// Si cambia el domicilio, se puede sobreescribir con:
//   MERCADOPAGO_STORE_STREET_NUMBER, MERCADOPAGO_STORE_STREET_NAME,
//   MERCADOPAGO_STORE_CITY, MERCADOPAGO_STORE_STATE,
//   MERCADOPAGO_STORE_LAT, MERCADOPAGO_STORE_LON
// ──────────────────────────────────────────────────────────────

import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const MP_API = "https://api.mercadopago.com";
const EXTERNAL_ID_TIENDA = "surcante-flota";

function encabezados() {
  return {
    Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  };
}

/**
 * ID de la cuenta (collector) de Mercado Pago dueña del token. Se
 * necesita para armar varias URLs de la API. Se cachea en Redis
 * porque no cambia nunca para esta cuenta.
 */
export async function obtenerCollectorId(): Promise<string> {
  const clave = "mp:collector_id";
  const cacheado = await redis.get<string>(clave);
  if (cacheado) return String(cacheado);

  const respuesta = await fetch(`${MP_API}/users/me`, {
    headers: encabezados(),
  });
  const datos = await respuesta.json();
  if (!respuesta.ok || !datos.id) {
    throw new Error(
      `No se pudo obtener el ID de la cuenta de Mercado Pago: ${JSON.stringify(datos)}`
    );
  }
  await redis.set(clave, String(datos.id));
  return String(datos.id);
}

/**
 * Devuelve el ID de la sucursal ("store") donde se crean todas las
 * ventanillas. La crea la primera vez; en las siguientes llamadas
 * reutiliza la que ya existe.
 */
export async function obtenerOCrearTienda(): Promise<string> {
  const clave = "mp:store_id";
  const cacheado = await redis.get<string>(clave);
  if (cacheado) return String(cacheado);

  const collectorId = await obtenerCollectorId();

  // Mercado Pago exige una dirección física para la sucursal (afecta
  // validación fiscal y facturación), aunque las ventanillas en
  // realidad estén en un ómnibus. Se usa la dirección de la empresa
  // como referencia fiscal, configurable por variables de entorno
  // por si cambia de domicilio.
  const location = {
    street_number: process.env.MERCADOPAGO_STORE_STREET_NUMBER || "12235",
    street_name: process.env.MERCADOPAGO_STORE_STREET_NAME || "Avenida General Paz",
    city_name: process.env.MERCADOPAGO_STORE_CITY || "La Matanza",
    state_name: process.env.MERCADOPAGO_STORE_STATE || "Buenos Aires",
    latitude: Number(process.env.MERCADOPAGO_STORE_LAT || "-34.6579926"),
    longitude: Number(process.env.MERCADOPAGO_STORE_LON || "-58.5244947"),
  };

  const creacion = await fetch(`${MP_API}/users/${collectorId}/stores`, {
    method: "POST",
    headers: encabezados(),
    body: JSON.stringify({
      name: "Surcante - Flota",
      external_id: EXTERNAL_ID_TIENDA,
      location,
    }),
  });
  const datosCreacion = await creacion.json();

  if (creacion.ok && datosCreacion.id) {
    await redis.set(clave, String(datosCreacion.id));
    return String(datosCreacion.id);
  }

  // Si falla porque ya existía (por ejemplo, se perdió el valor
  // cacheado), buscamos la sucursal existente por su external_id
  // en vez de fallar.
  const listado = await fetch(
    `${MP_API}/users/${collectorId}/stores/search`,
    { headers: encabezados() }
  );
  const datosListado = await listado.json();
  const existente = (datosListado.results ?? []).find(
    (tienda: { external_id?: string; id?: number }) =>
      tienda.external_id === EXTERNAL_ID_TIENDA
  );
  if (existente?.id) {
    await redis.set(clave, String(existente.id));
    return String(existente.id);
  }

  throw new Error(
    `No se pudo crear ni encontrar la sucursal en Mercado Pago: ${JSON.stringify(datosCreacion)}`
  );
}

export type VentanillaCreada = {
  numero: number;
  externalId: string;
  posId: number;
  nombre: string;
  qrImageUrl: string;
  creadoEn: number;
};

/**
 * Crea una caja (POS) nueva en Mercado Pago para el número de
 * ventanilla indicado. Cada una tiene su propio QR físico e
 * independiente: dos ventanillas nunca comparten el mismo cobro
 * pendiente, así que varios pasajeros pueden pagar a la vez.
 */
export async function crearVentanillaPos(
  numero: number
): Promise<VentanillaCreada> {
  const storeId = await obtenerOCrearTienda();
  const externalId = `surcante-ventanilla-${numero}`;
  const nombre = `Ventanilla ${numero}`;
  // El código de rubro (MCC) es opcional para Mercado Pago y sus
  // valores válidos no están documentados públicamente; enviar uno
  // inventado (como el 5541 que se usaba antes) provoca el error
  // "pos_unknown_mcc". Por eso solo se envía si se configuró
  // explícitamente un valor correcto para la cuenta.
  const categoria = process.env.MERCADOPAGO_POS_CATEGORY
    ? Number(process.env.MERCADOPAGO_POS_CATEGORY)
    : undefined;

  const respuesta = await fetch(`${MP_API}/pos`, {
    method: "POST",
    headers: encabezados(),
    body: JSON.stringify({
      name: nombre,
      fixed_amount: false,
      store_id: Number(storeId),
      external_id: externalId,
      ...(categoria !== undefined ? { category: categoria } : {}),
    }),
  });
  const datos = await respuesta.json();

  if (!respuesta.ok || !datos.id) {
    throw new Error(
      `No se pudo crear el punto de venta "${nombre}" en Mercado Pago: ${JSON.stringify(datos)}`
    );
  }

  return {
    numero,
    externalId,
    posId: datos.id,
    nombre,
    qrImageUrl: datos.qr?.image ?? "",
    creadoEn: Date.now(),
  };
}

export type ResultadoOrdenQr = {
  exito: boolean;
  motivo?: string;
};

/**
 * Fija el importe a cobrar en el QR de una ventanilla específica,
 * justo antes de indicarle al pasajero que la escanee. A partir de
 * ese momento, la próxima persona que escanee ese QR va a ver ese
 * importe en la app de Mercado Pago. Cuando pague, Mercado Pago
 * notifica por el mismo webhook de pagos que ya usa Checkout Pro
 * (app/api/webhook-pago/route.ts), porque este identifica el pago
 * por su external_reference sin importar de qué medio vino.
 */
export async function fijarImportePagoQr(parametros: {
  externalPosId: string;
  monto: number;
  referenciaExterna: string;
  descripcion: string;
  origen: string;
}): Promise<ResultadoOrdenQr> {
  const collectorId = await obtenerCollectorId();

  try {
    const respuesta = await fetch(
      `${MP_API}/instore/orders/qr/seller/collectors/${collectorId}/pos/${parametros.externalPosId}/qrs`,
      {
        method: "PUT",
        headers: encabezados(),
        body: JSON.stringify({
          external_reference: parametros.referenciaExterna,
          title: parametros.descripcion,
          notification_url: `${parametros.origen}/api/webhook-pago`,
          total_amount: parametros.monto,
          items: [
            {
              sku_number: parametros.referenciaExterna,
              category: "others",
              title: parametros.descripcion,
              description: parametros.descripcion,
              unit_price: parametros.monto,
              quantity: 1,
              unit_measure: "unit",
              total_amount: parametros.monto,
            },
          ],
        }),
      }
    );

    if (!respuesta.ok) {
      const texto = await respuesta.text();
      console.error(
        "[mercadopagoQr] Error al fijar el importe del QR:",
        respuesta.status,
        texto
      );
      return {
        exito: false,
        motivo: "No se pudo preparar el cobro en esa ventanilla",
      };
    }

    return { exito: true };
  } catch (error) {
    console.error("[mercadopagoQr] Error de red al fijar el importe:", error);
    return { exito: false, motivo: "No se pudo conectar con Mercado Pago" };
  }
}
