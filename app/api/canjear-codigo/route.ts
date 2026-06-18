import { NextRequest, NextResponse } from "next/server";
import { usarCodigo } from "@/lib/codigos";

export async function POST(solicitud: NextRequest) {
  const cuerpo = await solicitud.json();
  const { codigo, clientMac } = cuerpo;

  if (!codigo || !clientMac) {
    return NextResponse.json(
      { exito: false, motivo: "Faltan datos" },
      { status: 400 }
    );
  }

  const resultado = usarCodigo(codigo, clientMac);

  // ──────────────────────────────────────────────────────────
  // ACA VA OMADA: cuando resultado.exito es true, hay que llamar
  // a la API del controlador Omada para autorizar a clientMac de
  // forma ilimitada en el tiempo (sin fecha de expiración), igual
  // que el resto de los planes pero sin el paso de Mercado Pago.
  // ──────────────────────────────────────────────────────────

  return NextResponse.json(resultado);
}
