// ──────────────────────────────────────────────────────────────
// Integración con la API de Omada Controller para autorizar el
// acceso de un dispositivo (por su MAC) durante una cantidad
// exacta de minutos, una vez que se confirmó un pago.
//
// Documentación oficial usada como referencia:
// https://support.omadanetworks.com/us/document/13080/
// (API para External Portal Server, Omada Controller 5.0.15+)
//
// CONFIGURACIÓN NECESARIA (variables de entorno en Vercel):
//   OMADA_CONTROLLER_URL   → ej: https://200.45.123.10:8043
//                            (la dirección desde la que Vercel
//                            puede alcanzar tu controlador; tiene
//                            que ser una IP/dominio público, no
//                            una IP privada como 192.168.x.x)
//   OMADA_OPERATOR_USER    → usuario de OPERADOR (se crea dentro
//                            de Omada en Hotspot Management →
//                            Operators, NO es tu usuario normal
//                            del panel)
//   OMADA_OPERATOR_PASSWORD → contraseña de ese operador
//
// El nombre del sitio (site), el SSID, y las MAC del cliente y
// del punto de acceso NO se configuran acá: llegan automáticamente
// en la URL cuando Omada redirige al pasajero a la landing, y hay
// que pasarlos tal cual a esta función (ver app/page.tsx).
//
// El controlador de Omada usa certificados autofirmados por
// defecto (a menos que hayas instalado uno propio). El fetch
// incorporado de Next.js no valida certificados autofirmados, así
// que necesitamos decirle explícitamente que los acepte para esta
// conexión puntual con Omada. Esto es estándar en instalaciones
// de Omada, no es una falla de seguridad introducida por este
// código.
// ──────────────────────────────────────────────────────────────

import { Agent } from "undici";

const agenteOmada = new Agent({
  connect: { rejectUnauthorized: false },
});

type ResultadoAutorizacion = {
  exito: boolean;
  motivo?: string;
};

async function obtenerIdControlador(urlBase: string): Promise<string> {
  const respuesta = await fetch(`${urlBase}/api/info`, {
    // @ts-expect-error: "dispatcher" es específico de undici y no
    // está en el tipo estándar de RequestInit, pero Next.js lo
    // acepta y lo necesita en tiempo de ejecución.
    dispatcher: agenteOmada,
  });
  const datos = await respuesta.json();
  return datos.result.omadacId;
}

async function iniciarSesionOperador(
  urlBase: string,
  idControlador: string,
  usuario: string,
  contrasena: string
): Promise<{ token: string; cookie: string }> {
  const respuesta = await fetch(
    `${urlBase}/${idControlador}/api/v2/hotspot/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: usuario, password: contrasena }),
      // @ts-expect-error: ver comentario en obtenerIdControlador.
      dispatcher: agenteOmada,
    }
  );

  const datos = await respuesta.json();
  if (datos.errorCode !== 0) {
    throw new Error(
      `No se pudo iniciar sesión como operador en Omada: ${datos.msg}`
    );
  }

  // Guardamos también la cookie de sesión que devuelve el
  // controlador, porque las siguientes llamadas la necesitan.
  const cookie = respuesta.headers.get("set-cookie") ?? "";

  return { token: datos.result.token, cookie };
}

async function cerrarSesionOperador(
  urlBase: string,
  idControlador: string,
  token: string,
  cookie: string
): Promise<void> {
  try {
    await fetch(`${urlBase}/${idControlador}/api/v2/logout`, {
      method: "POST",
      headers: { "Csrf-Token": token, Cookie: cookie },
      // @ts-expect-error: ver comentario en obtenerIdControlador.
      dispatcher: agenteOmada,
    });
  } catch (error) {
    // Si el cierre de sesión falla no es grave: la sesión del
    // operador va a expirar sola igual. Solo lo registramos.
    console.error("[omada] No se pudo cerrar la sesión del operador:", error);
  }
}

/**
 * Autoriza a un dispositivo (identificado por su MAC) a navegar
 * por la cantidad de minutos indicada. Esta es la función que hay
 * que llamar desde el webhook de pago y desde el canje de código.
 *
 * clientMac, apMac, ssidName y site deben ser los mismos valores
 * que Omada incluyó en la URL cuando redirigió al pasajero a esta
 * landing (no hay que inventarlos ni fijarlos de antemano).
 */
export async function autorizarClienteEnOmada(parametros: {
  clientMac: string;
  apMac: string;
  ssidName: string;
  site: string;
  minutos: number;
}): Promise<ResultadoAutorizacion> {
  const urlBase = process.env.OMADA_CONTROLLER_URL;
  const usuario = process.env.OMADA_OPERATOR_USER;
  const contrasena = process.env.OMADA_OPERATOR_PASSWORD;

  if (!urlBase || !usuario || !contrasena) {
    console.error(
      "[omada] Faltan variables de entorno de Omada. Esta autorización no se pudo procesar."
    );
    return {
      exito: false,
      motivo: "Falta configurar la conexión con Omada",
    };
  }

  if (!parametros.site) {
    console.error(
      "[omada] No se recibió el nombre del sitio (site) en la solicitud de autorización."
    );
    return { exito: false, motivo: "Falta el nombre del sitio" };
  }

  try {
    const idControlador = await obtenerIdControlador(urlBase);
    const { token, cookie } = await iniciarSesionOperador(
      urlBase,
      idControlador,
      usuario,
      contrasena
    );

    const respuesta = await fetch(
      `${urlBase}/${idControlador}/api/v2/hotspot/extPortal/auth`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Csrf-Token": token,
          Cookie: cookie,
        },
        body: JSON.stringify({
          clientMac: parametros.clientMac,
          apMac: parametros.apMac,
          ssidName: parametros.ssidName,
          radioId: "0",
          site: parametros.site,
          // El controlador espera el tiempo de autorización en
          // segundos a partir de ahora.
          time: String(parametros.minutos * 60),
          authType: "4",
        }),
        // @ts-expect-error: ver comentario en obtenerIdControlador.
        dispatcher: agenteOmada,
      }
    );

    const datos = await respuesta.json();

    await cerrarSesionOperador(urlBase, idControlador, token, cookie);

    if (datos.errorCode !== 0) {
      console.error("[omada] Error al autorizar al cliente:", datos);
      return { exito: false, motivo: datos.msg ?? "Error desconocido" };
    }

    console.log(
      "[omada] Cliente autorizado:",
      parametros.clientMac,
      "por",
      parametros.minutos,
      "minutos"
    );
    return { exito: true };
  } catch (error) {
    console.error("[omada] Error al comunicarse con el controlador:", error);
    return { exito: false, motivo: "No se pudo conectar con Omada" };
  }
}
