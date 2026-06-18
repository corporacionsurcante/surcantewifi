import { NextRequest, NextResponse } from "next/server";
import { generarCodigo, listarCodigos } from "@/lib/codigos";

function estaAutorizado(solicitud: NextRequest): boolean {
  const claveEnviada = solicitud.headers.get("x-clave-admin");
  const claveReal = process.env.CLAVE_ADMIN;
  return Boolean(claveReal) && claveEnviada === claveReal;
}

export async function GET(solicitud: NextRequest) {
  if (!estaAutorizado(solicitud)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return NextResponse.json({ codigos: listarCodigos() });
}

export async function POST(solicitud: NextRequest) {
  if (!estaAutorizado(solicitud)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const cuerpo = await solicitud.json();
  const nota = typeof cuerpo.nota === "string" ? cuerpo.nota : "";
  const nuevoCodigo = generarCodigo(nota);
  return NextResponse.json({ codigo: nuevoCodigo });
}
