import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, esAdminEmail } from "@/lib/auth";

// El panel admin se autentica en todos los demás endpoints con el header
// x-admin-key (comparado contra CLAVE_ADMIN). Esta ruta es el puente entre
// una sesión válida de Google (NextAuth) y ese esquema: si hay sesión y el
// email está autorizado, devuelve CLAVE_ADMIN para que el front la use como
// si el usuario hubiera tipeado la clave manualmente.
export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email || !esAdminEmail(email)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  return NextResponse.json({ token: process.env.CLAVE_ADMIN });
}
