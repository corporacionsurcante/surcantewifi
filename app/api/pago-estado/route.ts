import { NextRequest, NextResponse } from "next/server";
import { buscarPago } from "@/lib/pagos";

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

  return NextResponse.json({
    existe: true,
    confirmado: Boolean(pago.confirmadoEn),
    confirmadoEn: pago.confirmadoEn,
    planId: pago.planId,
    clientMac: pago.clientMac,
  });
}
