import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { action, codigo } = await req.json();

  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL ?? "",
    token: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
  });

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
