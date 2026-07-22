import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { action, codigo } = await req.json();

  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL ?? "",
    token: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
  });

  if (action === "solicitar") {
    const phone = process.env.WHATSAPP_ADMIN_PHONE;
    const apikey = process.env.WHATSAPP_APIKEY;

    if (!phone || !apikey) {
      return NextResponse.json(
        { error: "WhatsApp no configurado. Definí WHATSAPP_ADMIN_PHONE y WHATSAPP_APIKEY en Vercel." },
        { status: 500 }
      );
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await redis.set("otp:admin", otp, { ex: 300 }); // 5 minutos

    const texto = encodeURIComponent(
      `🔐 Panel WAIFAI\n\nTu código de acceso es: *${otp}*\n\nVálido por 5 minutos. No lo compartas.`
    );
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${texto}&apikey=${apikey}`;

    try {
      const r = await fetch(url);
      if (!r.ok) {
        const body = await r.text();
        console.error("Callmebot error:", r.status, body);
        return NextResponse.json({ error: "Error enviando el mensaje de WhatsApp" }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    } catch (e) {
      console.error("Callmebot fetch error:", e);
      return NextResponse.json({ error: "No se pudo conectar con Callmebot" }, { status: 500 });
    }
  }

  if (action === "verificar") {
    if (!codigo || typeof codigo !== "string") {
      return NextResponse.json({ error: "Código requerido" }, { status: 400 });
    }

    const stored = await redis.get<string>("otp:admin");
    if (!stored || stored !== codigo.trim()) {
      return NextResponse.json({ error: "Código incorrecto o expirado" }, { status: 401 });
    }

    await redis.del("otp:admin"); // uso único
    return NextResponse.json({ token: process.env.CLAVE_ADMIN });
  }

  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
}
