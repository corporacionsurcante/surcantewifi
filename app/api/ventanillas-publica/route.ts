import { NextResponse } from "next/server";
import { listarVentanillas } from "@/lib/ventanillas";

// Endpoint público (sin clave de admin): solo expone los números de
// ventanilla disponibles, para que el pasajero elija cuál escanear.
// No expone external_id ni ningún dato interno de Mercado Pago.
export async function GET() {
  const ventanillas = await listarVentanillas();
  return NextResponse.json({
    numeros: ventanillas.map((v) => v.numero),
  });
}
