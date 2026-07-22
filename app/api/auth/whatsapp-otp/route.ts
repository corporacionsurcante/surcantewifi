import { NextRequest, NextResponse } from "next/server";

const OTP_MAX_REQUESTS = 3;   // intentos máximos por ventana
const OTP_WINDOW_SECS = 600;  // 10 minutos

export async function POST(req: NextRequest) {
  const { action, codigo } = await req.json();

  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL ?? "",
    token: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
  });

  // Rate limiting por IP para ambas acciones
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateKey = `rate:otp:${ip}`;
  const count = await redis.incr(rateKey);
  if (count === 1) await redis.expire(rateKey, OTP_WINDOW_SECS);
  if (count > OTP_MAX_REQUESTS) {
    return NextResponse.json(
      { error: "Demasiados intentos. Esperá 10 minutos e intentá de nuevo." },
      { status: 429 }
    );
  }

  if (action === "solicitar") {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      return NextResponse.json(
        { error: "Telegram no configurado. Definí TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID en Vercel." },
        { status: 500 }
      );
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await redis.set("otp:admin", otp, { ex: 300 }); // 5 minutos

    const texto = `🔐 *Panel WAIFAI*\n\nTu código de acceso es:\n\`${otp}\`\n\n_Válido por 5 minutos._`;
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: "Markdown" }),
      });
      const data = await r.json();
      if (!data.ok) {
        console.error("Telegram error:", data);
        return NextResponse.json({ error: "Error enviando el mensaje por Telegram" }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    } catch (e) {
      console.error("Telegram fetch error:", e);
      return NextResponse.json({ error: "No se pudo conectar con Telegram" }, { status: 500 });
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
