import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { buscarPlan } from "@/lib/planes";
import { guardarPagoPendiente } from "@/lib/pagos";

const cliente = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});

export async function POST(solicitud: NextRequest) {
  const cuerpo = await solicitud.json();
  const { planId, clientMac, apMac, redirectUrl, ssidName, site } = cuerpo;

  const plan = buscarPlan(planId);
  if (!plan) {
    return NextResponse.json({ error: "Plan inválido" }, { status: 400 });
  }

  // Identificador único para esta compra. Lo usamos como
  // external_reference para poder reconocer este pago cuando
  // llegue la confirmación al webhook.
  const referenciaExterna = `surcante-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  // Tomamos la URL del sitio desde la propia solicitud, así
  // funciona automáticamente sin importar el dominio (vercel.app
  // o uno propio más adelante).
  const origen = solicitud.nextUrl.origin;

  try {
    const preferencia = new Preference(cliente);
    const resultado = await preferencia.create({
      body: {
        items: [
          {
            id: plan.id,
            title: `WiFi Surcante - ${plan.nombre}`,
            quantity: 1,
            unit_price: plan.precio,
            currency_id: "ARS",
          },
        ],
        external_reference: referenciaExterna,
        notification_url: `${origen}/api/webhook-pago`,
        back_urls: {
          success: `${origen}/pagado?plan=${plan.id}`,
          pending: `${origen}/pagado?plan=${plan.id}`,
          failure: `${origen}/error`,
        },
        auto_return: "approved",
      },
    });

    // Guardamos los datos de esta compra para poder recuperarlos
    // cuando llegue la notificación del webhook.
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
      "[crear-pago] Preferencia creada:",
      referenciaExterna,
      "Plan:",
      plan.nombre,
      "MAC cliente:",
      clientMac
    );

    return NextResponse.json({
      urlPago: resultado.init_point,
      preferenciaId: referenciaExterna,
    });
  } catch (error) {
    console.error("[crear-pago] Error al crear la preferencia:", error);
    return NextResponse.json(
      { error: "No pudimos iniciar el pago" },
      { status: 500 }
    );
  }
}
