"use client";

import { useState, useEffect, useCallback } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

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

export default function PanelAdmin() {
  const { data: session, status } = useSession();
  const googleAutenticado = status === "authenticated" && !!session?.user?.email;

  const [clave, setClave] = useState("");
  const [autenticado, setAutenticado] = useState(false);
  const [claveIngresada, setClaveIngresada] = useState("");
  const [error, setError] = useState("");

  // WhatsApp OTP state
  const [otpEnviado, setOtpEnviado] = useState(false);
  const [codigoOtp, setCodigoOtp] = useState("");
  const [enviandoOtp, setEnviandoOtp] = useState(false);
  const [verificandoOtp, setVerificandoOtp] = useState(false);
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

  async function solicitarOtp() {
    setEnviandoOtp(true);
    setError("");
    try {
      const r = await fetch("/api/auth/whatsapp-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "solicitar" }),
      });
      const d = await r.json();
      if (r.ok) {
        setOtpEnviado(true);
      } else {
        setError(d.error ?? "Error enviando código");
      }
    } finally {
      setEnviandoOtp(false);
    }
  }

  async function verificarOtp() {
    setVerificandoOtp(true);
    setError("");
    try {
      const r = await fetch("/api/auth/whatsapp-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verificar", codigo: codigoOtp }),
      });
      const d = await r.json();
      if (r.ok && d.token) {
        setClave(d.token);
        const rd = await fetch("/api/admin-dashboard", { headers: { "x-admin-key": d.token } });
        if (rd.ok) {
          const data = await rd.json();
          setAutenticado(true);
          setResumen(data.resumen);
          setPagos(data.pagos);
          setCodigos(data.codigos);
          cargarConfig();
          cargarPaquetes(d.token);
        } else {
          setError("Error cargando el panel");
        }
      } else {
        setError(d.error ?? "Código incorrecto");
      }
    } finally {
      setVerificandoOtp(false);
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

  // Cuando Google auth está activo, obtener el token de admin automáticamente
  useEffect(() => {
    if (googleAutenticado && !autenticado) {
      fetch("/api/admin-token")
        .then((r) => r.json())
        .then(async (d) => {
          if (d.token) {
            setClave(d.token);
            const r = await fetch("/api/admin-dashboard", { headers: { "x-admin-key": d.token } });
            if (r.ok) {
              const data = await r.json();
              setAutenticado(true);
              setResumen(data.resumen);
              setPagos(data.pagos);
              setCodigos(data.codigos);
              cargarConfig();
              cargarPaquetes(d.token);
            }
          }
        })
        .catch(console.error);
    }
  }, [googleAutenticado, autenticado, cargarPaquetes]);

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

  if (status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0A0A0C]">
        <div className="w-8 h-8 rounded-full bg-[#6E3FA3] animate-pulse" />
      </main>
    );
  }

  if (!autenticado) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0A0A0C] px-5">
        <div className="w-full max-w-xs">
          <div className="w-12 h-12 rounded-full bg-[#6E3FA3] flex items-center justify-center mx-auto mb-6">
            <span className="text-white text-xl">S</span>
          </div>
          <p className="text-white text-center text-lg font-medium mb-6">Panel WAIFAI</p>

          {/* WhatsApp OTP */}
          {!otpEnviado ? (
            <button
              onClick={solicitarOtp}
              disabled={enviandoOtp}
              className="w-full py-3 rounded-xl bg-[#25D366] text-white font-medium mb-4 flex items-center justify-center gap-2 hover:bg-[#1ebe57] transition disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              {enviandoOtp ? "Enviando..." : "Recibir código por WhatsApp"}
            </button>
          ) : (
            <div className="mb-4">
              <p className="text-[#A0A0A8] text-sm text-center mb-3">
                📲 Código enviado a tu WhatsApp. Ingresalo acá:
              </p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={codigoOtp}
                onChange={(e) => setCodigoOtp(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && codigoOtp.length === 6 && verificarOtp()}
                placeholder="123456"
                className="w-full px-4 py-3 rounded-xl bg-[#18181B] border border-[#2A2A2E] text-white text-center text-2xl tracking-widest mb-3"
              />
              <button
                onClick={verificarOtp}
                disabled={verificandoOtp || codigoOtp.length !== 6}
                className="w-full py-3 rounded-xl bg-[#25D366] text-white font-medium disabled:opacity-50"
              >
                {verificandoOtp ? "Verificando..." : "Ingresar"}
              </button>
              <button
                onClick={() => { setOtpEnviado(false); setCodigoOtp(""); setError(""); }}
                className="w-full mt-2 text-[#5A5A60] text-xs text-center"
              >
                Volver / Reenviar código
              </button>
            </div>
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

  const TABS = ["resumen", "dispositivos", "pagos", "codigos", "paquetes", "config"] as const;
  const LABELS: Record<string, string> = {
    resumen: "Resumen", dispositivos: "Buses", pagos: "Pagos", codigos: "Códigos", paquetes: "Paquetes", config: "Config"
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
          <button onClick={() => { cargarDatos(clave); if (tab === "dispositivos") cargarDispositivos(clave); }}
            className="text-[#8B5FBF] text-sm underline">Actualizar</button>
          {googleAutenticado && (
            <button
              onClick={() => { signOut({ callbackUrl: "/admin" }); setAutenticado(false); setClave(""); }}
              className="text-[#5A5A60] text-xs underline ml-2"
            >
              Salir
            </button>
          )}
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
