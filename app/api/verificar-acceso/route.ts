import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { autorizarClienteEnOmada } from "@/lib/omada";

const redis = Redis.fromEnv();
const CLAVE_FLUJO_MP = "mp:flujo:";

// Verifica si una MAC ya tiene acceso activo (pago o código)
// y si es así la reautoriza en Omada automáticamente.
// Se llama desde la landing al cargar, antes de mostrar cualquier cosa.

export async function POST(solicitud: NextRequest) {
  const cuerpo = await solicitud.json();
  const { clientMac, apMac, ssidName, site } = cuerpo;

  if (!clientMac) {
    return NextResponse.json({ tieneAcceso: false });
  }

  try {
    // Buscamos si esta MAC tiene un código activo
    const macKey = `mac:${clientMac}`;
    const datos = await redis.get<string>(macKey);

    if (!datos) {
      const flujoMp = await redis.get<string>(`${CLAVE_FLUJO_MP}${clientMac}`);
      if (!flujoMp) {
        return NextResponse.json({ tieneAcceso: false });
      }

      const flujo = typeof flujoMp === "string" ? JSON.parse(flujoMp) : flujoMp;
      return NextResponse.json({
        tieneAcceso: false,
        conexionTemporalActiva: true,
        continuarPagoMp: true,
        planIdPendiente: flujo.planId ?? null,
      });
    }

    const registro = typeof datos === "string" ? JSON.parse(datos) : datos;

    // Verificamos si el acceso sigue vigente
    // Para códigos: acceso por 1 año desde que se usó
    // Para pagos: acceso por la duración del plan
    const ahora = Date.now();
    const tiempoUsado = registro.usadoEn || registro.confirmadoEn;
    const duracionMs = (registro.duracionMinutos ?? 60 * 24 * 365) * 60 * 1000;
    const expira = tiempoUsado + duracionMs;

    if (ahora > expira) {
      // El acceso venció
      return NextResponse.json({ tieneAcceso: false, motivo: "vencido" });
    }

    // Tiene acceso vigente, lo reautorizamos en Omada
    const minutosRestantes = Math.floor((expira - ahora) / 60000);

    const resultadoOmada = await autorizarClienteEnOmada({
      clientMac,
      apMac: apMac ?? "",
      ssidName: ssidName ?? "",
      site: site ?? "",
      minutos: Math.min(minutosRestantes, 60 * 24 * 365),
    });

    if (resultadoOmada.exito) {
      console.log(
        "[verificar-acceso] Reautorizado automáticamente:",
        clientMac,
        "Minutos restantes:",
        minutosRestantes
      );
      return NextResponse.json({
        tieneAcceso: true,
        minutosRestantes,
        tipo: registro.usadoEn ? "codigo" : "pago",
      });
    }

    return NextResponse.json({ tieneAcceso: false });
  } catch (error) {
    console.error("[verificar-acceso] Error:", error);
    return NextResponse.json({ tieneAcceso: false });
  }
}
