import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { autorizarClienteEnOmada } from "@/lib/omada";

const redis = Redis.fromEnv();
const CLAVE_FLUJO_MP = "mp:flujo:";
const UN_MINUTO = 1;

export async function POST(solicitud: NextRequest) {
  const cuerpo = await solicitud.json();
  const { clientMac, apMac, ssidName, site, planId } = cuerpo ?? {};

  if (!clientMac || !planId) {
    return NextResponse.json(
      { exito: false, motivo: "Faltan datos para activar el minuto libre" },
      { status: 400 }
    );
  }

  const resultadoOmada = await autorizarClienteEnOmada({
    clientMac,
    apMac: apMac ?? "",
    ssidName: ssidName ?? "",
    site: site ?? "",
    minutos: UN_MINUTO,
  });

  if (!resultadoOmada.exito) {
    return NextResponse.json(
      {
        exito: false,
        motivo:
          resultadoOmada.motivo ??
          "No pudimos activar el minuto libre en este momento",
      },
      { status: 500 }
    );
  }

  await redis.set(
    `${CLAVE_FLUJO_MP}${clientMac}`,
    JSON.stringify({
      planId,
      habilitadoEn: Date.now(),
      expiracionMs: Date.now() + 15 * 60 * 1000,
    }),
    { ex: 60 * 15 }
  );

  return NextResponse.json({
    exito: true,
    minutos: UN_MINUTO,
  });
}
