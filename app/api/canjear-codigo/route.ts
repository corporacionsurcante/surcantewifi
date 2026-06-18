import { NextRequest, NextResponse } from "next/server";
import { usarCodigo } from "@/lib/codigos";
import { autorizarClienteEnOmada } from "@/lib/omada";

// Omada necesita un tiempo concreto de expiración, no tiene un
// concepto real de "acceso ilimitado". Usamos un año como una
// aproximación práctica para los códigos de acceso libre.
const UN_ANIO_EN_MINUTOS = 60 * 24 * 365;

export async function POST(solicitud: NextRequest) {
  const cuerpo = await solicitud.json();
  const { codigo, clientMac, apMac, ssidName, site } = cuerpo;

  if (!codigo || !clientMac) {
    return NextResponse.json(
      { exito: false, motivo: "Faltan datos" },
      { status: 400 }
    );
  }

  const resultado = usarCodigo(codigo, clientMac);

  if (resultado.exito) {
    const resultadoOmada = await autorizarClienteEnOmada({
      clientMac,
      apMac: apMac ?? "",
      ssidName: ssidName ?? "",
      site: site ?? "",
      minutos: UN_ANIO_EN_MINUTOS,
    });

    if (!resultadoOmada.exito) {
      console.error(
        "[canjear-codigo] El código se validó pero Omada no autorizó el acceso:",
        resultadoOmada.motivo,
        "MAC:",
        clientMac
      );
    }
  }

  return NextResponse.json(resultado);
}
