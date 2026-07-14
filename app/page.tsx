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
  const [cargando, setCargando] = useState<"mp" | "nave" | "whatsapp" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(true);
  const [accesoAutomatico, setAccesoAutomatico] = useState(false);

  const [mostrarCodigo, setMostrarCodigo] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [errorCodigo, setErrorCodigo] = useState<string | null>(null);
  const [canjeando, setCanjeando] = useState(false);

  const [macDePrueba, setMacDePrueba] = useState("");
  const [config, setConfig] = useState({ nave: true, mp: true, whatsapp: true });
  
  // Estado para controlar visualmente si el usuario está atrapado en el CNA
  const [estaEnCNA, setEstaEnCNA] = useState(false);

  const macCliente = parametros.get("clientMac") || macDePrueba;
  const macAp = parametros.get("apMac") ?? "";
  const urlRedireccion = parametros.get("redirectUrl") ?? "";
  const nombreSsid = parametros.get("ssidName") ?? "";
  const nombreSitio = parametros.get("site") ?? "";

  // 🌟 EFECTO DE DETECCIÓN Y DESVÍO AUTOMÁTICO DEL MINI-NAVEGADOR (CNA) 🌟
  useEffect(() => {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    let cnaDetectado = false;

    // 1. Validar iOS
    if (/iPhone|iPad|iPod/i.test(ua)) {
      if (navigator.standalone || /CriOS/i.test(ua) || /FxiOS/i.test(ua)) {
        cnaDetectado = false;
      } else if (!/Safari/i.test(ua) || /AppleWebKit\/[0-9\.]+.*Mobile/i.test(ua) && !/Version\/[0-9\.]+/i.test(ua)) {
        cnaDetectado = true;
      }
    }

    // 2. Validar Android
    if (/Android/i.test(ua)) {
      if (/wv/i.test(ua) || /Version\/[0-9\.]+/i.test(ua) && /Chrome\/[0-9\.]+/i.test(ua) === false) {
        cnaDetectado = true;
      }
    }

    if (cnaDetectado) {
      setEstaEnCNA(true);
      const currentUrl = window.location.href;

      // Desvío automático para Android
      if (/Android/i.test(ua)) {
        const chromeIntent = "intent://" + currentUrl.replace(/^https?:\/\//, "") + "#Intent;scheme=http;package=com.android.chrome;end";
        window.location.href = chromeIntent;
      } 
      // Desvío automático para iOS (romper sandbox)
      else if (/iPhone|iPad|iPod/i.test(ua)) {
        const safariForceUrl = currentUrl + "?forceSafari=true";
        const link = document.createElement('a');
        link.href = safariForceUrl;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
      }
    }
  }, []);

  useEffect(() => {
    const clave = "surcante-mac-prueba";
    let mac = window.localStorage.getItem(clave);
    if (!mac) {
      mac = "PRUEBA-" + Math.random().toString(36).slice(2, 10).toUpperCase();
      window.localStorage.setItem(clave, mac);
    }
    setMacDePrueba(mac);

    // Carga configuración de medios de pago
    fetch("/api/config-publica")
      .then((r) => r.json())
      .then((datos) => setConfig(datos))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const mac = parametros.get("clientMac") || macDePrueba;
    if (!mac || mac.startsWith("PRUEBA-")) {
      setVerificando(false);
      return;
    }

    // Verifica si esta MAC ya tiene acceso activo
    fetch("/api/verificar-acceso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientMac: mac,
        apMac: parametros.get("apMac") ?? "",
        ssidName: parametros.get("ssidName") ?? "",
        site: parametros.get("site") ?? "",
      }),
    })
      .then((r) => r.json())
      .then((datos) => {
        if (datos.tieneAcceso) {
          setAccesoAutomatico(true);
          // Redirigir a la URL original si existe
          const redirect = parametros.get("redirectUrl");
          if (redirect) {
            setTimeout(() => {
              window.location.href = redirect;
            }, 2000);
          }
        }
      })
      .catch(() => {})
      .finally(() => setVerificando(false));
  }, [macDePrueba, parametros]);

  async function pagar(medio: "mp" | "nave") {
    setError(null);
    setCargando(medio);
    try {
      const endpoint = medio === "nave" ? "/api/crear-pago-nave" : "/api/crear-pago";
      const respuesta = await fetch(endpoint, {
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
      if (!respuesta.ok) throw new Error("Error al iniciar el pago");
      const datos = await respuesta.json();
      window.location.href = datos.urlPago;
    } catch (e) {
      setError("Hubo un problema al iniciar el pago. Probá de nuevo.");
      setCargando(null);
    }
  }

  async function pagarPorWhatsApp() {
    setError(null);
    setCargando("whatsapp");
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
      if (!respuesta.ok) throw new Error("Error al iniciar el pago");
      const datos = await respuesta.json();
      const planActual = PLANES.find((p) => p.id === planSeleccionado) ?? PLANES[1];
      const mensaje = `🛜 Mi link de pago WAIFAI\n${planActual.nombre} - $${planActual.precio.toLocaleString("es-AR")}\n\n${datos.urlPago}`;
      window.location.href = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    } catch (e) {
      setError("Hubo un problema. Probá de nuevo.");
    } finally {
      setCargando(null);
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

  const ocupado = cargando !== null;

  // Pantalla de verificando acceso
  if (verificando) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-[#0A0A0C]">
        <div className="w-8 h-8 rounded-full bg-[#6E3FA3] animate-pulse mx-auto mb-4" />
        <p className="text-[#A0A0A8] text-sm">Verificando acceso...</p>
      </main>
    );
  }

  // Pantalla de acceso automático reconocido
  if (accesoAutomatico) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-5 bg-[#0A0A0C]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-700 flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-3xl">✓</span>
          </div>
          <p className="text-white text-xl font-medium mb-2">¡Bienvenido de vuelta!</p>
          <p className="text-[#A0A0A8] text-sm">Tu acceso sigue activo. Conectando...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-5 py-9 bg-[#0A0A0C]">
      <div className="w-full max-w-sm">

        {/* 🌟 CARTEL DE RESPALDO MANUAL PARA ESCAPAR DEL CNA 🌟 */}
        {estaEnCNA && (
          <div className="w-full p-4 mb-6 bg-[#211A2B] border border-amber-500/40 text-amber-200 text-center rounded-2xl shadow-md">
            <p className="font-bold text-sm text-amber-400">⚠️ IMPORTANTE PARA MERCADO PAGO</p>
            <p className="text-[12px] text-gray-300 mt-1 leading-relaxed">
              Para poder pagar con tu aplicación sin bloqueos del sistema, necesitas abrir este portal en tu navegador principal.
            </p>
            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  const currentUrl = window.location.href;
                  window.location.href = "intent://" + currentUrl.replace(/^https?:\/\//, "") + "#Intent;scheme=http;package=com.android.chrome;end";
                }
              }}
              className="inline-block mt-3 w-full py-2 bg-amber-500 hover:bg-amber-600 text-[#0A0A0C] font-semibold text-xs rounded-xl transition shadow-sm"
            >
              Abrir en Chrome (Android)
            </button>
            <p className="text-[11px] text-gray-400 mt-2">
              En iPhone (iOS): Toca los tres puntos de la esquina y selecciona <b>"Abrir en Safari"</b>.
            </p>
          </div>
        )}

        <div className="text-center mb-7">
          <div className="flex items-center justify-center gap-1.5 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8B5FBF] animate-pulse" />
            <span className="text-[11px] text-[#A0A0A8] tracking-wide">
              CONECTADO A WIFI SURCANTE
            </span>
          </div>
