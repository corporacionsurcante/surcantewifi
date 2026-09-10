import { NextRequest, NextResponse } from "next/server";
import {
  listarVentanillas,
  guardarVentanilla,
  siguienteNumeroDisponible,
} from "@/lib/ventanillas";
import { crearVentanillaPos } from "@/lib/mercadopagoQr";

function verificarAdmin(solicitud: NextRequest): boolean {
  const clave = solicitud.headers.get("x-admin-key");
  return clave === process.env.CLAVE_ADMIN;
}

export async function GET(solicitud: NextRequest) {
  if (!verificarAdmin(solicitud)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const ventanillas = await listarVentanillas();
  return NextResponse.json({ ventanillas });
}

export async function POST(solicitud: NextRequest) {
  if (!verificarAdmin(solicitud)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const cuerpo = await solicitud.json();
  const cantidad = Math.min(60, Math.max(1, Number(cuerpo.cantidad) || 1));

  const creadas = [];
  const errores: string[] = [];
  const primerNumero = await siguienteNumeroDisponible();

  for (let i = 0; i < cantidad; i++) {
    const numero = primerNumero + i;
    try {
      const ventanilla = await crearVentanillaPos(numero);
      await guardarVentanilla(ventanilla);
      creadas.push(ventanilla);
    } catch (error) {
      const motivo =
        error instanceof Error
          ? error.message
          : `Error desconocido al crear la ventanilla ${numero}`;
      console.error("[admin-ventanillas] Error creando ventanilla", numero, motivo);
      errores.push(motivo);
      // Si falla una, cortamos acá para no dejar huecos de numeración
      // ni seguir gastando llamadas a Mercado Pago si el problema
      // (por ejemplo, categoría inválida) se va a repetir en todas.
      break;
    }
  }

  return NextResponse.json({ creadas, errores });
}
