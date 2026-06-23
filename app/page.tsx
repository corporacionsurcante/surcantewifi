"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { initMercadoPago, Payment } from "@mercadopago/sdk-react";
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
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  const [cargandoPreferencia, setCargandoPreferencia] = useState(false);
  const [resultado, setResultado] = useState<"aprobado" | "error" | null>(null);
  const [macDePrueba, setMacDePrueba] = useState("");

  const [mostrarCodigo, setMostrarCodigo] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [errorCodigo, setErrorCodigo] = useState<string | null>(null);
  const [canjeando, setCanjeando] = useState(false);

  useEffect(() => {
    initMercadoPago(process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY!, {
      locale: "es-AR",
    });
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
  const planActual = PLANES.find((p) => p.id === planSeleccionado) ?? PLANES[1];

  async function abrirPago() {
    setCargandoPreferencia(true);
    setPreferenceId(null);
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
      const datos = await respuesta.json();
      // crear-pago ahora debe devolver también el preferenceId de MP
      setPreferenceId(datos.mpPreferenceId);
    } catch (e) {
      console.error(e);
    } finally {
      setCargandoPreferencia(false);
    }
  }

  async function onSubmitBrick(formData: unknown) {
    const respuesta = await fetch("/api/procesar-pago", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formData,
        planId: planSeleccionado,
        clientMac: macCliente,
        apMac: macAp,
        ssidName: nombreSsid,
        site: nombreSitio,
      }),
    });
    const datos = await respuesta.json();
    if (datos.exito) {
      setResultado("aprobado");
    } else {
      setResultado("error");
    }
  }

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

  if (resultado === "aprobado") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-5">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-3xl">✓</span>
          </div>
          <p className="text-white text-xl font-medium mb-2">¡Pago aprobado!</p>
          <p className="text-[#A0A0A8] text-sm">Ya podés navegar con {planActual.nombre}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-5 py-9">
      <div className="w-full max-w-sm">

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
          <p className="text-white text-xl font-medium mt-4 mb-1">Surcante WiFi</p>
          <p className="text-[#A0A0A8] text-[13px]">Tu viaje, conectado</p>
        </div>

        <p className="text-xs font-medium text-[#8B5FBF] uppercase tracking-wide mb-3">
          Elegí tu plan
        </p>

        <div className="flex flex-col gap-2.5">
          {PLANES.map((plan) => (
            <button
              key={plan.id}
              onClick={() => { setPlanSeleccionado(plan.id); setPreferenceId(null); }}
              className={`flex items-center justify-between rounded-2xl px-4 py-3.5 text-left transition border ${
                planSeleccionado === plan.id
                  ? "bg-[#211A2B] border-[#8B5FBF]"
                  : "bg-[#18181B] border-[#2A2A2E]"
              }`}
            >
              <div>
                <p className="text-[14px] font-medium text-white">{plan.nombre}</p>
                <p className="text-[13px] text-[#A0A0A8] mt-0.5">{plan.descripcion}</p>
              </div>
              <p className="text-[18px] font-medium text-white whitespace-nowrap ml-3">
                ${plan.precio.toLocaleString("es-AR")}
              </p>
            </button>
          ))}
        </div>

        {!preferenceId ? (
          <button
            onClick={abrirPago}
            disabled={cargandoPreferencia}
            className="w-full mt-5 py-3.5 rounded-xl text-[15px] font-medium bg-[#6E3FA3] hover:bg-[#5A3286] active:scale-[0.98] transition disabled:opacity-60"
          >
            {cargandoPreferencia ? "Preparando..." : "Pagar y conectarme"}
          </button>
        ) : (
          <div className="mt-5">
            <Payment
              initialization={{
                amount: planActual.precio,
                preferenceId,
              }}
              customization={{
                paymentMethods: {
                  ticket: "all",
                  bankTransfer: "all",
                  creditCard: "all",
                  debitCard: "all",
                  mercadoPago: "all",
                },
              }}
              onSubmit={onSubmitBrick}
              onError={(error) => console.error("[brick]", error)}
            />
          </div>
        )}

        {resultado === "error" && (
          <p className="text-sm text-red-400 mt-4 text-center">
            El pago no pudo procesarse. Intentá de nuevo.
          </p>
        )}

        <p className="text-[11px] text-[#5A5A60] text-center mt-4">
          Al continuar aceptás los términos de servicio · Surcante
        </p>

        {!mostrarCodigo ? (
          <button
            onClick={() => setMostrarCodigo(true)}
            className="block w-full text-center text-[12px] text-[#5A5A60] mt-6 underline"
          >
            ¿Tenés un código de acceso?
          </button>
        ) : (
          <div className="mt-6 pt-5 border-t border-[#2A2A2E]">
            <p className="text-[12px] text-[#A0A0A8] mb-2 text-center">
              Ingresá tu código de acceso
            </p>
            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX"
              className="w-full px-4 py-3 rounded-xl bg-[#18181B] border border-[#2A2A2E] text-white text-center font-mono tracking-wide mb-2"
            />
            {errorCodigo && (
              <p className="text-sm text-red-400 mb-2 text-center">{errorCodigo}</p>
            )}
            <button
              onClick={canjearCodigo}
              disabled={canjeando || !codigo}
              className="w-full py-3 rounded-xl text-[14px] font-medium bg-[#18181B] border border-[#2A2A2E] hover:bg-[#211A2B] transition disabled:opacity-60"
            >
              {canjeando ? "Validando..." : "Usar código"}
            </button>
          </div>
        )}

      </div>
    </main>
  );
}
