import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export type UbicacionBus = {
  interno: string;
  lat: number;
  lon: number;
  precision: number;
  velocidad: number | null;
  rumbo: number | null;
  actualizadoEn: number;
};

export async function POST(solicitud: NextRequest) {
  const cuerpo = await solicitud.json();
  const { interno, lat, lon, precision, velocidad, rumbo } = cuerpo;

  if (!interno || !lat || !lon) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const ubicacion: UbicacionBus = {
    interno,
    lat,
    lon,
    precision: precision ?? 0,
    velocidad: velocidad ?? null,
    rumbo: rumbo ?? null,
    actualizadoEn: Date.now(),
  };

  await redis.set(`bus:${interno}`, JSON.stringify(ubicacion), { ex: 600 });
  await redis.sadd("buses:activos", interno);

  return NextResponse.json({ ok: true });
}

export async function GET(solicitud: NextRequest) {
  const clave = solicitud.headers.get("x-admin-key");
  if (clave !== process.env.CLAVE_ADMIN) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const internos = await redis.smembers("buses:activos");
  const buses: UbicacionBus[] = [];

  for (const interno of internos) {
    const datos = await redis.get<string>(`bus:${interno}`);
    if (datos) {
      const bus = typeof datos === "string" ? JSON.parse(datos) : datos;
      if (Date.now() - bus.actualizadoEn < 600000) {
        buses.push(bus);
      }
    }
  }

  return NextResponse.json({ buses });
}
