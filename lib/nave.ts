export const NAVE_SANDBOX = process.env.NAVE_SANDBOX === "true";

export const NAVE_AUTH_URL = NAVE_SANDBOX
  ? "https://homoservices.apinaranja.com/security-ms/api/security/auth0/b2b/m2msPrivate"
  : "https://services.apinaranja.com/security-ms/api/security/auth0/b2b/m2msPrivate";

export const NAVE_PAYMENT_URL = NAVE_SANDBOX
  ? "https://api-sandbox.ranty.io/api/payment_request/ecommerce"
  : "https://api.ranty.io/api/payment_request/ecommerce";

export async function obtenerTokenNave(): Promise<string> {
  const respuesta = await fetch(NAVE_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.NAVE_CLIENT_ID,
      client_secret: process.env.NAVE_CLIENT_SECRET,
      audience: process.env.NAVE_AUDIENCE ?? "https://naranja.com/ranty/merchants/api",
    }),
  });
  const datos = await respuesta.json();
  if (!datos.access_token) {
    throw new Error(`No se pudo obtener token de Nave: ${JSON.stringify(datos)}`);
  }
  return datos.access_token;
}