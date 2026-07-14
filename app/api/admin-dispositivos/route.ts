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
  const usuario = process.env.OMADA_ADMIN_USER || process.env.OMADA_OPERATOR_USER;
  const contrasena = process.env.OMADA_ADMIN_PASSWORD || process.env.OMADA_OPERATOR_PASSWORD;

  const r = await fetch(
    `${urlBase}/${idControlador}/api/v2/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: usuario, password: contrasena }),
      // @ts-expect-error undici dispatcher
      dispatcher: agente,
    }
  );
  const d = await r.json();

  // Extraemos solo el valor de TPOMADA_SESSIONID de la cookie
  const setCookie = r.headers.get("set-cookie") ?? "";
  const sessionMatch = setCookie.match(/TPOMADA_SESSIONID=([^;]+)/);
  const sessionId = sessionMatch ? `TPOMADA_SESSIONID=${sessionMatch[1]}` : "";

  return {
    token: d.result?.token ?? "",
    cookie: sessionId,
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
    const headers = { "Csrf-Token": token, Cookie: cookie };

    // Obtenemos sitios
    const sitiosResp = await fetch(
      `${urlBase}/${idControlador}/api/v2/sites?currentPage=1&currentPageSize=100`,
      {
        headers,
        // @ts-expect-error undici dispatcher
        dispatcher: agente,
      }
    );
    const sitiosData = await sitiosResp.json();
    const sitios = sitiosData.result?.data ?? [];

    if (sitios.length === 0) {
      return NextResponse.json({ aps: [], clientes: [], total: 0 });
    }

    const siteId = sitios[0].id;

    // Obtenemos dispositivos y clientes en paralelo
    const [devResp, clientesResp] = await Promise.all([
      fetch(
        `${urlBase}/${idControlador}/api/v2/sites/${siteId}/devices?currentPage=1&currentPageSize=100`,
        {
          headers,
          // @ts-expect-error undici dispatcher
          dispatcher: agente,
        }
      ),
      fetch(
        `${urlBase}/${idControlador}/api/v2/sites/${siteId}/clients?currentPage=1&currentPageSize=100&filters.active=true`,
        {
          headers,
          // @ts-expect-error undici dispatcher
          dispatcher: agente,
        }
      ),
    ]);

    const devData = await devResp.json();
    const clientesData = await clientesResp.json();

    // Filtramos solo APs (EAP225)
    const aps = (devData.result?.data ?? [])
      .filter((d: Record<string, unknown>) => d.type === 2 || String(d.model ?? "").includes("EAP"))
      .map((ap: Record<string, unknown>) => ({
        mac: ap.mac,
        nombre: ap.name,
        ip: ap.ip,
        modelo: ap.model,
        estado: ap.status === 0 ? "conectado" : "desconectado",
        clientesConectados: ap.clientNum ?? 0,
      }));

    // Si no hay APs filtrados tomamos todos los devices
    const dispositivosFinales = aps.length > 0 ? aps : (devData.result?.data ?? []).map((d: Record<string, unknown>) => ({
      mac: d.mac,
      nombre: d.name,
      ip: d.ip,
      modelo: d.model,
      estado: d.status === 0 ? "conectado" : "desconectado",
      clientesConectados: d.clientNum ?? 0,
    }));

    const clientes = (clientesData.result?.data ?? []).map((c: Record<string, unknown>) => ({
      mac: c.mac,
      nombre: c.name || "Dispositivo",
      ip: c.ip,
      apMac: c.apMac,
      apNombre: c.apName,
      ssid: c.ssid,
      señal: c.signalLevel ?? 0,
    }));

    // Geolocalización por IP del AP (o IP pública del servidor como fallback)
    const apsConUbicacion = await Promise.all(
      dispositivosFinales.map(async (ap: { mac: string; nombre: string; ip: string; modelo: string; estado: string; clientesConectados: number }) => {
        const esPrivada = !ap.ip || ap.ip.startsWith("192.") || ap.ip.startsWith("10.") || ap.ip.startsWith("172.");
        try {
          const url = esPrivada
            ? `http://ip-api.com/json/?fields=lat,lon,city,regionName,status`
            : `http://ip-api.com/json/${ap.ip}?fields=lat,lon,city,regionName,status`;
          const geoResp = await fetch(url);
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
