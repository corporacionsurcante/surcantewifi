import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { autorizarClienteEnOmada } from "@/lib/omada";

const redis = Redis.fromEnv();
const CLAVE_FLUJO_MP = "mp:flujo:";
const MINUTOS_CONEXION_TEMPORAL = 3;

export async function POST(solicitud: NextRequest) {
  const cuerpo = await solicitud.json();
  const { clientMac, apMac, ssidName, site, planId } = cuerpo ?? {};

  if (!clientMac) {
    return NextResponse.json(
      { exito: false, motivo: "Faltan datos para activar la conexión temporal" },
      { status: 400 }
    );
  }

  const rateKey = `rate:minuto:${clientMac}`;
  const rateCount = await redis.incr(rateKey);
  if (rateCount === 1) {
    await redis.expire(rateKey, 86400);
  }
  if (rateCount > 3) {
    return NextResponse.json(
      { error: "Limite de conexiones temporales alcanzado" },
      { status: 429 }
    );
  }

  const resultadoOmada = await autorizarClienteEnOmada({
    clientMac,
    apMac: apMac ?? "",
    ssidName: ssidName ?? "",
    site: site ?? "",
    minutos: MINUTOS_CONEXION_TEMPORAL,
  });

  if (!resultadoOmada.exito) {
    return NextResponse.json(
      {
        exito: false,
        motivo:
          resultadoOmada.motivo ??
          "No pudimos activar la conexión temporal en este momento",
      },
      { status: 500 }
    );
  }

  await redis.set(
    `${CLAVE_FLUJO_MP}${clientMac}`,
    JSON.stringify({
      planId: planId ?? null,
      habilitadoEn: Date.now(),
      expiracionMs: Date.now() + 15 * 60 * 1000,
      tipo: "conexion-temporal",
    }),
    { ex: 60 * 15 }
  );

  return NextResponse.json({
    exito: true,
    minutos: MINUTOS_CONEXION_TEMPORAL,
    portalUrl: solicitud.nextUrl.origin,
  });
}
