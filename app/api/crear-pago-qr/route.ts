import { NextRequest, NextResponse } from "next/server";
import { obtenerPlanesDesdeRedis, buscarPlan } from "@/lib/planes";
import { buscarVentanilla } from "@/lib/ventanillas";
import { fijarImportePagoQr } from "@/lib/mercadopagoQr";
import { guardarPagoPendiente } from "@/lib/pagos";

// A diferencia de /api/crear-pago (Checkout Pro), acá no se genera
// ningún link ni se redirige a nadie: el QR ya está pegado en la
// ventanilla física. Lo único que hacemos es indicarle a Mercado
// Pago qué importe cobrar la próxima vez que alguien escanee ESE
// QR en particular, y guardar el pago pendiente para reconocerlo
// cuando llegue la confirmación (mismo webhook de siempre).
export async function POST(solicitud: NextRequest) {
  const cuerpo = await solicitud.json();
  const {
    planId,
    numeroVentanilla,
    clientMac,
    apMac,
    redirectUrl,
    ssidName,
    site,
  } = cuerpo;

  // Busca el plan desde Redis primero para respetar precios actualizados en el admin
  const planes = await obtenerPlanesDesdeRedis();
  const plan = buscarPlan(planId, planes);
  if (!plan) {
    return NextResponse.json({ error: "Plan inválido" }, { status: 400 });
  }

  const numero = Number(numeroVentanilla);
  if (!numero) {
    return NextResponse.json(
      { error: "Falta indicar el número de ventanilla" },
      { status: 400 }
    );
  }

  const ventanilla = await buscarVentanilla(numero);
  if (!ventanilla) {
    return NextResponse.json(
      { error: "Esa ventanilla no existe" },
      { status: 404 }
    );
  }

  // Precio efectivo: aplica descuento si hay promoción activa
  const precioFinal = plan.descuento > 0
    ? Math.round(plan.precio * (1 - plan.descuento / 100))
    : plan.precio;

  const referenciaExterna = `surcante-qr-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const origen = solicitud.nextUrl.origin;

  const resultado = await fijarImportePagoQr({
    externalPosId: ventanilla.externalId,
    monto: precioFinal,
    referenciaExterna,
    descripcion: `WiFi Surcante - ${plan.nombre}`,
    origen,
  });

  if (!resultado.exito) {
    return NextResponse.json(
      { error: resultado.motivo ?? "No se pudo preparar el cobro" },
      { status: 502 }
    );
  }

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
    procesador: "mp-qr",
    ventanilla: numero,
  });

  console.log(
    "[crear-pago-qr] Importe fijado en ventanilla",
    numero,
    "Plan:",
    plan.nombre,
    "Precio:",
    precioFinal,
    "Referencia:",
    referenciaExterna
  );

  return NextResponse.json({
    ok: true,
    ventanilla: numero,
    preferenciaId: referenciaExterna,
  });
}

