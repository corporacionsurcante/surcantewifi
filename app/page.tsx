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

  const macCliente = parametros.get("clientMac") || macDePrueba;
  const macAp = parametros.get("apMac") ?? "";
  const urlRedireccion = parametros.get("redirectUrl") ?? "";
  const nombreSsid = parametros.get("ssidName") ?? "";
  const nombreSitio = parametros.get("site") ?? "";

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

  // --- Helpers de plataforma y apertura ---
  function isAndroid() {
    return /android/i.test(navigator.userAgent);
  }
  function isiOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
  }

  // Intenta abrir URL en la ventana/popup (ya creada para preservar gesto).
  // Implementa intent:// para Android y esquema mercadopago:// para iOS con fallback al URL https.
  function abrirUrlConEstrategias(url: string, popup: Window | null) {
    console.log("[abrirUrlConEstrategias] url:", url, "isAndroid:", isAndroid(), "isiOS:", isiOS(), "popup:", !!popup);

    // Si hay popup (creado sincrónicamente), usarlo primero.
    if (popup) {
      try {
        if (isAndroid()) {
          // Construir intent para intentar abrir la app de Mercado Pago en Android.
          // Nota: el formato puede variar por app/version; usamos browser_fallback_url para volver al https.
          const withoutScheme = url.replace(/^https?:\/\//, "");
          const intentUrl = `intent://${withoutScheme}#Intent;scheme=https;package=com.mercadolibre.android;S.browser_fallback_url=${encodeURIComponent(
            url
          )};end`;
          console.log("[abrirUrlConEstrategias] intentando intent Android:", intentUrl);
          try {
            popup.location.href = intentUrl;
            // fallback: si no se abre la app, después de 1s cargamos el https normal
            setTimeout(() => {
              try {
                popup.location.href = url;
              } catch (e) {
                console.log("[abrirUrlConEstrategias] fallback popup -> url failed", e);
              }
            }, 1200);
            return;
          } catch (e) {
            console.log("[abrirUrlConEstrategias] fallo al asignar intent en popup", e);
          }
        }

        if (isiOS()) {
          // Intento esquema custom para Mercado Pago en iOS (si la app lo soporta).
          // No hay garantía: depende de la existencia del esquema. Ajustar si tenés un esquema oficial.
          const appScheme = `mercadopago://payment?url=${encodeURIComponent(url)}`;
          console.log("[abrirUrlConEstrategias] intentando scheme iOS:", appScheme);
          try {
            popup.location.href = appScheme;
            // fallback a https después de un timeout corto
            setTimeout(() => {
              try {
                popup.location.href = url;
              } catch (e) {
                console.log("[abrirUrlConEstrategias] fallback popup -> url failed", e);
              }
            }, 1200);
            return;
          } catch (e) {
            console.log("[abrirUrlConEstrategias] fallo al asignar scheme en popup", e);
          }
        }

        // Para otros casos o si esquemas fallan, navegar directamente al URL
        try {
          popup.location.href = url;
          return;
        } catch (e) {
          console.log("[abrirUrlConEstrategias] asignar popup.location.href directo falló", e);
        }
      } catch (e) {
        console.log("[abrirUrlConEstrategias] error usando popup:", e);
      }
    }

    // Si no hay popup o los intentos con popup fallaron, intentar abrir por otros medios:

    // 1) Intent Android directo en la ventana actual (puede forzar abrir la app)
    if (isAndroid()) {
      const withoutScheme = url.replace(/^https?:\/\//, "");
      const intentUrl = `intent://${withoutScheme}#Intent;scheme=https;package=com.mercadolibre.android;S.browser_fallback_url=${encodeURIComponent(
        url
      )};end`;
      try {
        console.log("[abrirUrlConEstrategias] fallback: window.location -> intent", intentUrl);
        window.location.href = intentUrl;
        return;
      } catch (e) {
        console.log("[abrirUrlConEstrategias] fallback intent en window.location falló", e);
      }
    }

    // 2) Intent iOS: intentar scheme (esto normalmente abre la app si está instalada)
    if (isiOS()) {
      const appScheme = `mercadopago://payment?url=${encodeURIComponent(url)}`;
      try {
        console.log("[abrirUrlConEstrategias] fallback: window.location -> scheme iOS", appScheme);
        window.location.href = appScheme;
        // como fallback, despues de un breve delay iremos al https
        setTimeout(() => {
          try {
            window.location.href = url;
          } catch (e) {
            console.log("[abrirUrlConEstrategias] fallback final -> url failed", e);
          }
        }, 1200);
        return;
      } catch (e) {
        console.log("[abrirUrlConEstrategias] fallback scheme iOS falló", e);
      }
    }

    // 3) Crear y "clickear" un anchor target=_blank
    try {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      console.log("[abrirUrlConEstrategias] fallback: anchor click");
      a.click();
      a.remove();
      return;
    } catch (e) {
      console.log("[abrirUrlConEstrategias] fallback anchor click falló", e);
    }

    // 4) Último recurso: navegar en la misma pestaña
    try {
      console.log("[abrirUrlConEstrategias] última opción: window.location.href =", url);
      window.location.href = url;
    } catch (e) {
      console.error("[abrirUrlConEstrategias] no se pudo abrir la url por ningún medio", e);
    }
  }

  // --- Pago (abre una ventana en blanco sincrónica para preservar el gesto del usuario) ---
  async function pagar(medio: "mp" | "nave") {
    setError(null);
    setCargando(medio);

    // Abrimos una ventana en blanco de forma sincrónica dentro del handler click para preservar el gesto
    let ventanaPopup: Window | null = null;
    try {
      ventanaPopup = window.open("", "_blank", "noopener,noreferrer");
      // En algunos contextos la ventana puede devolver with about:blank que es suficiente.
    } catch (e) {
      console.log("[pagar] window.open falló", e);
      ventanaPopup = null;
    }

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

      const urlPago = datos.urlPago;
      if (!urlPago) throw new Error("No se recibió urlPago");
      abrirUrlConEstrategias(urlPago, ventanaPopup);
    } catch (e) {
      console.error("[pagar] error:", e);
      setError("Hubo un problema al iniciar el pago. Probá de nuevo.");
      setCargando(null);
    }
  }

  // --- Pago por WhatsApp (mismo enfoque para preservar gesto) ---
  async function pagarPorWhatsApp() {
    setError(null);
    setCargando("whatsapp");

    // Abrir ventana en blanco sincrónica
    let ventanaPopup: Window | null = null;
    try {
      ventanaPopup = window.open("", "_blank", "noopener,noreferrer");
    } catch (e) {
      console.log("[pagarPorWhatsApp] window.open falló", e);
      ventanaPopup = null;
    }

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
      const mensaje = `🛜 Mi link de pago WAIFAI\n${planActual.nombre} - $${planActual.precio.toLocaleString(
        "es-AR"
      )}\n\n${datos.urlPago}`;
      const waUrl = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;

      abrirUrlConEstrategias(waUrl, ventanaPopup);
    } catch (e) {
      console.error("[pagarPorWhatsApp] error:", e);
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
              onClick={() => setPlanSeleccionado(plan.id)}
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

        {error && (
          <p className="text-sm text-red-400 mt-4 text-center">{error}</p>
        )}

        <p className="text-xs text-[#A0A0A8] text-center mt-5 mb-3">Elegí cómo pagar</p>

        {config.nave && (
          <button
            onClick={() => pagar("nave")}
            disabled={ocupado}
            className="w-full py-3.5 rounded-xl text-[15px] font-medium bg-[#6E3FA3] hover:bg-[#5A3286] active:scale-[0.98] transition disabled:opacity-60 mb-2.5"
          >
            {cargando === "nave" ? "Abriendo pago..." : "Pagar con Nave / Galicia"}
          </button>
        )}

        {config.mp && (
          <button
            onClick={() => pagar("mp")}
            disabled={ocupado}
            className="w-full py-3.5 rounded-xl text-[15px] font-medium bg-[#18181B] border border-[#2A2A2E] hover:bg-[#211A2B] active:scale-[0.98] transition disabled:opacity-60 mb-2.5"
          >
            {cargando === "mp" ? "Abriendo pago..." : "Pagar con Mercado Pago"}
          </button>
        )}

        {config.whatsapp && (
          <button
            onClick={pagarPorWhatsApp}
            disabled={ocupado}
            className="w-full py-3.5 rounded-xl text-[15px] font-medium bg-[#18181B] border border-[#25D366] text-[#25D366] hover:bg-[#0d1f14] active:scale-[0.98] transition disabled:opacity-60"
          >
            {cargando === "whatsapp" ? "Generando link..." : "📲 Pagar por WhatsApp"}
          </button>
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
