import { NextRequest, NextResponse } from "next/server";
import { obtenerPlanesDesdeRedis, buscarPlan, precioConDescuento } from "@/lib/planes";
import { guardarPagoPendiente } from "@/lib/pagos";
import { generarReferenciaExterna } from "@/lib/ids";
import { obtenerTokenNave, NAVE_PAYMENT_URL } from "@/lib/nave";

// ──────────────────────────────────────────────────────────────
// Integración con Nave (Banco Galicia) para crear una intención
// de pago. En mobile redirige automáticamente a MODO/billeteras
// bancarias, resolviendo el problema de apertura de app.
//
// Variables de entorno necesarias en Vercel:
//   NAVE_CLIENT_ID       → client_id provisto por Nave
//   NAVE_CLIENT_SECRET   → client_secret provisto por Nave
//   NAVE_POS_ID          → ID del punto de venta en Nave
//   NAVE_AUDIENCE        → https://naranja.com/ranty/merchants/api
//   NAVE_SANDBOX         → "true" para usar sandbox, vacío para producción
// ──────────────────────────────────────────────────────────────

export async function POST(solicitud: NextRequest) {
  const cuerpo = await solicitud.json();
  const { planId, clientMac, apMac, redirectUrl, ssidName, site } = cuerpo;

  const planes = await obtenerPlanesDesdeRedis();
  const plan = buscarPlan(planId, planes);
  if (!plan) {
    return NextResponse.json({ error: "Plan inválido" }, { status: 400 });
  }

  const precioFinal = precioConDescuento(plan);

  const referenciaExterna = generarReferenciaExterna();

  const origen = solicitud.nextUrl.origin;

  try {
    const token = await obtenerTokenNave();

    const respuesta = await fetch(NAVE_PAYMENT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          external_payment_id: referenciaExterna,
          seller: {
            pos_id: process.env.NAVE_POS_ID,
          },
          transactions: [
            {
              amount: {
                currency: "ARS",
                value: precioFinal.toFixed(2),
              },
              products: [
                {
                  name: `WiFi Surcante - ${plan.nombre}`,
                  description: plan.descripcion,
                  quantity: 1,
                  unit_price: {
                    currency: "ARS",
                    value: precioFinal.toFixed(2),
                  },
                },
              ],
            },
          ],
          additional_info: {
            callback_url: `${origen}/pagado?plan=${plan.id}&preferenciaId=${referenciaExterna}`,
          },
          // La intención expira en 10 minutos (600 segundos),
          // suficiente para que el pasajero complete el pago.
          duration_time: 600,
        }),
      }
    );

    const datos = await respuesta.json();

    if (!datos.checkout_url) {
      throw new Error(`Nave no devolvió checkout_url: ${JSON.stringify(datos)}`);
    }

    // Guardamos el pago pendiente para procesarlo cuando llegue
    // la notificación de Nave vía webhook.
    await guardarPagoPendiente({
      preferenciaId: referenciaExterna,
      planId: plan.id,
      duracionMinutos: plan.duracionMinutos,
      clientMac: clientMac ?? "",
      apMac: apMac ?? "",
      ssidName: ssidName ?? "",
      site: site || process.env.OMADA_DEFAULT_SITE || "",
      redirectUrl: redirectUrl ?? "",
      creadoEn: Date.now(),
      confirmadoEn: null,
      monto: precioFinal,
      procesador: "nave" as const,
    });

    console.log(
      "[crear-pago-nave] Intención creada:",
      referenciaExterna,
      "Plan:",
      plan.nombre
    );

    return NextResponse.json({
      urlPago: datos.checkout_url,
      preferenciaId: referenciaExterna,
    });
  } catch (error) {
    console.error("[crear-pago-nave] Error:", error);
    return NextResponse.json(
      { error: "No pudimos iniciar el pago con Nave" },
      { status: 500 }
    );
  }
}