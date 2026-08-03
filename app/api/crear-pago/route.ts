import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { obtenerPlanesDesdeRedis, buscarPlan, precioConDescuento } from "@/lib/planes";
import { guardarPagoPendiente } from "@/lib/pagos";
import { generarReferenciaExterna } from "@/lib/ids";

const cliente = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});

export async function POST(solicitud: NextRequest) {
  const cuerpo = await solicitud.json();
  const { planId, clientMac, apMac, redirectUrl, ssidName, site } = cuerpo;

  // Busca el plan desde Redis primero para respetar precios actualizados en el admin
  const planes = await obtenerPlanesDesdeRedis();
  const plan = buscarPlan(planId, planes);
  if (!plan) {
    return NextResponse.json({ error: "Plan inválido" }, { status: 400 });
  }

  // Precio efectivo: aplica descuento si hay promoción activa
  const precioFinal = precioConDescuento(plan);

  const referenciaExterna = generarReferenciaExterna();

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
            unit_price: precioFinal,
            currency_id: "ARS",
          },
        ],
        external_reference: referenciaExterna,
        notification_url: `${origen}/api/webhook-pago`,
        back_urls: {
          success: `${origen}/pagado?plan=${plan.id}&preferenciaId=${referenciaExterna}`,
          pending: `${origen}/pagado?plan=${plan.id}&preferenciaId=${referenciaExterna}`,
          failure: `${origen}/error`,
        },
        auto_return: "approved",
      },
    });

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
      procesador: "mp" as const,
    });

    console.log(
      "[crear-pago] Preferencia creada:",
      referenciaExterna,
      "Plan:",
      plan.nombre,
      "Precio:",
      precioFinal,
      "MAC cliente:",
      clientMac
    );

    // Usamos mobile_init_point cuando está disponible: es la URL que Mercado Pago
    // optimiza para móvil. En Safari/Chrome actúa como Universal Link / App Link
    // y abre la app de MP directamente (sin pedir login). Fallback al init_point estándar.
    const urlPago = (resultado as { mobile_init_point?: string; init_point?: string }).mobile_init_point
      ?? resultado.init_point
      ?? `https://www.mercadopago.com.ar/checkout/v1/redirect?preference-id=${resultado.id}`;

    return NextResponse.json({
      urlPago,
      preferenciaId: referenciaExterna,
      mpPreferenceId: resultado.id,
    });
  } catch (error) {
    console.error("[crear-pago] Error al crear la preferencia:", error);
    return NextResponse.json(
      { error: "No pudimos iniciar el pago" },
      { status: 500 }
    );
  }
}