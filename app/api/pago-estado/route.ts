import { NextRequest, NextResponse } from "next/server";
import { buscarPago } from "@/lib/pagos";
import { obtenerPlanesDesdeRedis } from "@/lib/planes";

export async function GET(solicitud: NextRequest) {
  const preferenciaId = solicitud.nextUrl.searchParams.get("preferenciaId");

  if (!preferenciaId) {
    return NextResponse.json(
      { error: "preferenciaId es requerido" },
      { status: 400 }
    );
  }

  const pago = await buscarPago(preferenciaId);
  if (!pago) {
    return NextResponse.json({ existe: false });
  }

  const planes = await obtenerPlanesDesdeRedis();
  const plan = planes.find((p) => p.id === pago.planId);
  const planNombre = plan?.nombre ?? pago.planId;

  return NextResponse.json({
    existe: true,
    confirmado: Boolean(pago.confirmadoEn),
    confirmadoEn: pago.confirmadoEn,
    planId: pago.planId,
    clientMac: pago.clientMac,
    duracionMinutos: pago.duracionMinutos,
    planNombre,
  });
}