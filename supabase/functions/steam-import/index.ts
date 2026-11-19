// Played & Made — Read-only, rate-limited, CORS-enabled Steam Public Library Proxy
// Deploy with: verify_jwt = false (public read-only endpoint)
// Optional secret: STEAM_WEB_API_KEY (recommended — Valve now login-gates unauthenticated /games?xml=1 from many IPs)

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=300",
};

interface RateBucket {
  count: number;
  resetAt: number;
}

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 20;
const rateBuckets = new Map<string, RateBucket>();

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  if (rateBuckets.size > 1500) {
    for (const [k, v] of rateBuckets) {
      if (v.resetAt <= now) rateBuckets.delete(k);
    }
  }
  const cur = rateBuckets.get(ip);
  if (!cur || cur.resetAt <= now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (cur.count >= RATE_MAX) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((cur.resetAt - now) / 1000)) };
  }
  cur.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

function jsonResponse(body: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  const isErr = status >= 400 || (typeof body === "object" && body !== null && (body as { ok?: boolean }).ok === false);
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      ...(isErr ? { "Cache-Control": "no-store" } : {}),
      ...(extraHeaders ?? {}),
    },
  });
}

function parseSteamInput(raw: string): { kind: "id64" | "vanity"; value: string } | null {
  let s = String(raw || "").trim();
  if (!s || s.length > 200) return null;

  // Accept full Steam profile URLs with strict host & segment boundary checks
  const profileMatch = s.match(/^(?:https?:\/\/)?(?:www\.)?steamcommunity\.com\/profiles\/(7656\d{13})(?:[/?#]|$)/i);
  if (profileMatch) return { kind: "id64", value: profileMatch[1] };

  const vanityMatch = s.match(/^(?:https?:\/\/)?(?:www\.)?steamcommunity\.com\/id\/([a-zA-Z0-9_-]{2,64})(?:[/?#]|$)/i);
  if (vanityMatch) return { kind: "vanity", value: vanityMatch[1] };

  // Strip accidental slashes or @ prefix
  s = s.replace(/^@+/, "").replace(/^\/+|\/+$/g, "");
  if (/^7656\d{13}$/.test(s)) return { kind: "id64", value: s };
  if (/^[a-zA-Z0-9_-]{2,64}$/.test(s)) return { kind: "vanity", value: s };
  return null;
}

const XML_NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decodeXmlEntities(s: string): string {
  const unwrapped = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  return unwrapped
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (full, ent: string) => {
      const lower = ent.toLowerCase();
      if (lower in XML_NAMED_ENTITIES) return XML_NAMED_ENTITIES[lower];
      const cp = lower.startsWith("#x")
        ? parseInt(lower.slice(2), 16)
        : lower.startsWith("#")
          ? parseInt(lower.slice(1), 10)
          : -1;
      if (cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff)) {
        return String.fromCodePoint(cp);
      }
      return full;
    })
    .trim();
}

function isHtmlDoc(s: string): boolean {
  return /<!doctype\s+html\b|<html\b/i.test(s);
}

function extractTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? decodeXmlEntities(m[1]) : "";
}

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": "PlayedAndMade-SteamImport/1.0 (+https://playedmade.com/)",
        Accept: "application/xml, application/json, text/xml;q=0.9, */*;q=0.1",
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

interface GameRow {
  appid: number;
  name: string;
  hours: number;
}

function parseGamesListXml(xml: string): GameRow[] {
  const out: GameRow[] = [];
  const gameRe = /<game>([\s\S]*?)<\/game>/gi;
  let m: RegExpExecArray | null;
  while ((m = gameRe.exec(xml)) !== null) {
    const block = m[1];
    const appid = parseInt(extractTag(block, "appID"), 10);
    const name = extractTag(block, "name");
    const hrsRaw = extractTag(block, "hoursOnRecord").replace(/,/g, "");
    const hours = Number.isFinite(parseFloat(hrsRaw)) ? Math.round(parseFloat(hrsRaw) * 10) / 10 : 0;
    if (appid > 0 && name) {
      out.push({ appid, name, hours });
    }
  }
  out.sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name));
  return out.slice(0, 2500);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ ok: false, code: "method_not_allowed", message: "Use GET or POST." }, 405);
  }

  const ip =
    req.headers.get("cf-connecting-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown";
  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    return jsonResponse(
      { ok: false, code: "rate_limited", message: "Too many imports right now — try again in a few minutes." },
      429,
      { "Retry-After": String(rl.retryAfterSec), "Cache-Control": "no-store" },
    );
  }

  let rawId = "";
  const url = new URL(req.url);
  if (req.method === "GET") {
    rawId = url.searchParams.get("id") || url.searchParams.get("profile") || "";
  } else {
    try {
      const body = await req.json();
      rawId = String(body?.id || body?.profile || "");
    } catch {
      return jsonResponse({ ok: false, code: "bad_json", message: "Invalid JSON body." }, 400);
    }
  }

  const parsed = parseSteamInput(rawId);
  if (!parsed) {
    return jsonResponse(
      {
        ok: false,
        code: "invalid_id",
        message: "Enter a Steam profile URL, vanity name (e.g. gabelogannewell), or 17-digit SteamID64.",
      },
      400,
    );
  }

  try {
    let steamId64 = parsed.kind === "id64" ? parsed.value : "";
    let profileName = "";
    let privacyState = "";

    // Step 1: Resolve profile metadata & vanity -> SteamID64 via public profile XML (no API key needed)
    const profileUrl =
      parsed.kind === "id64"
        ? `https://steamcommunity.com/profiles/${parsed.value}/?xml=1`
        : `https://steamcommunity.com/id/${encodeURIComponent(parsed.value)}/?xml=1`;

    const profRes = await fetchWithTimeout(profileUrl, 7500);
    if (profRes.status === 429) {
      await profRes.body?.cancel().catch(() => {});
      return jsonResponse(
        { ok: false, code: "upstream_rate_limited", message: "Steam is throttling lookups right now — use the instant Paste tab below." },
        502,
      );
    }
    if (profRes.status >= 500) {
      await profRes.body?.cancel().catch(() => {});
      if (!steamId64) {
        return jsonResponse(
          { ok: false, code: "upstream_error", message: "Steam is temporarily unavailable — try again or use the instant Paste tab below." },
          502,
        );
      }
      profileName = parsed.value;
    } else {
      const profText = await profRes.text();
      if (profText.includes("<error>")) {
        const errMsg = extractTag(profText, "error");
        return jsonResponse(
          { ok: false, code: "not_found", message: errMsg || "Steam profile not found." },
          404,
        );
      }
      if (!steamId64 && (profRes.url?.includes("/login") || (!profText.includes("<profile>") && isHtmlDoc(profText)))) {
        return jsonResponse({
          ok: false,
          code: "steam_login_gate",
          message: "Steam asked for sign-in while looking up that profile — use the instant Paste tab below!",
        });
      }
      const resolved64 = extractTag(profText, "steamID64");
      if (/^7656\d{13}$/.test(resolved64)) steamId64 = resolved64;
      profileName = extractTag(profText, "steamID") || parsed.value;
      privacyState = extractTag(profText, "privacyState");
    }

    if (!steamId64) {
      return jsonResponse(
        { ok: false, code: "not_found", message: "Could not resolve that Steam profile." },
        404,
      );
    }
    if (privacyState && privacyState.toLowerCase() !== "public") {
      return jsonResponse({
        ok: false,
        code: "private_profile",
        steamId64,
        profileName,
        message: "This Steam profile is private. Use the instant Paste tab below, or set Steam Game Details to Public.",
      });
    }

    // Step 2: If STEAM_WEB_API_KEY secret is set, use official IPlayerService/GetOwnedGames (most reliable)
    const apiKey = Deno.env.get("STEAM_WEB_API_KEY") || "";
    if (apiKey) {
      const apiUrl =
        `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${encodeURIComponent(apiKey)}` +
        `&steamid=${steamId64}&include_appinfo=1&include_played_free_games=1&format=json`;
      const apiRes = await fetchWithTimeout(apiUrl, 8500);
      if (apiRes.ok) {
        const data = await apiRes.json();
        const rawGames = Array.isArray(data?.response?.games) ? data.response.games : [];
        if (rawGames.length === 0) {
          return jsonResponse({
            ok: false,
            code: "private_games",
            steamId64,
            profileName,
            message:
              "Profile found, but Game Details are hidden or empty on Steam. Switch Game Details to Public or use the Paste tab below.",
          });
        }
        const games: GameRow[] = rawGames
          .filter((g: { appid?: number; name?: string }) => Number(g?.appid) > 0 && g?.name)
          .map((g: { appid: number; name: string; playtime_forever?: number }) => ({
            appid: Number(g.appid),
            name: String(g.name),
            hours: Math.round(((Number(g.playtime_forever) || 0) / 60) * 10) / 10,
          }))
          .sort((a: GameRow, b: GameRow) => b.hours - a.hours || a.name.localeCompare(b.name))
          .slice(0, 2500);
        return jsonResponse({
          ok: true,
          source: "web_api",
          steamId64,
          profileName,
          total: games.length,
          games,
        });
      }
    }

    // Step 3: Zero-key fallback — public Steam XML endpoint
    const xmlUrl = `https://steamcommunity.com/profiles/${steamId64}/games?tab=all&xml=1`;
    const xmlRes = await fetchWithTimeout(xmlUrl, 8500);
    if (xmlRes.status === 429) {
      await xmlRes.body?.cancel().catch(() => {});
      return jsonResponse(
        { ok: false, code: "upstream_rate_limited", message: "Steam is throttling lookups right now — use the instant Paste tab below." },
        502,
      );
    }
    if (xmlRes.status >= 500) {
      await xmlRes.body?.cancel().catch(() => {});
      return jsonResponse(
        { ok: false, code: "upstream_error", message: "Steam is temporarily unavailable — try again or use the instant Paste tab below." },
        502,
      );
    }
    const finalUrl = xmlRes.url || "";
    const xmlText = await xmlRes.text();

    if (finalUrl.includes("/login") || (!xmlText.includes("<gamesList>") && isHtmlDoc(xmlText))) {
      return jsonResponse({
        ok: false,
        code: "steam_login_gate",
        steamId64,
        profileName,
        message:
          "Steam resolved your profile, but Valve now requires sign-in for unauthenticated XML game lists. Open your Steam Games page, press Ctrl+A → Ctrl+C, and paste it into the Paste tab below!",
      });
    }

    if (xmlText.includes("<error>")) {
      return jsonResponse({
        ok: false,
        code: "private_games",
        steamId64,
        profileName,
        message: extractTag(xmlText, "error") || "Game details are private — use the Paste tab below.",
      });
    }

    if (!xmlRes.ok) {
      return jsonResponse(
        { ok: false, code: "upstream_error", message: "Steam refused the lookup right now — use the instant Paste tab below." },
        502,
      );
    }

    const games = parseGamesListXml(xmlText);
    if (!games.length) {
      return jsonResponse({
        ok: false,
        code: "private_games",
        steamId64,
        profileName,
        message: "No public games returned (Game Details may be private). Use the Paste tab below instead.",
      });
    }

    return jsonResponse({
      ok: true,
      source: "public_xml",
      steamId64,
      profileName,
      total: games.length,
      games,
    });
  } catch (err) {
    const errName = (err as { name?: string })?.name || "";
    const isTimeout = errName === "AbortError" || errName === "TimeoutError";
    return jsonResponse(
      {
        ok: false,
        code: isTimeout ? "timeout" : "upstream_error",
        message: isTimeout
          ? "Steam took too long to respond — try again or use the instant Paste tab."
          : "Could not reach Steam right now — use the instant Paste tab below.",
      },
      502,
      { "Cache-Control": "no-store" },
    );
  }
});
