import { NextRequest, NextResponse } from "next/server";
import { crearCodigo, listarTodosLosCodigos } from "@/lib/codigos";

function verificarAdmin(solicitud: NextRequest): boolean {
  const clave = solicitud.headers.get("x-admin-key");
  return clave === process.env.CLAVE_ADMIN;
}

export async function GET(solicitud: NextRequest) {
  if (!verificarAdmin(solicitud)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const codigos = await listarTodosLosCodigos();
  return NextResponse.json({ codigos });
}

export async function POST(solicitud: NextRequest) {
  if (!verificarAdmin(solicitud)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const cuerpo = await solicitud.json().catch(() => ({}));
  const creadoPor = cuerpo.creadoPor ?? "ADMIN";
  const cantidad = Math.min(Number(cuerpo.cantidad) || 1, 50);
  const codigos = await Promise.all(Array.from({ length: cantidad }, () => crearCodigo(creadoPor)));
  return NextResponse.json({ codigos });
}
