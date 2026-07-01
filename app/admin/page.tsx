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

export default function PanelAdmin() {
  const [clave, setClave] = useState("");
  const [autenticado, setAutenticado] = useState(false);
  const [claveIngresada, setClaveIngresada] = useState("");
  const [error, setError] = useState("");
  const [resumen, setResumen] = useState<ResumenData | null>(null);
  const [pagos, setPagos] = useState<PagoData[]>([]);
  const [codigos, setCodigos] = useState<CodigoData[]>([]);
  const [tab, setTab] = useState<"resumen" | "pagos" | "codigos">("resumen");
  const [generando, setGenerando] = useState(false);
  const [cantidadCodigos, setCantidadCodigos] = useState(1);
  const [creadoPor, setCreadoPor] = useState("");

  const cargarDatos = useCallback(async (claveAdmin: string) => {
    try {
      const respuesta = await fetch("/api/admin-dashboard", {
        headers: { "x-admin-key": claveAdmin },
      });
      if (!respuesta.ok) {
        setAutenticado(false);
        return;
      }
      const datos = await respuesta.json();
      setResumen(datos.resumen);
      setPagos(datos.pagos);
      setCodigos(datos.codigos);
    } catch (e) {
      console.error(e);
    }
  }, []);

  async function ingresar() {
    setError("");
    const respuesta = await fetch("/api/admin-dashboard", {
      headers: { "x-admin-key": claveIngresada },
    });
    if (respuesta.ok) {
      const datos = await respuesta.json();
      setClave(claveIngresada);
      setAutenticado(true);
      setResumen(datos.resumen);
      setPagos(datos.pagos);
      setCodigos(datos.codigos);
    } else {
      setError("Clave incorrecta");
    }
  }

  async function generarCodigos() {
    setGenerando(true);
    try {
      await fetch("/api/admin-codigos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": clave,
        },
        body: JSON.stringify({ cantidad: cantidadCodigos, creadoPor }),
      });
      await cargarDatos(clave);
    } finally {
      setGenerando(false);
    }
  }

  useEffect(() => {
    if (autenticado && clave) {
      const intervalo = setInterval(() => cargarDatos(clave), 30000);
      return () => clearInterval(intervalo);
    }
  }, [autenticado, clave, cargarDatos]);

  const formatPeso = (n: number) =>
    "$" + n.toLocaleString("es-AR", { minimumFractionDigits: 0 });

  const formatFecha = (ts: number) =>
    new Date(ts).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (!autenticado) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0A0A0C] px-5">
        <div className="w-full max-w-xs">
          <div className="w-12 h-12 rounded-full bg-[#6E3FA3] flex items-center justify-center mx-auto mb-6">
            <span className="text-white text-xl font-medium">S</span>
          </div>
          <p className="text-white text-center text-lg font-medium mb-6">
            Panel WAIFAI
          </p>
          <input
            type="password"
            value={claveIngresada}
            onChange={(e) => setClaveIngresada(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ingresar()}
            placeholder="Clave de acceso"
            className="w-full px-4 py-3 rounded-xl bg-[#18181B] border border-[#2A2A2E] text-white mb-3"
          />
          {error && (
            <p className="text-red-400 text-sm text-center mb-3">{error}</p>
          )}
          <button
            onClick={ingresar}
            className="w-full py-3 rounded-xl bg-[#6E3FA3] text-white font-medium"
          >
            Ingresar
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0A0A0C] text-white px-4 py-6">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#6E3FA3] flex items-center justify-center">
              <span className="text-white text-sm font-medium">S</span>
            </div>
            <p className="text-white font-medium">Panel WAIFAI</p>
          </div>
          <button
            onClick={() => cargarDatos(clave)}
            className="text-[#8B5FBF] text-sm underline"
          >
            Actualizar
          </button>
        </div>

        {/* TABS */}
        <div className="flex gap-2 mb-6">
          {(["resumen", "pagos", "codigos"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                tab === t
                  ? "bg-[#6E3FA3] text-white"
                  : "bg-[#18181B] text-[#A0A0A8] border border-[#2A2A2E]"
              }`}
            >
              {t === "resumen" ? "Resumen" : t === "pagos" ? "Pagos" : "Códigos"}
            </button>
          ))}
        </div>

        {/* RESUMEN */}
        {tab === "resumen" && resumen && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#18181B] border border-[#2A2A2E] rounded-2xl p-4">
                <p className="text-[#A0A0A8] text-xs mb-1">Recaudado hoy</p>
                <p className="text-white text-2xl font-medium">
                  {formatPeso(resumen.recaudacionHoy)}
                </p>
                <p className="text-[#A0A0A8] text-xs mt-1">
                  {resumen.pagosHoy} pagos
                </p>
              </div>
              <div className="bg-[#18181B] border border-[#2A2A2E] rounded-2xl p-4">
                <p className="text-[#A0A0A8] text-xs mb-1">Total histórico</p>
                <p className="text-white text-2xl font-medium">
                  {formatPeso(resumen.recaudacionTotal)}
                </p>
                <p className="text-[#A0A0A8] text-xs mt-1">
                  {resumen.totalPagos} pagos
                </p>
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

        {/* PAGOS */}
        {tab === "pagos" && (
          <div className="flex flex-col gap-2">
            {pagos.length === 0 ? (
              <p className="text-[#A0A0A8] text-center py-8">Sin pagos todavía</p>
            ) : (
              pagos.map((p) => (
                <div key={p.id} className="bg-[#18181B] border border-[#2A2A2E] rounded-2xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-white text-sm font-medium">{p.plan}</p>
                      <p className="text-[#A0A0A8] text-xs mt-0.5">
                        {p.procesador === "nave" ? "Nave/Galicia" : "Mercado Pago"}
                      </p>
                    </div>
                    <p className="text-white font-medium">{formatPeso(p.monto)}</p>
                  </div>
                  <p className="text-[#5A5A60] text-xs font-mono">{p.mac}</p>
                  <p className="text-[#5A5A60] text-xs mt-1">
                    {p.fechaPago ? formatFecha(p.fechaPago) : "-"}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {/* CÓDIGOS */}
        {tab === "codigos" && (
          <div className="flex flex-col gap-4">
            <div className="bg-[#18181B] border border-[#2A2A2E] rounded-2xl p-4">
              <p className="text-[#A0A0A8] text-xs mb-3">Generar códigos nuevos</p>
              <input
                type="text"
                value={creadoPor}
                onChange={(e) => setCreadoPor(e.target.value.toUpperCase())}
                placeholder="Iniciales (ej: JB, SM)"
                className="w-full px-4 py-2.5 rounded-xl bg-[#0A0A0C] border border-[#2A2A2E] text-white mb-2 text-sm"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  value={cantidadCodigos}
                  onChange={(e) => setCantidadCodigos(Math.min(50, Math.max(1, Number(e.target.value))))}
                  min={1}
                  max={50}
                  className="w-20 px-3 py-2.5 rounded-xl bg-[#0A0A0C] border border-[#2A2A2E] text-white text-sm"
                />
                <button
                  onClick={generarCodigos}
                  disabled={generando || !creadoPor}
                  className="flex-1 py-2.5 rounded-xl bg-[#6E3FA3] text-white text-sm font-medium disabled:opacity-60"
                >
                  {generando ? "Generando..." : `Generar ${cantidadCodigos} código${cantidadCodigos > 1 ? "s" : ""}`}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {codigos.length === 0 ? (
                <p className="text-[#A0A0A8] text-center py-8">Sin códigos todavía</p>
              ) : (
                codigos.map((c) => (
                  <div key={c.codigo} className="bg-[#18181B] border border-[#2A2A2E] rounded-2xl p-4">
                    <div className="flex justify-between items-start">
                      <p className="text-white font-mono font-medium">{c.codigo}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        c.estado === "usado"
                          ? "bg-green-900 text-green-400"
                          : "bg-[#2A2A2E] text-[#A0A0A8]"
                      }`}>
                        {c.estado === "usado" ? "Usado" : "Disponible"}
                      </span>
                    </div>
                    <p className="text-[#5A5A60] text-xs mt-1">
                      Creado por {c.creadoPor} · {formatFecha(c.creadoEn)}
                    </p>
                    {c.estado === "usado" && c.mac && (
                      <p className="text-[#5A5A60] text-xs mt-0.5 font-mono">
                        {c.mac} · {c.usadoEn ? formatFecha(c.usadoEn) : ""}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
