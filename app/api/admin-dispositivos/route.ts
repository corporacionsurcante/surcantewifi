import { NextRequest, NextResponse } from "next/server";
import { Agent } from "undici";

const agente = new Agent({ connect: { rejectUnauthorized: false } });

function verificarAdmin(solicitud: NextRequest): boolean {
  return solicitud.headers.get("x-admin-key") === process.env.CLAVE_ADMIN;
}

async function obtenerIdControlador(urlBase: string): Promise<string> {
  const r = await fetch(`${urlBase}/api/info`, {
    // @ts-expect-error undici dispatcher
    dispatcher: agente,
  });
  const d = await r.json();
  return d.result.omadacId;
}

async function obtenerToken(urlBase: string, idControlador: string) {
  const r = await fetch(
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
  const d = await r.json();
  return {
    token: d.result?.token ?? "",
    cookie: r.headers.get("set-cookie") ?? "",
  };
}

export async function GET(solicitud: NextRequest) {
  if (!verificarAdmin(solicitud)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const urlBase = process.env.OMADA_CONTROLLER_URL;
  if (!urlBase) {
    return NextResponse.json({ error: "Sin configuración" }, { status: 500 });
  }

  try {
    const idControlador = await obtenerIdControlador(urlBase);
    const { token, cookie } = await obtenerToken(urlBase, idControlador);

    const headers = {
      "Csrf-Token": token,
      Cookie: cookie,
    };

    // Primero obtenemos los sitios para conseguir el siteId correcto
    const sitiosResp = await fetch(
      `${urlBase}/${idControlador}/api/v2/sites?page=1&pageSize=100`,
      {
        headers,
        // @ts-expect-error undici dispatcher
        dispatcher: agente,
      }
    );
    const sitiosData = await sitiosResp.json();
    const sitios = sitiosData.result?.data ?? [];

    console.log("[admin-dispositivos] Sitios encontrados:", JSON.stringify(sitios.map((s: Record<string, unknown>) => ({ id: s.id, name: s.name }))));

    if (sitios.length === 0) {
      return NextResponse.json({ aps: [], clientes: [], total: 0 });
    }

    // Usamos el primer sitio disponible
    const siteId = sitios[0].id;

    // Obtenemos APs y clientes en paralelo
    const [apsResp, clientesResp] = await Promise.all([
      fetch(
        `${urlBase}/${idControlador}/api/v2/sites/${siteId}/eaps?page=1&pageSize=100`,
        {
          headers,
          // @ts-expect-error undici dispatcher
          dispatcher: agente,
        }
      ),
      fetch(
        `${urlBase}/${idControlador}/api/v2/sites/${siteId}/clients?page=1&pageSize=100`,
        {
          headers,
          // @ts-expect-error undici dispatcher
          dispatcher: agente,
        }
      ),
    ]);

    const apsData = await apsResp.json();
    const clientesData = await clientesResp.json();

    console.log("[admin-dispositivos] APs:", JSON.stringify(apsData).slice(0, 200));
    console.log("[admin-dispositivos] Clientes:", JSON.stringify(clientesData).slice(0, 200));

    const aps = (apsData.result?.data ?? []).map((ap: Record<string, unknown>) => ({
      mac: ap.mac,
      nombre: ap.name,
      ip: ap.ip,
      modelo: ap.model,
      estado: ap.status === 0 ? "conectado" : "desconectado",
      clientesConectados: ap.clientNum ?? 0,
      uptime: ap.uptime,
    }));

    const clientes = (clientesData.result?.data ?? []).map((c: Record<string, unknown>) => ({
      mac: c.mac,
      nombre: c.name || c.hostname || "Dispositivo",
      ip: c.ip,
      apMac: c.apMac,
      ssid: c.ssid,
      señal: c.signalLevel ?? 0,
    }));

    // Geolocalización por IP pública del Starlink
    const apsConUbicacion = await Promise.all(
      aps.map(async (ap: { mac: string; nombre: string; ip: string; modelo: string; estado: string; clientesConectados: number; uptime: number }) => {
        if (!ap.ip || ap.ip.startsWith("192.") || ap.ip.startsWith("10.") || ap.ip.startsWith("172.")) {
          // IP privada, intentamos con la IP pública del servidor
          try {
            const geoResp = await fetch(`http://ip-api.com/json/?fields=lat,lon,city,regionName,status`);
            const geo = await geoResp.json();
            if (geo.status === "success") {
              return { ...ap, ubicacion: { lat: geo.lat, lon: geo.lon, ciudad: geo.city, region: geo.regionName } };
            }
          } catch { /* sin ubicación */ }
          return { ...ap, ubicacion: null };
        }
        try {
          const geoResp = await fetch(`http://ip-api.com/json/${ap.ip}?fields=lat,lon,city,regionName,status`);
          const geo = await geoResp.json();
          if (geo.status === "success") {
            return { ...ap, ubicacion: { lat: geo.lat, lon: geo.lon, ciudad: geo.city, region: geo.regionName } };
          }
        } catch { /* sin ubicación */ }
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
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
