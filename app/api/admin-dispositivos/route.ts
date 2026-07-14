import { NextRequest, NextResponse } from "next/server";
import { Agent } from "undici";

const agente = new Agent({ connect: { rejectUnauthorized: false } });

function verificarAdmin(solicitud: NextRequest): boolean {
  return solicitud.headers.get("x-admin-key") === process.env.CLAVE_ADMIN;
}

async function obtenerTokenOmada(urlBase: string, idControlador: string) {
  const respuesta = await fetch(
    `${urlBase}/${idControlador}/api/v2/hotspot/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: process.env.OMADA_OPERATOR_USER,
        password: process.env.OMADA_OPERATOR_PASSWORD,
      }),
      // @ts-expect-error undici dispatcher
      dispatcher: agente,
    }
  );
  const datos = await respuesta.json();
  return {
    token: datos.result?.token ?? "",
    cookie: respuesta.headers.get("set-cookie") ?? "",
  };
}

async function obtenerIdControlador(urlBase: string): Promise<string> {
  const r = await fetch(`${urlBase}/api/info`, {
    // @ts-expect-error undici dispatcher
    dispatcher: agente,
  });
  const d = await r.json();
  return d.result.omadacId;
}

export async function GET(solicitud: NextRequest) {
  if (!verificarAdmin(solicitud)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const urlBase = process.env.OMADA_CONTROLLER_URL;
  if (!urlBase) {
    return NextResponse.json({ error: "Sin configuración de Omada" }, { status: 500 });
  }

  try {
    const idControlador = await obtenerIdControlador(urlBase);
    const { token, cookie } = await obtenerTokenOmada(urlBase, idControlador);

    const headers = {
      "Csrf-Token": token,
      Cookie: cookie,
    };

    // Obtenemos el sitio
    const sitioParam = process.env.OMADA_SITE_ID ?? "Surcante Conectividad";

    // Clientes conectados
    const [clientesResp, apsResp] = await Promise.all([
      fetch(
        `${urlBase}/${idControlador}/api/v2/sites/${encodeURIComponent(sitioParam)}/clients?filters.active=true&page=1&pageSize=100`,
        {
          headers,
          // @ts-expect-error undici dispatcher
          dispatcher: agente,
        }
      ),
      fetch(
        `${urlBase}/${idControlador}/api/v2/sites/${encodeURIComponent(sitioParam)}/eaps?page=1&pageSize=100`,
        {
          headers,
          // @ts-expect-error undici dispatcher
          dispatcher: agente,
        }
      ),
    ]);

    const clientesData = await clientesResp.json();
    const apsData = await apsResp.json();

    const clientes = (clientesData.result?.data ?? []).map((c: Record<string, unknown>) => ({
      mac: c.mac,
      nombre: c.name || c.hostname || "Dispositivo",
      ip: c.ip,
      apMac: c.apMac,
      ssid: c.ssid,
      señal: c.signalLevel,
      conectadoEn: c.trafficDown,
    }));

    const aps = (apsData.result?.data ?? []).map((ap: Record<string, unknown>) => ({
      mac: ap.mac,
      nombre: ap.name,
      ip: ap.ip,
      modelo: ap.model,
      estado: ap.status === 0 ? "conectado" : "desconectado",
      clientesConectados: ap.clientNum ?? 0,
      uptime: ap.uptime,
    }));

    // Geolocalización de cada AP por su IP pública
    const apsConUbicacion = await Promise.all(
      aps.map(async (ap: { mac: string; nombre: string; ip: string; modelo: string; estado: string; clientesConectados: number; uptime: number }) => {
        if (!ap.ip) return { ...ap, ubicacion: null };
        try {
          const geoResp = await fetch(`http://ip-api.com/json/${ap.ip}?fields=lat,lon,city,regionName,status`);
          const geo = await geoResp.json();
          if (geo.status === "success") {
            return {
              ...ap,
              ubicacion: {
                lat: geo.lat,
                lon: geo.lon,
                ciudad: geo.city,
                region: geo.regionName,
              },
            };
          }
        } catch {
          // sin ubicación
        }
        return { ...ap, ubicacion: null };
      })
    );

    return NextResponse.json({
      aps: apsConUbicacion,
      clientes,
      total: clientes.length,
    });
  } catch (error) {
    console.error("[admin-dispositivos] Error:", error);
    return NextResponse.json({ error: "Error al consultar Omada" }, { status: 500 });
  }
}
