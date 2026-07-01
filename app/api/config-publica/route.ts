import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const KEY_CONFIG = "config:medios-pago";

export async function GET() {
  const datos = await redis.get<string>(KEY_CONFIG);
  const configDefault = { nave: true, mp: true, whatsapp: true };
  if (!datos) return NextResponse.json(configDefault);
  const config = typeof datos === "string" ? JSON.parse(datos) : datos;
  return NextResponse.json({ ...configDefault, ...config });
}
