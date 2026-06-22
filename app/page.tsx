"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PLANES } from "@/lib/planes";

interface TarjetaPlanProps {
  nombre: string;
  descripcion: string;
  precio: number;
  seleccionado: boolean;
  onClick: () => void;
}

interface SeccionCodigoProps {
  mostrar: boolean;
  onMostrar: () => void;
  codigo: string;
  onCambiarCodigo: (valor: string) => void;
  onCanjear: () => void;
  canjeando: boolean;
  error: string | null;
}

export default function PaginaPortal() {
  return (
    <Suspense fallback={null}>
      <ContenidoPortal />
    </Suspense>
  );
}

function ContenidoPortal() {
  const parametros = useSearchParams();
  const [planSeleccionado, setPlanSeleccionado] = useState(PLANES[1].id);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mostrarCodigo, setMostrarCodigo] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [errorCodigo, setErrorCodigo] = useState<string | null>(null);
  const [canjeando, setCanjeando] = useState(false);

  const [macDePrueba, setMacDePrueba] = useState("");
  
  useEffect(() => {
    const clave = "surcante-mac-prueba";
    let mac = window.localStorage.getItem(clave);
    if (!mac) {
      mac = "PRUEBA-" + Math.random().toString(36).slice(2, 10).toUpperCase();
      window.localStorage.setItem(clave, mac);
    }
    setMacDePrueba(mac);
  }, []);

  const macCliente = parametros.get("clientMac") || macDePrueba;
  const macAp = parametros.get("apMac") ?? "";
  const urlRedireccion = parametros.get("redirectUrl") ?? "";
  const nombreSsid = parametros.get("ssidName") ?? "";
  const nombreSitio = parametros.get("site") ?? "";

  async function canjearCodigo() {
    setErrorCodigo(null);
    setCanjeando(true);
    try {
      const respuesta = await fetch("/api/canjear-codigo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo,
          clientMac: macCliente,
          apMac: macAp,
          ssidName: nombreSsid,
          site: nombreSitio,
        }),
      });
      const datos = await respuesta.json();
      if (datos.exito) {
        window.location.href = "/pagado?codigo=true";
      } else {
        setErrorCodigo(datos.motivo ?? "Código inválido");
      }
    } catch {
      setErrorCodigo("Hubo un problema. Probá de nuevo.");
    } finally {
      setCanjeando(false);
    }
  }

  async function pagarYConectarme(usarAppDirecta: boolean = false) {
    setError(null);
    setCargando(true);
    try {
      const respuesta = await fetch("/api/crear-pago", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: planSeleccionado,
          clientMac: macCliente,
          apMac: macAp,
          redirectUrl: urlRedireccion,
          ssidName: nombreSsid,
          site: nombreSitio,
        }),
      });

      if (!respuesta.ok) {
        throw new Error("No pudimos iniciar el pago");
      }

      const datos = await respuesta.json();
      
      if (usarAppDirecta) {
        window.open(datos.urlPago, "_blank");
        setCargando(false);
      } else {
        window.location.href = datos.urlPago;
      }

    } catch (e) {
      setError("Hubo un problema al iniciar el pago. Probá de nuevo.");
      setCargando(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-5 py-9">
      <div className="w-full max-w-sm">
        <CabeceraMarca />

        <p className="text-xs font-medium text-[#8B5FBF] uppercase tracking-wide mb-3">
          Elegí tu plan
        </p>

        <div className="flex flex-col gap-2.5">
          {PLANES.map((plan) => (
            <TarjetaPlan
              key={plan.id}
              nombre={plan.nombre}
              descripcion={plan.descripcion}
              precio={plan.precio}
              seleccionado={planSeleccionado === plan.id}
              onClick={() => setPlanSeleccionado(plan.id)}
            />
          ))}
        </div>

        {error && (
          <p className="text-sm text-red-400 mt-4 text-center">{error}</p>
        )}

        <button
          onClick={() => pagarYConectarme(false)}
          disabled={cargando}
          className="w-full mt-5 py-3.5 rounded-xl text-[15px] font-medium bg-[#6E3FA3] hover:bg-[#5A3286] active:scale-[0.98] transition disabled:opacity-60"
        >
          {cargando ? "Abriendo pago..." : "Pagar en este navegador"}
        </button>

        <button
          onClick={() => pagarYConectarme(true)}
          disabled={cargando}
          className="w-full mt-2.5 py-3 rounded-xl text-[13px] font-medium bg-[#18181B] text-white border border-[#8B5FBF] hover:bg-[#211A2B] active:scale-[0.98] transition disabled:opacity-60"
        >
          {cargando ? "Forzando..." : "📱 Abrir en la App de Mercado Pago"}
        </button>

        <p className="text-[11px] text-[#5A5A60] text-center mt-2.5 px-2">
          Nota: Si el primer botón falla o no te deja usar tu cuenta, usá el botón de la <b>App de Mercado Pago</b> para saltar el bloqueo.
        </p>

        <p className="text-[11px] text-[#5A5A60] text-center mt-4">
          Al continuar aceptás los términos de servicio · Surcante
        </p>

        <SeccionCodigo
          mostrar={mostrarCodigo}
          onMostrar={() => setMostrarCodigo(true)}
          codigo={codigo}
          onCambiarCodigo={setCodigo}
          onCanjear={canjearCodigo}
          canjeando={canjeando}
          error={errorCodigo}
        />
      </div>
    </main>
  );
}

function SeccionCodigo({
  mostrar,
  onMostrar,
  codigo,
  onCambiarCodigo,
  onCanjear,
  canjeando,
  error,
}: SeccionCodigoProps) {
  if (!mostrar) {
    return (
      <button
        onClick={onMostrar}
        className="block w-full text-center text-[12px] text-[#5A5A60] mt-6 underline"
      >
        ¿Tenés un código de acceso?
      </button>
    );
  }

  return (
    <div className="mt-6 pt-5 border-t border-[#2A2A2E]">
      <p className="text-[12px] text-[#A0A0A8] mb-2 text-center">
        Ingresá tu código de acceso
      </p>
      <input
        type="text"
        value={codigo}
        onChange={(e) => onCambiarCodigo(e.target.value.toUpperCase())}
        placeholder="XXXX-XXXX"
        className="w-full px-4 py-3 rounded-xl bg-[#18181B] border border-[#2A2A2E] text-white text-center font-mono tracking-wide mb-2"
      />
      {error && (
        <p className="text-sm text-red-400 mb-2 text-center">{error}</p>
      )}
      <button
        onClick={onCanjear}
        disabled={canjeando || !codigo}
        className="w-full py-3 rounded-xl text-[14px] font-medium bg-[#18181B] border border-[#2A2A2E] hover:bg-[#211A2B] transition disabled:opacity-60"
      >
        {canjeando ? "
