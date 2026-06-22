"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PLANES } from "@/lib/planes";

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

  // Estados nuevos para el manejo del link alternativo
  const [urlPagoGenerada, setUrlPagoGenerada] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

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

  async function pagarYConectarme() {
    setError(null);
    setCargando(true);
    setUrlPagoGenerada(null);
    setCopiado(false);
    
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
      
      // Guardamos la URL generada para mostrarla como alternativa de escape
      setUrlPagoGenerada(datos.urlPago);
      setCargando(false);

      // Intento estándar: Abrir en una pestaña nueva (puede ser bloqueado por el mini-navegador)
      window.open(datos.urlPago, "_blank");
      
    } catch (e) {
      setError("Hubo un problema al iniciar el pago. Probá de nuevo.");
      setCargando(false);
    }
  }

  const copiarAlPortapapeles = async () => {
    if (urlPagoGenerada) {
      try {
        await navigator.clipboard.writeText(urlPagoGenerada);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 3000);
      } catch (err) {
        // Resguardo manual si la API de portapapeles está bloqueada en el mini-navegador
        const input = document.createElement("input");
        input.value = urlPagoGenerada;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 3000);
      }
    }
  };

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

        {/* Botón principal de acción */}
        {!urlPagoGenerada && (
          <button
            onClick={pagarYConectarme}
            disabled={cargando}
            className="w-full mt-5 py-3.5 rounded-xl text-[15px] font-medium bg-[#6E3FA3] hover:bg-[#5A3286] active:scale-[0.98] transition disabled:opacity-60"
          >
            {cargando ? "Generando pago..." : "Pagar y conectarme"}
          </button>
        )}

        {/* --- SECCIÓN DE ESCAPE COMPATIBLE CON IPHONE / TABLETS --- */}
        {urlPagoGenerada && (
          <div className="mt-5 p-4 rounded-xl bg-[#211A2B] border border-[#8B5FBF] text-center">
            <p className="text-sm text-white font-medium mb-3">
              ¡Link de Mercado Pago listo!
            </p>
            
            <a 
              href={urlPagoGenerada} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block w-full py-3 mb-2.5 rounded-lg text-xs bg-[#6E3FA3] text-white font-medium hover:bg-[#5A3286]"
            >
              1. Intentar abrir la App otra vez
            </a>

            <div className="border-t border-dashed border-[#8B5FBF]/30 my-3"></div>

            <p className="text-[11px] text-[#A0A0A8] mb-2">
              Si te dejó atrapado en esta pantalla, copiá el link de abajo, abrí Safari o Chrome y pegalo ahí para forzar la App:
            </p>

            <button
              onClick={copiarAlPortapapeles}
              className={`w-full py-2.5 rounded-lg text-xs font-medium transition ${
                copiado 
                  ? "bg-green-600 text-white" 
                  : "bg-[#18181B] text-white border border-[#2A2A2E] hover:bg-[#252529]"
              }`}
            >
              {copiado ? "✓ ¡Enlace copiado!" : "2. Copiar enlace de pago"}
            </button>
          </div>
        )}

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
}: {
  mostrar: boolean;
  onMostrar: () => void;
  codigo: string;
  onCambiarCodigo: (valor: string) => void;
  onCanjear: () => void;
  canjeando: boolean;
  error: string | null;
}) {
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
        {canjeando ? "Validando..." : "Usar código"}
      </button>
    </div>
  );
}

function CabeceraMarca() {
  return (
    <div className="text-center mb-7">
      <div className="flex items-center justify-center gap-1.5 mb-5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#8B5FBF] animate-pulse" />
        <span className="text-[11px] text-[#A0A0A8] tracking-wide">
          CONECTADO A WIFI SURCANTE
        </span>
      </div>
      <div className="w-16 h-16 rounded-full bg-[#6E3FA3] flex items-center justify-center mx-auto">
        <span className="text-white text-3xl font-medium">S</span>
      </div>
      <p className="text-white text-xl font-medium mt-4 mb-1">
        Surcante WiFi
      </p>
      <p className="text-[#A0A0A8] text-[13px]">Tu viaje, conectado</p>
    </div>
  );
}

function TarjetaPlan({
  nombre,
  descripcion,
  precio,
  seleccionado,
  onClick,
}: {
  nombre: string;
  descripcion: string;
  precio: number;
  seleccionado: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between rounded-2xl px-4 py-3.5 text-left transition border ${
        seleccionado
          ? "bg-[#211A2B] border-[#8B5FBF]"
          : "bg-[#18181B] border-[#2A2A2E]"
      }`}
    >
      <div>
        <p className="text-[14px] font-medium text-white">{nombre}</p>
        <p className="text-[13px] text-[#A0A0A8] mt-0.5">{descripcion}</p>
      </div>
      <p className="text-[18px] font-medium text-white whitespace-nowrap ml-3">
        ${precio.toLocaleString("es-AR")}
      </p>
    </button>
  );
}
