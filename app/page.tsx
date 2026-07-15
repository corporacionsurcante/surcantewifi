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

  function buildIntermediateHtml(appAttemptUrl: string, fallbackUrl: string) {
    return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;display:flex;align-items:center;justify-content:center;height:100vh;background:#0A0A0C;color:#fff;margin:0}
  .box{max-width:420px;padding:20px;border-radius:12px;background:#111;box-shadow:0 6px 18px rgba(0,0,0,.6);text-align:center}
  a.btn{display:inline-block;margin-top:14px;padding:10px 16px;border-radius:8px;background:#6E3FA3;color:#fff;text-decoration:none}
  p.small{color:#A0A0A8;font-size:13px;margin-top:8px}
  .muted{color:#A0A0A8;font-size:13px;margin-top:6px}
  .copy{background:#222;padding:8px 12px;border-radius:8px;margin-top:10px;display:inline-block}
</style>
</head>
<body>
  <div class="box">
    <div>
      <strong>Abrir en aplicación</strong>
      <p class="muted">Si la app está instalada, intentaremos abrirla. Si no, podés abrir el enlace en el navegador o copiarlo.</p>
      <div style="margin-top:12px">
        <a id="openApp" class="btn" href="${appAttemptUrl}">Abrir en app</a>
      </div>
      <div style="margin-top:8px">
        <a id="openWeb" class="btn" href="${fallbackUrl}" target="_blank" rel="noopener noreferrer">Abrir en navegador</a>
      </div>
      <div style="margin-top:8px">
        <button id="copyBtn" class="btn">Copiar enlace</button>
      </div>
      <div class="muted">Si el botón no funciona, abrí este enlace en Chrome/Safari desde el menú del navegador.</div>
      <div id="linkBox" class="copy">${fallbackUrl}</div>
    </div>
  </div>

  <script>
    (function(){
      var attempt = ${JSON.stringify(appAttemptUrl)};
      var fallback = ${JSON.stringify(fallbackUrl)};

      document.getElementById('copyBtn').addEventListener('click', function(){
        try { navigator.clipboard.writeText(fallback); alert('Enlace copiado'); } catch(e){ prompt('Copiá este enlace', fallback); }
      });

      // Try opening the app first by navigating top-level
      try {
        location.href = attempt;
      } catch(e){}

      // If still here after 1s, show the fallback (already visible)
      setTimeout(function(){ try{ if(location.href===attempt) location.href = fallback; }catch(e){} }, 1200);
    })();
  </script>
</body>
</html>`;
  }

  // --- Pago (navegar a intersticial que intenta abrir app y ofrece opciones) ---
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

      const urlPago = datos.urlPago;
      if (!urlPago) throw new Error("No se recibió urlPago");

      // Build attempt URL for app based on platform
      let attemptUrl = urlPago;
      if (isAndroid()) {
        const withoutScheme = urlPago.replace(/^https?:\/\//, "");
        attemptUrl = `intent://${withoutScheme}#Intent;scheme=https;package=com.mercadolibre.android;S.browser_fallback_url=${encodeURIComponent(urlPago)};end`;
      } else if (isiOS()) {
        attemptUrl = `mercadopago://payment?url=${encodeURIComponent(urlPago)}`;
      }

      const html = buildIntermediateHtml(attemptUrl, urlPago);
      const blob = new Blob([html], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);

      // Navigate top-level to blob interstitial (avoids about:blank popups)
      window.location.href = blobUrl;

      // Revoke later
      setTimeout(() => URL.revokeObjectURL(blobUrl), 20000);
    } catch (e) {
      console.error("[pagar] error:", e);
      setError("Hubo un problema al iniciar el pago. Probá de nuevo.");
      setCargando(null);
    }
  }

  // --- Pago por WhatsApp: mostrar interstitial con wa link ---
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
      const waUrl = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;

      const attemptUrl = waUrl; // WhatsApp web will handle
      const html = buildIntermediateHtml(attemptUrl, waUrl);
      const blob = new Blob([html], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);
      window.location.href = blobUrl;
      setTimeout(() => URL.revokeObjectURL(blobUrl), 20000);
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

