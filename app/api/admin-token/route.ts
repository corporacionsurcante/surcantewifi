import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Retorna el token de admin si el usuario tiene una sesión Google válida.
// Esto permite que el panel admin funcione con Google OAuth sin exponer
// CLAVE_ADMIN en el cliente directamente.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const token = process.env.CLAVE_ADMIN;
    if (!token) {
      return NextResponse.json({ error: "Configuración incompleta" }, { status: 500 });
    }
    return NextResponse.json({ token });
  } catch {
    return NextResponse.json({ error: "Error de sesión" }, { status: 500 });
  }
}
