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
  senal: number;
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

export default function PanelAdmin() {
  const [clave, setClave] = useState("");
  const [autenticado, setAutenticado] = useState(false);
  const [validandoSesion, setValidandoSesion] = useState(true);
  const [claveIngresada, setClaveIngresada] = useState("");
  const [error, setError] = useState("");
  const [resumen, setResumen] = useState<ResumenData | null>(null);
  const [pagos, setPagos] = useState<PagoData[]>([]);
  const [codigos, setCodigos] = useState<CodigoData[]>([]);
  const [aps, setAps] = useState<APData[]>([]);
  const [clientes, setClientes] = useState<ClienteData[]>([]);
  const [planes, setPlanes] = useState<PlanData[]>([]);
  const [tab, setTab] = useState<"resumen" | "pagos" | "codigos" | "dispositivos" | "paquetes" | "config">("resumen");
  const [generando, setGenerando] = useState(false);
  const [cantidadCodigos, setCantidadCodigos] = useState(1);
  const [creadoPor, setCreadoPor] = useState("");
  const [config, setConfig] = useState({ nave: true, mp: true, whatsapp: true });
  const [guardandoConfig, setGuardandoConfig] = useState(false);
  const [cargandoDispositivos, setCargandoDispositivos] = useState(false);
  const [cargandoPaquetes, setCargandoPaquetes] = useState(false);
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

  async function cargarPanelConClave(claveAdmin: string) {
    const r = await fetch("/api/admin-dashboard", { headers: { "x-admin-key": claveAdmin } });
    if (!r.ok) return false;
    const d = await r.json();
    setClave(claveAdmin);
    setAutenticado(true);
    setResumen(d.resumen);
    setPagos(d.pagos);
    setCodigos(d.codigos);
    cargarConfig();
    cargarPaquetes(claveAdmin);
    return true;
  }

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

  async function cerrarSesionGoogle() {
    setAutenticado(false);
    setClave("");
    try {
      await enviarPostAuth("/api/auth/signout");
    } catch {
      setError("No se pudo cerrar sesión.");
    }
  }
  async function verificarSesionGoogle() {
    setError("");
    try {
      const r = await fetch("/api/admin-token");
      const d = await r.json();
      if (r.ok && d.token) {
        await cargarPanelConClave(d.token);
      } else if (r.status !== 401) {
        setError(d.error ?? "No se pudo validar la sesion");
      }
    } finally {
      setValidandoSesion(false);
    }
  }

  async function ingresar() {
    setError("");
    const ok = await cargarPanelConClave(claveIngresada);
    if (!ok) {
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
    if (confirm("Esta seguro que desea eliminar este plan?")) {
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
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("error");
    if (authError === "AccessDenied") {
      setError("Tu cuenta de Google no tiene permisos de administrador.");
    } else if (authError) {
      setError("Falló el login con Google. Revisá OAuth en Google Cloud y Vercel.");
    }
    verificarSesionGoogle();
  }, []);
  useEffect(() => {
    if (autenticado && clave) {
      const i = setInterval(() => cargarDatos(clave), 30000);
      return () => clearInterval(i);
    }
  }, [autenticado, clave, cargarDatos]);

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

          <button
            onClick={iniciarGoogle}
            disabled={validandoSesion}
            className="w-full py-3 rounded-xl bg-white text-black font-medium mb-4 hover:bg-gray-200 transition disabled:opacity-50"
          >
            {validandoSesion ? "Verificando sesion..." : "Ingresar con Google"}
          </button>

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

  const TABS = ["resumen", "dispositivos", "pagos", "codigos", "paquetes", "config"] as const;
  const LABELS: Record<string, string> = {
    resumen: "Resumen", dispositivos: "Buses", pagos: "Pagos", codigos: "Codigos", paquetes: "Paquetes", config: "Config"
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
          <div className="flex items-center gap-3">
            <button onClick={() => { cargarDatos(clave); if (tab === "dispositivos") cargarDispositivos(clave); }}
              className="text-[#8B5FBF] text-sm underline">Actualizar</button>
            <button onClick={cerrarSesionGoogle} className="text-[#A0A0A8] text-sm underline">Salir</button>
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
                <p className="text-[#A0A0A8] text-xs mb-1">Total historico</p>
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
                          {ap.estado === "conectado" ? "â— Online" : "â— Offline"}
                        </span>
                        <span className="text-[#A0A0A8] text-xs">{ap.clientesConectados} pasajeros</span>
                      </div>
                    </div>
                    {ap.ubicacion ? (
                      <div className="mt-2">
                        <p className="text-[#5A5A60] text-xs mb-1">ðŸ“ {ap.ubicacion.ciudad}, {ap.ubicacion.region}</p>
                        <a href={`https://www.google.com/maps?q=${ap.ubicacion.lat},${ap.ubicacion.lon}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-[#8B5FBF] text-xs underline">
                          Ver en Google Maps â†’
                        </a>
                      </div>
                    ) : (
                      <p className="text-[#5A5A60] text-xs mt-2">Ubicacion no disponible</p>
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
                        <p className="text-[#5A5A60] text-xs">Senal: {c.senal}%</p>
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
              <p className="text-[#A0A0A8] text-center py-8">Sin pagos todavia</p>
            ) : pagos.map((p) => (
              <div key={p.id} className="bg-[#18181B] border border-[#2A2A2E] rounded-2xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-white text-sm font-medium">{p.plan}</p>
                    <p className="text-[#A0A0A8] text-xs">{p.procesador === "nave" ? "Nave/Galicia" : "Mercado Pago"}</p>
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
              <p className="text-[#A0A0A8] text-xs mb-3">Generar codigos nuevos</p>
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
                  {generando ? "Generando..." : `Generar ${cantidadCodigos} codigo${cantidadCodigos > 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {codigos.length === 0 ? (
                <p className="text-[#A0A0A8] text-center py-8">Sin codigos todavia</p>
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
                  <p className="text-[#5A5A60] text-xs mt-1">Creado por {c.creadoPor} Â· {formatFecha(c.creadoEn)}</p>
                  {c.estado === "usado" && c.mac && (
                    <p className="text-[#5A5A60] text-xs mt-0.5 font-mono">{c.mac} Â· {c.usadoEn ? formatFecha(c.usadoEn) : ""}</p>
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
                placeholder="Descripcion"
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
                  placeholder="Duracion (minutos)"
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

        {tab === "config" && (
          <div className="bg-[#18181B] border border-[#2A2A2E] rounded-2xl p-4 flex flex-col gap-4">
            <p className="text-[#A0A0A8] text-xs">Medios de pago activos en la landing</p>
            {[
              { key: "nave", label: "Nave / Galicia" },
              { key: "mp", label: "Mercado Pago" },
              { key: "whatsapp", label: "WhatsApp" },
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
