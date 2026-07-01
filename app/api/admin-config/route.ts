import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const KEY_CONFIG = "config:medios-pago";

export type ConfigMediosPago = {
  nave: boolean;
  mp: boolean;
  whatsapp: boolean;
};

const CONFIG_DEFAULT: ConfigMediosPago = {
  nave: true,
  mp: true,
  whatsapp: true,
};

function verificarAdmin(solicitud: NextRequest): boolean {
  const clave = solicitud.headers.get("x-admin-key");
  return clave === process.env.CLAVE_ADMIN;
}

export async function GET() {
  const datos = await redis.get<string>(KEY_CONFIG);
  if (!datos) return NextResponse.json(CONFIG_DEFAULT);
  const config = typeof datos === "string" ? JSON.parse(datos) : datos;
  return NextResponse.json({ ...CONFIG_DEFAULT, ...config });
}

export async function POST(solicitud: NextRequest) {
  if (!verificarAdmin(solicitud)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const cuerpo = await solicitud.json();
  await redis.set(KEY_CONFIG, JSON.stringify(cuerpo));
  return NextResponse.json({ ok: true });
}
