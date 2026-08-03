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

  if (internos.length > 0) {
    const keys = (internos as string[]).map((id) => `bus:${id}`);
    const resultados = await redis.mget<string[]>(...keys);
    const ahora = Date.now();
    for (const dato of resultados) {
      if (dato) {
        const bus = typeof dato === "string" ? JSON.parse(dato) : dato as unknown as UbicacionBus;
        if (ahora - bus.actualizadoEn < 600000) {
          buses.push(bus);
        }
      }
    }
  }

  return NextResponse.json({ buses });
}
