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

  const referenciaExterna = `surcante-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

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

    // mobile_init_point abre la app de Mercado Pago en iOS y Android.
    // init_point es el fallback para navegador de escritorio.
    return NextResponse.json({
      urlPago: resultado.mobile_init_point ?? resultado.init_point,
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
