"use client";

import { useState, useEffect, useCallback } from "react";

type ResumenData = {
  totalPagos: number;
  recaudacionTotal: number;
  recaudacionHoy: number;
  pagosHoy: number;
  porPlan: { plan: string; cantidad: number; total: number }[];
};

type PagoData = {
  id: string;
  mac: string;
  plan: string;
  monto: number;
  procesador: string;
  ventanilla: number | null;
  fechaPago: number;
  duracionMinutos: number;
};

type CodigoData = {
  codigo: string;
  estado: "usado" | "disponible";
  creadoPor: string;
  creadoEn: number;
  usadoEn: number | null;
  mac: string | null;
};

type APData = {
  mac: string;
  nombre: string;
  ip: string;
  modelo: string;
  estado: string;
  clientesConectados: number;
  ubicacion: { lat: number; lon: number; ciudad: string; region: string } | null;
};

type ClienteData = {
  mac: string;
  nombre: string;
  ip: string;
  apMac: string;
  ssid: string;
  señal: number;
};

type PlanData = {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  duracionMinutos: number;
  activo: boolean;
  descuento: number;
  creadoEn?: number;
  actualizadoEn?: number;
};

type VentanillaData = {
  numero: number;
  externalId: string;
  posId: number;
  nombre: string;
  qrImageUrl: string;
  creadoEn: number;
};

