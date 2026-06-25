import { NextRequest, NextResponse } from "next/server";
import { buscarPlan } from "@/lib/planes";
import { guardarPagoPendiente } from "@/lib/pagos";

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
// ──────────────────────────────────────────────────────────────

async function obtenerTokenNave(): Promise<string> {
  const respuesta = await fetch(
    "https://services.apinaranja.com/security-ms/api/security/auth0/b2b/m2msPrivate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.NAVE_CLIENT_ID,
        client_secret: process.env.NAVE_CLIENT_SECRET,
        audience: process.env.NAVE_AUDIENCE ?? "https://naranja.com/ranty/merchants/api",
      }),
    }
  );
  const datos = await respuesta.json();
  if (!datos.access_token) {
    throw new Error(`No se pudo obtener token de Nave: ${JSON.stringify(datos)}`);
  }
  return datos.access_token;
}

export async function POST(solicitud: NextRequest) {
  const cuerpo = await solicitud.json();
  const { planId, clientMac, apMac, redirectUrl, ssidName, site } = cuerpo;

  const plan = buscarPlan(planId);
  if (!plan) {
    return NextResponse.json({ error: "Plan inválido" }, { status: 400 });
  }

  const referenciaExterna = `surcante-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const origen = solicitud.nextUrl.origin;

  try {
    const token = await obtenerTokenNave();

    const respuesta = await fetch(
      "https://api.ranty.io/api/payment_request/ecommerce",
      {
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
                value: plan.precio.toFixed(2),
              },
              products: [
                {
                  name: `WiFi Surcante - ${plan.nombre}`,
                  description: plan.descripcion,
                  quantity: 1,
                  unit_price: {
                    currency: "ARS",
                    value: plan.precio.toFixed(2),
                  },
                },
              ],
            },
          ],
          additional_info: {
            callback_url: `${origen}/pagado?plan=${plan.id}`,
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
    guardarPagoPendiente({
      preferenciaId: referenciaExterna,
      planId: plan.id,
      duracionMinutos: plan.duracionMinutos,
      clientMac: clientMac ?? "",
      apMac: apMac ?? "",
      ssidName: ssidName ?? "",
      site: site ?? "",
      redirectUrl: redirectUrl ?? "",
      creadoEn: Date.now(),
      confirmadoEn: null,
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
