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
    `${urlBase}/${idControlador}/api/v3/users/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: usuario, password: contrasena }),
      // @ts-expect-error undici dispatcher
      dispatcher: agente,
    }
  );
  const d = await r.json();
  console.log("[admin-dispositivos] Login v3:", JSON.stringify(d).slice(0, 200));
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

    const headers = { "Csrf-Token": token, Cookie: cookie };

    // Obtenemos sitios con API v3
    const sitiosResp = await fetch(
      `${urlBase}/${idControlador}/api/v3/sites?currentPage=1&currentPageSize=100`,
      {
        headers,
        // @ts-expect-error undici dispatcher
        dispatcher: agente,
      }
    );
    const sitiosData = await sitiosResp.json();
    console.log("[admin-dispositivos] Sitios v3:", JSON.stringify(sitiosData).slice(0, 400));

    const sitios = sitiosData.result?.data ?? sitiosData.result ?? [];

    if (sitios.length === 0) {
      return NextResponse.json({ aps: [], clientes: [], total: 0 });
    }

    const siteId = sitios[0].id ?? sitios[0].siteId;
    console.log("[admin-dispositivos] SiteId:", siteId);

    const [apsResp, clientesResp] = await Promise.all([
      fetch(
        `${urlBase}/${idControlador}/api/v3/sites/${siteId}/eaps?currentPage=1&currentPageSize=100`,
        {
          headers,
          // @ts-expect-error undici dispatcher
          dispatcher: agente,
        }
      ),
      fetch(
        `${urlBase}/${idControlador}/api/v3/sites/${siteId}/clients?currentPage=1&currentPageSize=100`,
        {
          headers,
          // @ts-expect-error undici dispatcher
          dispatcher: agente,
        }
      ),
    ]);

    const apsData = await apsResp.json();
    const clientesData = await clientesResp.json();

    console.log("[admin-dispositivos] APs v3:", JSON.stringify(apsData).slice(0, 400));
    console.log("[admin-dispositivos] Clientes v3:", JSON.stringify(clientesData).slice(0, 400));

    const aps = (apsData.result?.data ?? []).map((ap: Record<string, unknown>) => ({
      mac: ap.mac,
      nombre: ap.name,
      ip: ap.ip,
      modelo: ap.model,
      estado: ap.status === 0 ? "conectado" : "desconectado",
      clientesConectados: ap.clientNum ?? 0,
    }));

    const clientes = (clientesData.result?.data ?? []).map((c: Record<string, unknown>) => ({
      mac: c.mac,
      nombre: c.name || c.hostname || "Dispositivo",
      ip: c.ip,
      apMac: c.apMac,
      ssid: c.ssid,
      señal: c.signalLevel ?? 0,
    }));

    // Geolocalización por IP del Starlink (IP pública del servidor como aproximación)
    const apsConUbicacion = await Promise.all(
      aps.map(async (ap: { mac: string; nombre: string; ip: string; modelo: string; estado: string; clientesConectados: number }) => {
        const ipParaGeo = (!ap.ip || ap.ip.startsWith("192.") || ap.ip.startsWith("10.") || ap.ip.startsWith("172."))
          ? "" : ap.ip;
        try {
          const url = ipParaGeo
            ? `http://ip-api.com/json/${ipParaGeo}?fields=lat,lon,city,regionName,status`
            : `http://ip-api.com/json/?fields=lat,lon,city,regionName,status`;
          const geoResp = await fetch(url);
          const geo = await geoResp.json();
          if (geo.status === "success") {
            return { ...ap, ubicacion: { lat: geo.lat, lon: geo.lon, ciudad: geo.city, region: geo.regionName } };
          }
        } catch { /* sin ubicación */ }
        return { ...ap, ubicacion: null };
      })
    );

    return NextResponse.json({ aps: apsConUbicacion, clientes, total: clientes.length });
  } catch (error) {
    console.error("[admin-dispositivos] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