export default function PanelAdmin() {
  const [clave, setClave] = useState("");
  const [autenticado, setAutenticado] = useState(false);
  const [claveIngresada, setClaveIngresada] = useState("");
  const [error, setError] = useState("");
  const [verificandoSesionGoogle, setVerificandoSesionGoogle] = useState(true);
  const [resumen, setResumen] = useState<ResumenData | null>(null);
  const [pagos, setPagos] = useState<PagoData[]>([]);
  const [codigos, setCodigos] = useState<CodigoData[]>([]);
  const [aps, setAps] = useState<APData[]>([]);
  const [clientes, setClientes] = useState<ClienteData[]>([]);
  const [planes, setPlanes] = useState<PlanData[]>([]);
  const [tab, setTab] = useState<"resumen" | "pagos" | "codigos" | "dispositivos" | "paquetes" | "ventanillas" | "config">("resumen");
  const [generando, setGenerando] = useState(false);
  const [cantidadCodigos, setCantidadCodigos] = useState(1);
  const [creadoPor, setCreadoPor] = useState("");
  const [config, setConfig] = useState({ nave: true, mp: true, whatsapp: true, qrVentanilla: true });
  const [guardandoConfig, setGuardandoConfig] = useState(false);
  const [cargandoDispositivos, setCargandoDispositivos] = useState(false);
  const [cargandoPaquetes, setCargandoPaquetes] = useState(false);
  const [ventanillas, setVentanillas] = useState<VentanillaData[]>([]);
  const [cargandoVentanillas, setCargandoVentanillas] = useState(false);
  const [generandoVentanillas, setGenerandoVentanillas] = useState(false);
  const [cantidadVentanillas, setCantidadVentanillas] = useState(1);
  const [errorVentanillas, setErrorVentanillas] = useState<string | null>(null);
  const [editandoPlan, setEditandoPlan] = useState<PlanData | null>(null);
  const [guardandoPlan, setGuardandoPlan] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoDescripcion, setNuevoDescripcion] = useState("");
  const [nuevoPrecio, setNuevoPrecio] = useState("");
  const [nuevaDuracion, setNuevaDuracion] = useState("");
  const [nuevoDescuento, setNuevoDescuento] = useState("");

  const cargarDatos = useCallback(async (claveAdmin: string) => {
    try {
      const r = await fetch("/api/admin-dashboard", { headers: { "x-admin-key": claveAdmin } });
      if (!r.ok) { setAutenticado(false); return; }
      const d = await r.json();
      setResumen(d.resumen);
      setPagos(d.pagos);
      setCodigos(d.codigos);
    } catch (e) { console.error(e); }
  }, []);

  const cargarDispositivos = useCallback(async (claveAdmin: string) => {
    setCargandoDispositivos(true);
    try {
      const r = await fetch("/api/admin-dispositivos", { headers: { "x-admin-key": claveAdmin } });
      const d = await r.json();
      setAps(d.aps ?? []);
      setClientes(d.clientes ?? []);
    } catch (e) { console.error(e); }
    finally { setCargandoDispositivos(false); }
  }, []);

  const cargarPaquetes = useCallback(async (claveAdmin: string) => {
    setCargandoPaquetes(true);
    try {
      const r = await fetch("/api/admin-planes", { headers: { "x-admin-key": claveAdmin } });
      const d = await r.json();
      setPlanes(Array.isArray(d) ? d : []);
    } catch (e) { console.error(e); }
    finally { setCargandoPaquetes(false); }
  }, []);

  const cargarVentanillas = useCallback(async (claveAdmin: string) => {
    setCargandoVentanillas(true);
    try {
      const r = await fetch("/api/admin-ventanillas", { headers: { "x-admin-key": claveAdmin } });
      const d = await r.json();
      setVentanillas(d.ventanillas ?? []);
    } catch (e) { console.error(e); }
    finally { setCargandoVentanillas(false); }
  }, []);

  async function generarVentanillas() {
    setGenerandoVentanillas(true);
    setErrorVentanillas(null);
    try {
      const r = await fetch("/api/admin-ventanillas", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": clave },
        body: JSON.stringify({ cantidad: cantidadVentanillas }),
      });
      const d = await r.json();
      if (d.errores?.length) {
        setErrorVentanillas(d.errores[0]);
      }
      await cargarVentanillas(clave);
    } catch (e) {
      console.error(e);
      setErrorVentanillas("No se pudo conectar con el servidor");
    } finally {
      setGenerandoVentanillas(false);
    }
  }

  // NextAuth exige CSRF token en el POST de sign-in; un <a href> simple
  // a /api/auth/signin/google fallaba intermitentemente. Se arma un form
  // y se envía por POST con el token, como recomienda la documentación.
  async function enviarPostAuth(path: string) {
    const csrfResp = await fetch("/api/auth/csrf");
    const csrfData = await csrfResp.json();
    const csrfToken = csrfData?.csrfToken;
    if (!csrfToken) throw new Error("csrf-missing");

    const form = document.createElement("form");
    form.method = "POST";
    form.action = path;

    const tokenInput = document.createElement("input");
    tokenInput.type = "hidden";
    tokenInput.name = "csrfToken";
    tokenInput.value = csrfToken;
    form.appendChild(tokenInput);

    const callbackInput = document.createElement("input");
    callbackInput.type = "hidden";
    callbackInput.name = "callbackUrl";
    callbackInput.value = "/admin";
    form.appendChild(callbackInput);

    document.body.appendChild(form);
    form.submit();
  }

  async function iniciarGoogle() {
    setError("");
    try {
      await enviarPostAuth("/api/auth/signin/google");
    } catch {
      setError("No se pudo iniciar sesión con Google.");
    }
  }

  async function cargarConfig() {
    const r = await fetch("/api/config-publica");
    setConfig(await r.json());
  }

  async function guardarConfig(nueva: typeof config) {
    setGuardandoConfig(true);
    try {
      await fetch("/api/admin-config", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": clave },
        body: JSON.stringify(nueva),
      });
      setConfig(nueva);
    } finally { setGuardandoConfig(false); }
  }

  async function solicitarSesionGoogle(token: string) {
    setClave(token);
    const rd = await fetch("/api/admin-dashboard", { headers: { "x-admin-key": token } });
    if (rd.ok) {
      const data = await rd.json();
      setAutenticado(true);
      setResumen(data.resumen);
      setPagos(data.pagos);
      setCodigos(data.codigos);
      cargarConfig();
      cargarPaquetes(token);
    } else {
      setError("Error cargando el panel");
    }
  }


  async function ingresar() {
    setError("");
    const r = await fetch("/api/admin-dashboard", { headers: { "x-admin-key": claveIngresada } });
    if (r.ok) {
      const d = await r.json();
      setClave(claveIngresada);
      setAutenticado(true);
      setResumen(d.resumen);
      setPagos(d.pagos);
      setCodigos(d.codigos);
      cargarConfig();
      cargarPaquetes(claveIngresada);
    } else {
      setError("Clave incorrecta");
    }
  }

  async function generarCodigos() {
    setGenerando(true);
    try {
      await fetch("/api/admin-codigos", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": clave },
        body: JSON.stringify({ cantidad: cantidadCodigos, creadoPor }),
      });
      await cargarDatos(clave);
    } finally { setGenerando(false); }
  }

  async function guardarPlan(plan: PlanData) {
    setGuardandoPlan(true);
    try {
      const r = await fetch("/api/admin-planes", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-key": clave },
        body: JSON.stringify(plan),
      });
      if (r.ok) {
        await cargarPaquetes(clave);
        setEditandoPlan(null);
        setNuevoNombre("");
        setNuevoDescripcion("");
        setNuevoPrecio("");
        setNuevaDuracion("");
        setNuevoDescuento("");
      }
    } finally { setGuardandoPlan(false); }
  }

  async function crearPlan(nombre: string, descripcion: string, precio: number, duracion: number) {
    setGuardandoPlan(true);
    try {
      const r = await fetch("/api/admin-planes", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": clave },
        body: JSON.stringify({ nombre, descripcion, precio, duracionMinutos: duracion }),
      });
      if (r.ok) {
        await cargarPaquetes(clave);
        setNuevoNombre("");
        setNuevoDescripcion("");
        setNuevoPrecio("");
        setNuevaDuracion("");
      }
    } finally { setGuardandoPlan(false); }
  }

  async function eliminarPlan(id: string) {
    if (confirm("¿Está seguro que desea eliminar este plan?")) {
      try {
        const r = await fetch(`/api/admin-planes?id=${id}`, {
          method: "DELETE",
          headers: { "x-admin-key": clave },
        });
        if (r.ok) {
          await cargarPaquetes(clave);
        }
      } catch (e) { console.error(e); }
    }
  }

  useEffect(() => {
    if (autenticado && clave) {
      const i = setInterval(() => cargarDatos(clave), 30000);
      return () => clearInterval(i);
    }
  }, [autenticado, clave, cargarDatos]);

  // Al montar: si venimos de un redirect de Google (con error) lo mostramos,
  // y si ya existe una sesión de Google válida, entramos directo sin pedir
  // la clave de nuevo.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) {
      setError(
        err === "AccessDenied"
          ? "Esa cuenta de Google no tiene acceso al panel."
          : "No se pudo iniciar sesión con Google."
      );
      window.history.replaceState({}, "", "/admin");
    }

    fetch("/api/auth/admin-session-token")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.token) solicitarSesionGoogle(d.token);
      })
      .catch(() => {})
      .finally(() => setVerificandoSesionGoogle(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === "dispositivos" && autenticado) {
      cargarDispositivos(clave);
      const i = setInterval(() => cargarDispositivos(clave), 30000);
      return () => clearInterval(i);
    }
  }, [tab, autenticado, clave, cargarDispositivos]);

  useEffect(() => {
    if (tab === "paquetes" && autenticado) {
      cargarPaquetes(clave);
    }
  }, [tab, autenticado, clave, cargarPaquetes]);

  useEffect(() => {
    if (tab === "ventanillas" && autenticado) {
      cargarVentanillas(clave);
    }
  }, [tab, autenticado, clave, cargarVentanillas]);

  const formatPeso = (n: number) => "$" + n.toLocaleString("es-AR");
  const formatFecha = (ts: number) => new Date(ts).toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
  });

  if (!autenticado) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0A0A0C] px-5">
        <div className="w-full max-w-xs">
          <div className="w-12 h-12 rounded-full bg-[#6E3FA3] flex items-center justify-center mx-auto mb-6">
            <span className="text-white text-xl">S</span>
          </div>
          <p className="text-white text-center text-lg font-medium mb-6">Panel WAIFAI</p>

          {verificandoSesionGoogle ? (
            <p className="text-[#5A5A60] text-xs text-center mb-4">Verificando sesión...</p>
          ) : (
            <button
              onClick={iniciarGoogle}
              className="w-full py-3 rounded-xl bg-white text-[#1F1F1F] font-medium mb-4 flex items-center justify-center gap-2 hover:bg-gray-100 transition"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3.01h3.88c2.27-2.09 3.57-5.17 3.57-8.82z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3.01c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11C3.25 21.3 7.31 24 12 24z"/>
                <path fill="#FBBC05" d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54V6.62H1.27a12 12 0 0 0 0 10.76l4-3.11z"/>
                <path fill="#EA4335" d="M12 4.75c1.76 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.62l4 3.11C6.22 6.86 8.87 4.75 12 4.75z"/>
              </svg>
              Ingresar con Google
            </button>
          )}

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-[#2A2A2E]" />
            <span className="text-[#5A5A60] text-xs">o</span>
            <div className="flex-1 h-px bg-[#2A2A2E]" />
          </div>

          {/* Clave manual (fallback) */}
          <input type="password" value={claveIngresada}
            onChange={(e) => setClaveIngresada(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ingresar()}
            placeholder="Clave de acceso"
            className="w-full px-4 py-3 rounded-xl bg-[#18181B] border border-[#2A2A2E] text-white mb-3"
          />
          {error && <p className="text-red-400 text-sm text-center mb-3">{error}</p>}
          <button onClick={ingresar} className="w-full py-3 rounded-xl bg-[#6E3FA3] text-white font-medium">
            Ingresar con clave
          </button>
        </div>
      </main>
    );
  }

  const TABS = ["resumen", "dispositivos", "pagos", "codigos", "paquetes", "ventanillas", "config"] as const;
  const LABELS: Record<string, string> = {
    resumen: "Resumen", dispositivos: "Buses", pagos: "Pagos", codigos: "Códigos", paquetes: "Paquetes", ventanillas: "Ventanillas", config: "Config"
  };

  return (
    <main className="min-h-screen bg-[#0A0A0C] text-white px-4 py-6">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#6E3FA3] flex items-center justify-center">
              <span className="text-white text-sm">S</span>
            </div>
            <p className="text-white font-medium">Panel WAIFAI</p>
          </div>
          <div className="flex items-center gap-4">
            <a href="/qr" target="_blank" rel="noopener noreferrer" className="text-[#8B5FBF] text-sm underline">
              Cartel QR
            </a>
            <button onClick={() => { cargarDatos(clave); if (tab === "dispositivos") cargarDispositivos(clave); }}
              className="text-[#8B5FBF] text-sm underline">Actualizar</button>
          </div>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap ${
                tab === t ? "bg-[#6E3FA3] text-white" : "bg-[#18181B] text-[#A0A0A8] border border-[#2A2A2E]"
              }`}>
              {LABELS[t]}
            </button>
          ))}
        </div>

        {tab === "resumen" && resumen && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#18181B] border border-[#2A2A2E] rounded-2xl p-4">
                <p className="text-[#A0A0A8] text-xs mb-1">Recaudado hoy</p>
                <p className="text-white text-2xl font-medium">{formatPeso(resumen.recaudacionHoy)}</p>
                <p className="text-[#A0A0A8] text-xs mt-1">{resumen.pagosHoy} pagos</p>
              </div>
              <div className="bg-[#18181B] border border-[#2A2A2E] rounded-2xl p-4">
                <p className="text-[#A0A0A8] text-xs mb-1">Total histórico</p>
                <p className="text-white text-2xl font-medium">{formatPeso(resumen.recaudacionTotal)}</p>
                <p className="text-[#A0A0A8] text-xs mt-1">{resumen.totalPagos} pagos</p>
              </div>
            </div>
            <div className="bg-[#18181B] border border-[#2A2A2E] rounded-2xl p-4">
              <p className="text-[#A0A0A8] text-xs mb-3">Por plan</p>
              {resumen.porPlan.map((p) => (
                <div key={p.plan} className="flex justify-between items-center py-2 border-b border-[#2A2A2E] last:border-0">
                  <div>
                    <p className="text-white text-sm">{p.plan}</p>
                    <p className="text-[#A0A0A8] text-xs">{p.cantidad} ventas</p>
                  </div>
                  <p className="text-white font-medium">{formatPeso(p.total)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "dispositivos" && (
          <div className="flex flex-col gap-4">
            {cargandoDispositivos ? (
              <p className="text-[#A0A0A8] text-center py-8">Consultando Omada...</p>
            ) : (
              <>
                <p className="text-[#A0A0A8] text-xs uppercase tracking-wide">Puntos de acceso</p>
                {aps.length === 0 ? (
                  <p className="text-[#A0A0A8] text-center py-4">Sin datos de Omada</p>
                ) : aps.map((ap) => (
                  <div key={ap.mac} className="bg-[#18181B] border border-[#2A2A2E] rounded-2xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-white font-medium">{ap.nombre || ap.mac}</p>
                        <p className="text-[#A0A0A8] text-xs">{ap.modelo}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          ap.estado === "conectado" ? "bg-green-900 text-green-400" : "bg-red-900 text-red-400"
                        }`}>
                          {ap.estado === "conectado" ? "● Online" : "● Offline"}
                        </span>
                        <span className="text-[#A0A0A8] text-xs">{ap.clientesConectados} pasajeros</span>
                      </div>
                    </div>
                    {ap.ubicacion ? (
                      <div className="mt-2">
                        <p className="text-[#5A5A60] text-xs mb-1">📍 {ap.ubicacion.ciudad}, {ap.ubicacion.region}</p>
                        <a href={`https://www.google.com/maps?q=${ap.ubicacion.lat},${ap.ubicacion.lon}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-[#8B5FBF] text-xs underline">
                          Ver en Google Maps →
                        </a>
                      </div>
                    ) : (
                      <p className="text-[#5A5A60] text-xs mt-2">📍 Ubicación no disponible</p>
                    )}
                  </div>
                ))}

                <p className="text-[#A0A0A8] text-xs uppercase tracking-wide mt-2">
                  Pasajeros conectados ahora ({clientes.length})
                </p>
                {clientes.length === 0 ? (
                  <p className="text-[#A0A0A8] text-center py-4">Sin pasajeros conectados</p>
                ) : clientes.map((c, i) => (
                  <div key={i} className="bg-[#18181B] border border-[#2A2A2E] rounded-2xl p-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-white text-sm">{c.nombre}</p>
                        <p className="text-[#5A5A60] text-xs font-mono">{c.mac}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[#A0A0A8] text-xs">{c.ssid}</p>
                        <p className="text-[#5A5A60] text-xs">Señal: {c.señal}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {tab === "pagos" && (
          <div className="flex flex-col gap-2">
            {pagos.length === 0 ? (
              <p className="text-[#A0A0A8] text-center py-8">Sin pagos todavía</p>
            ) : pagos.map((p) => (
              <div key={p.id} className="bg-[#18181B] border border-[#2A2A2E] rounded-2xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-white text-sm font-medium">{p.plan}</p>
                    <p className="text-[#A0A0A8] text-xs">
                      {p.procesador === "nave"
                        ? "Nave/Galicia"
                        : p.procesador === "mp-qr"
                        ? `QR ventanilla${p.ventanilla ? " " + p.ventanilla : ""}`
                        : "Mercado Pago"}
                    </p>
                  </div>
                  <p className="text-white font-medium">{formatPeso(p.monto)}</p>
                </div>
                <p className="text-[#5A5A60] text-xs font-mono">{p.mac}</p>
                <p className="text-[#5A5A60] text-xs mt-1">{p.fechaPago ? formatFecha(p.fechaPago) : "-"}</p>
              </div>
            ))}
          </div>
        )}

        {tab === "codigos" && (
          <div className="flex flex-col gap-4">
            <div className="bg-[#18181B] border border-[#2A2A2E] rounded-2xl p-4">
              <p className="text-[#A0A0A8] text-xs mb-3">Generar códigos nuevos</p>
              <input type="text" value={creadoPor}
                onChange={(e) => setCreadoPor(e.target.value.toUpperCase())}
                placeholder="Iniciales (ej: JB, SM)"
                className="w-full px-4 py-2.5 rounded-xl bg-[#0A0A0C] border border-[#2A2A2E] text-white mb-2 text-sm"
              />
              <div className="flex gap-2">
                <input type="number" value={cantidadCodigos}
                  onChange={(e) => setCantidadCodigos(Math.min(50, Math.max(1, Number(e.target.value))))}
                  min={1} max={50}
                  className="w-20 px-3 py-2.5 rounded-xl bg-[#0A0A0C] border border-[#2A2A2E] text-white text-sm"
                />
                <button onClick={generarCodigos} disabled={generando || !creadoPor}
                  className="flex-1 py-2.5 rounded-xl bg-[#6E3FA3] text-white text-sm font-medium disabled:opacity-60">
                  {generando ? "Generando..." : `Generar ${cantidadCodigos} código${cantidadCodigos > 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {codigos.length === 0 ? (
                <p className="text-[#A0A0A8] text-center py-8">Sin códigos todavía</p>
              ) : codigos.map((c) => (
                <div key={c.codigo} className="bg-[#18181B] border border-[#2A2A2E] rounded-2xl p-4">
                  <div className="flex justify-between items-start">
                    <p className="text-white font-mono font-medium">{c.codigo}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      c.estado === "usado" ? "bg-green-900 text-green-400" : "bg-[#2A2A2E] text-[#A0A0A8]"
                    }`}>
                      {c.estado === "usado" ? "Usado" : "Disponible"}
                    </span>
                  </div>
                  <p className="text-[#5A5A60] text-xs mt-1">Creado por {c.creadoPor} · {formatFecha(c.creadoEn)}</p>
                  {c.estado === "usado" && c.mac && (
                    <p className="text-[#5A5A60] text-xs mt-0.5 font-mono">{c.mac} · {c.usadoEn ? formatFecha(c.usadoEn) : ""}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "paquetes" && (
          <div className="flex flex-col gap-4">
            <div className="bg-[#18181B] border border-[#2A2A2E] rounded-2xl p-4">
              <p className="text-[#A0A0A8] text-xs mb-3">Crear nuevo paquete</p>
              <input type="text" value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder="Nombre del paquete"
                className="w-full px-4 py-2.5 rounded-xl bg-[#0A0A0C] border border-[#2A2A2E] text-white mb-2 text-sm"
              />
              <textarea value={nuevoDescripcion}
                onChange={(e) => setNuevoDescripcion(e.target.value)}
                placeholder="Descripción"
                className="w-full px-4 py-2.5 rounded-xl bg-[#0A0A0C] border border-[#2A2A2E] text-white mb-2 text-sm resize-none h-20"
              />
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input type="number" value={nuevoPrecio}
                  onChange={(e) => setNuevoPrecio(e.target.value)}
                  placeholder="Precio"
                  className="px-4 py-2.5 rounded-xl bg-[#0A0A0C] border border-[#2A2A2E] text-white text-sm"
                />
                <input type="number" value={nuevaDuracion}
                  onChange={(e) => setNuevaDuracion(e.target.value)}
                  placeholder="Duración (minutos)"
                  className="px-4 py-2.5 rounded-xl bg-[#0A0A0C] border border-[#2A2A2E] text-white text-sm"
                />
              </div>
              <button onClick={() => crearPlan(nuevoNombre, nuevoDescripcion, Number(nuevoPrecio), Number(nuevaDuracion))}
                disabled={guardandoPlan || !nuevoNombre || !nuevoPrecio || !nuevaDuracion}
                className="w-full py-2.5 rounded-xl bg-[#6E3FA3] text-white text-sm font-medium disabled:opacity-60">
                {guardandoPlan ? "Guardando..." : "Crear paquete"}
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {cargandoPaquetes ? (
                <p className="text-[#A0A0A8] text-center py-8">Cargando paquetes...</p>
              ) : planes.length === 0 ? (
                <p className="text-[#A0A0A8] text-center py-8">Sin paquetes</p>
              ) : planes.map((p) => (
                <div key={p.id}>
                  {editandoPlan?.id === p.id ? (
                    <div className="bg-[#18181B] border border-[#2A2A2E] rounded-2xl p-4">
                      <input type="text" value={nuevoNombre || editandoPlan.nombre}
                        onChange={(e) => setNuevoNombre(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-[#0A0A0C] border border-[#2A2A2E] text-white mb-2 text-sm"
                      />
                      <textarea value={nuevoDescripcion || editandoPlan.descripcion}
                        onChange={(e) => setNuevoDescripcion(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-[#0A0A0C] border border-[#2A2A2E] text-white mb-2 text-sm resize-none h-20"
                      />
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <input type="number" value={nuevoPrecio || editandoPlan.precio}
                          onChange={(e) => setNuevoPrecio(e.target.value)}
                          className="px-4 py-2.5 rounded-xl bg-[#0A0A0C] border border-[#2A2A2E] text-white text-sm"
                        />
                        <input type="number" value={nuevaDuracion || editandoPlan.duracionMinutos}
                          onChange={(e) => setNuevaDuracion(e.target.value)}
                          className="px-4 py-2.5 rounded-xl bg-[#0A0A0C] border border-[#2A2A2E] text-white text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <input type="number" value={nuevoDescuento || editandoPlan.descuento}
                          onChange={(e) => setNuevoDescuento(e.target.value)}
                          placeholder="Descuento %"
                          className="px-4 py-2.5 rounded-xl bg-[#0A0A0C] border border-[#2A2A2E] text-white text-sm"
                        />
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={editandoPlan.activo}
                            onChange={(e) => setEditandoPlan({...editandoPlan, activo: e.target.checked})}
                            className="w-4 h-4"
                          />
                          <label className="text-white text-sm">Activo</label>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => guardarPlan({
                          ...editandoPlan,
                          nombre: nuevoNombre || editandoPlan.nombre,
                          descripcion: nuevoDescripcion || editandoPlan.descripcion,
                          precio: Number(nuevoPrecio) || editandoPlan.precio,
                          duracionMinutos: Number(nuevaDuracion) || editandoPlan.duracionMinutos,
                          descuento: Number(nuevoDescuento) || editandoPlan.descuento,
                        })}
                          disabled={guardandoPlan}
                          className="flex-1 py-2 rounded-xl bg-green-600 text-white text-sm font-medium disabled:opacity-60">
                          Guardar
                        </button>
                        <button onClick={() => setEditandoPlan(null)}
                          className="flex-1 py-2 rounded-xl bg-[#2A2A2E] text-white text-sm font-medium">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#18181B] border border-[#2A2A2E] rounded-2xl p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-white font-medium">{p.nombre}</p>
                          <p className="text-[#A0A0A8] text-xs">{p.descripcion}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          p.activo ? "bg-green-900 text-green-400" : "bg-red-900 text-red-400"
                        }`}>
                          {p.activo ? "Activo" : "Inactivo"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <p className="text-white text-sm font-medium">${p.precio.toLocaleString("es-AR")}</p>
                          <p className="text-[#A0A0A8] text-xs">{Math.floor(p.duracionMinutos / 60)}h</p>
                        </div>
                        {p.descuento > 0 && (
                          <span className="bg-[#6E3FA3] text-white text-xs px-2 py-0.5 rounded-full">
                            -{p.descuento}%
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => {
                          setEditandoPlan(p);
                          setNuevoNombre("");
                          setNuevoDescripcion("");
                          setNuevoPrecio("");
                          setNuevaDuracion("");
                          setNuevoDescuento("");
                        }}
                          className="flex-1 py-2 rounded-xl bg-[#6E3FA3] text-white text-sm font-medium">
                          Editar
                        </button>
                        <button onClick={() => eliminarPlan(p.id)}
                          className="flex-1 py-2 rounded-xl bg-red-900 text-white text-sm font-medium">
                          Eliminar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "ventanillas" && (
          <div className="flex flex-col gap-4">
            <div className="bg-[#18181B] border border-[#2A2A2E] rounded-2xl p-4">
              <p className="text-[#A0A0A8] text-xs mb-1">QR de pago para pegar en cada ventanilla</p>
              <p className="text-[#5A5A60] text-xs mb-3">
                Cada ventanilla es un punto de cobro independiente en Mercado Pago:
                dos pasajeros pueden escanear y pagar al mismo tiempo sin pisarse.
                Generá una por cada QR físico que vayas a imprimir y pegar.
              </p>
              <div className="flex gap-2">
                <input type="number" value={cantidadVentanillas}
                  onChange={(e) => setCantidadVentanillas(Math.min(60, Math.max(1, Number(e.target.value))))}
                  min={1} max={60}
                  className="w-20 px-3 py-2.5 rounded-xl bg-[#0A0A0C] border border-[#2A2A2E] text-white text-sm"
                />
                <button onClick={generarVentanillas} disabled={generandoVentanillas}
                  className="flex-1 py-2.5 rounded-xl bg-[#6E3FA3] text-white text-sm font-medium disabled:opacity-60">
                  {generandoVentanillas ? "Generando..." : `Generar ${cantidadVentanillas} ventanilla${cantidadVentanillas > 1 ? "s" : ""} nueva${cantidadVentanillas > 1 ? "s" : ""}`}
                </button>
              </div>
              {errorVentanillas && (
                <p className="text-red-400 text-xs mt-2">{errorVentanillas}</p>
              )}
            </div>

            {ventanillas.length > 0 && (
              <a
                href={`/ventanillas-imprimir?clave=${encodeURIComponent(clave)}`}
                target="_blank" rel="noopener noreferrer"
                className="text-center text-[#8B5FBF] text-sm underline"
              >
                Abrir todas para imprimir →
              </a>
            )}

            {cargandoVentanillas ? (
              <p className="text-[#A0A0A8] text-center py-8">Cargando...</p>
            ) : ventanillas.length === 0 ? (
              <p className="text-[#A0A0A8] text-center py-8">Todavía no generaste ninguna ventanilla</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {ventanillas.map((v) => (
                  <div key={v.numero} className="bg-[#18181B] border border-[#2A2A2E] rounded-2xl p-3 text-center">
                    <p className="text-white text-sm font-medium mb-2">Ventanilla {v.numero}</p>
                    {v.qrImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.qrImageUrl} alt={`QR ventanilla ${v.numero}`} className="w-full rounded-lg bg-white p-1" />
                    ) : (
                      <p className="text-[#5A5A60] text-xs">Sin imagen</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "config" && (
          <div className="bg-[#18181B] border border-[#2A2A2E] rounded-2xl p-4 flex flex-col gap-4">
            <p className="text-[#A0A0A8] text-xs">Medios de pago activos en la landing</p>
            {[
              { key: "nave", label: "Nave / Galicia" },
              { key: "mp", label: "Mercado Pago" },
              { key: "whatsapp", label: "WhatsApp" },
              { key: "qrVentanilla", label: "QR pegado en la ventanilla" },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <p className="text-white text-sm">{label}</p>
                <button
                  onClick={() => guardarConfig({ ...config, [key]: !config[key as keyof typeof config] })}
                  disabled={guardandoConfig}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    config[key as keyof typeof config] ? "bg-[#6E3FA3]" : "bg-[#2A2A2E]"
                  }`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                    config[key as keyof typeof config] ? "left-6" : "left-0.5"
                  }`} />
                </button>
              </div>
            ))}
            <p className="text-[#5A5A60] text-xs">Los cambios se aplican de inmediato.</p>
          </div>
        )}

      </div>
    </main>
  );
}
