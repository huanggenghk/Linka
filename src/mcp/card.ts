import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import QRCode from "qrcode";

// ── Font loading ─────────────────────────────────────────────────────────────

type FontEntry = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700 | 900;
  style: "normal";
};

let cachedFonts: FontEntry[] | null = null;

async function loadFonts(): Promise<FontEntry[]> {
  if (cachedFonts) return cachedFonts;

  const fetchFont = async (url: string): Promise<ArrayBuffer> => {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) throw new Error(`Font fetch failed: ${url} (${res.status})`);
    return res.arrayBuffer();
  };

  // Get woff2 URL from Google Fonts CSS
  const getGoogleFontUrl = async (
    family: string,
    weight: number
  ): Promise<string> => {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
    const css = await fetch(cssUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    }).then((r) => r.text());

    // For CJK fonts, grab the last url() which covers CJK Unified Ideographs
    const matches = [...css.matchAll(/url\((https:\/\/[^)]+\.woff2)\)/g)];
    if (!matches.length) throw new Error(`No woff2 URL for ${family} ${weight}`);
    const isKorJpCn =
      family.toLowerCase().includes("sc") ||
      family.toLowerCase().includes("tc") ||
      family.toLowerCase().includes("noto");
    return isKorJpCn
      ? matches[matches.length - 1][1]
      : matches[0][1];
  };

  const [satoshi700Url, satoshi900Url, notoSC400Url, notoSC700Url, jbMonoUrl] =
    await Promise.all([
      getGoogleFontUrl("Noto Sans", 700), // placeholder — Satoshi from Fontshare
      getGoogleFontUrl("Noto Sans", 900),
      getGoogleFontUrl("Noto Sans SC", 400),
      getGoogleFontUrl("Noto Sans SC", 700),
      getGoogleFontUrl("JetBrains Mono", 400),
    ]);

  // Satoshi from Fontshare (not on Google Fonts)
  const satoshiCssUrl =
    "https://api.fontshare.com/v2/css?f[]=satoshi@700,900&display=swap";
  const satoshiCss = await fetch(satoshiCssUrl).then((r) => r.text());
  const satoshiUrls = [
    ...satoshiCss.matchAll(/url\((https:\/\/[^)]+\.woff2)\)/g),
  ].map((m) => m[1]);

  const [satoshi700, satoshi900, notoSC400, notoSC700, jbMono] =
    await Promise.all([
      satoshiUrls[0] ? fetchFont(satoshiUrls[0]) : fetchFont(satoshi700Url),
      satoshiUrls[1]
        ? fetchFont(satoshiUrls[1])
        : fetchFont(satoshi900Url),
      fetchFont(notoSC400Url),
      fetchFont(notoSC700Url),
      fetchFont(jbMonoUrl),
    ]);

  cachedFonts = [
    { name: "Satoshi", data: satoshi700, weight: 700, style: "normal" },
    { name: "Satoshi", data: satoshi900, weight: 900, style: "normal" },
    // Noto Sans SC covers CJK + Latin fallback
    { name: "Noto Sans SC", data: notoSC400, weight: 400, style: "normal" },
    { name: "Noto Sans SC", data: notoSC700, weight: 700, style: "normal" },
    {
      name: "JetBrains Mono",
      data: jbMono,
      weight: 400,
      style: "normal",
    },
  ];

  return cachedFonts;
}

// ── Card generation ───────────────────────────────────────────────────────────

export interface CardData {
  eventName: string;
  date?: string | null;
  location?: string | null;
  joinUrl: string;
}

export async function generateInviteCard(data: CardData): Promise<Buffer> {
  const fonts = await loadFonts();

  // Generate QR code as base64 PNG
  const qrDataUrl = await QRCode.toDataURL(data.joinUrl, {
    width: 256,
    margin: 1,
    color: { dark: "#111111", light: "#FFFFFF" },
  });

  // ── Layout constants ──
  const W = 480;
  const BODY_PAD_H = 26;
  const BODY_PAD_V_TOP = 32;
  const BODY_PAD_V_BOT = 30;
  const QR_SIZE = 128;
  const FOOTER_H = 56;

  // ── Element helpers ──
  const flex = (
    style: Record<string, unknown>,
    children: unknown[]
  ): unknown => ({
    type: "div",
    props: { style: { display: "flex", ...style }, children },
  });

  const text = (
    content: string,
    style: Record<string, unknown>
  ): unknown => ({
    type: "span",
    props: { style, children: content },
  });

  // ── Card element ──
  const card = flex(
    {
      flexDirection: "column",
      width: `${W}px`,
      background:
        "linear-gradient(135deg, #07090F 0%, #0C0A0A 55%, #120C04 100%)",
      borderRadius: "16px",
      border: "1px solid rgba(255,255,255,0.09)",
      overflow: "hidden",
      position: "relative",
    },
    [
      // Ambient glow on right side (simulates glass warmth)
      {
        type: "div",
        props: {
          style: {
            position: "absolute",
            top: "-30px",
            right: "-20px",
            width: "260px",
            height: "260px",
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse, rgba(180,110,20,0.28) 0%, transparent 70%)",
            pointerEvents: "none",
          },
          children: [],
        },
      },

      // ── Body ──
      flex(
        {
          flexDirection: "row",
          padding: `${BODY_PAD_V_TOP}px ${BODY_PAD_H}px ${BODY_PAD_V_BOT}px`,
          gap: "22px",
          alignItems: "center",
          flex: "1",
        },
        [
          // Left: event info
          flex(
            {
              flexDirection: "column",
              flex: "1",
              gap: "0px",
            },
            [
              // Event name
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontFamily: "Satoshi",
                    fontSize: "20px",
                    fontWeight: 900,
                    color: "rgba(255,252,244,0.92)",
                    lineHeight: 1.22,
                    marginBottom: "18px",
                    whiteSpace: "pre-wrap",
                  },
                  children: data.eventName,
                },
              },
              // Meta rows
              flex({ flexDirection: "column", gap: "6px" }, [
                ...(data.date
                  ? [
                      flex({ flexDirection: "row", gap: "10px", alignItems: "center" }, [
                        text("DATE", {
                          fontFamily: "JetBrains Mono",
                          fontSize: "9px",
                          fontWeight: 400,
                          color: "rgba(194,139,62,0.70)",
                          letterSpacing: "0.07em",
                          minWidth: "36px",
                        }),
                        text(data.date, {
                          fontFamily: "Noto Sans SC",
                          fontSize: "11px",
                          fontWeight: 400,
                          color: "rgba(255,240,210,0.38)",
                          letterSpacing: "0.02em",
                        }),
                      ]),
                    ]
                  : []),
                ...(data.location
                  ? [
                      flex({ flexDirection: "row", gap: "10px", alignItems: "center" }, [
                        text("LOC", {
                          fontFamily: "JetBrains Mono",
                          fontSize: "9px",
                          fontWeight: 400,
                          color: "rgba(194,139,62,0.70)",
                          letterSpacing: "0.07em",
                          minWidth: "36px",
                        }),
                        text(data.location, {
                          fontFamily: "Noto Sans SC",
                          fontSize: "11px",
                          fontWeight: 400,
                          color: "rgba(255,240,210,0.38)",
                          letterSpacing: "0.02em",
                        }),
                      ]),
                    ]
                  : []),
              ]),
            ]
          ),

          // Vertical divider
          {
            type: "div",
            props: {
              style: {
                width: "1px",
                alignSelf: "stretch",
                background:
                  "linear-gradient(to bottom, transparent, rgba(255,255,255,0.12) 20%, rgba(255,255,255,0.12) 80%, transparent)",
                flexShrink: 0,
                margin: "4px 0",
              },
              children: [],
            },
          },

          // Right: QR code
          flex(
            {
              flexShrink: "0",
              width: `${QR_SIZE + 16}px`,
              alignItems: "center",
              justifyContent: "center",
            },
            [
              {
                type: "img",
                props: {
                  src: qrDataUrl,
                  width: QR_SIZE,
                  height: QR_SIZE,
                  style: {
                    borderRadius: "10px",
                    boxShadow:
                      "0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(194,139,62,0.25)",
                  },
                },
              },
            ]
          ),
        ]
      ),

      // ── Footer ──
      flex(
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 26px",
          height: `${FOOTER_H}px`,
          background: "rgba(0,0,0,0.18)",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          gap: "16px",
        },
        [
          // CTA text
          flex({ flexDirection: "column", gap: "3px" }, [
            text("发给 Agent，接入 Linka", {
              fontFamily: "Noto Sans SC",
              fontSize: "13px",
              fontWeight: 700,
              color: "#C28B3E",
              letterSpacing: "0.01em",
            }),
            text("在 Agent 网络中高效链接现场人脉", {
              fontFamily: "Noto Sans SC",
              fontSize: "11px",
              fontWeight: 400,
              color: "rgba(255,240,210,0.30)",
            }),
          ]),
          // Brand
          flex(
            { flexDirection: "column", alignItems: "flex-end", gap: "2px" },
            [
              text("LINKA", {
                fontFamily: "Satoshi",
                fontSize: "13px",
                fontWeight: 700,
                color: "#C28B3E",
                letterSpacing: "0.16em",
              }),
              text("linka.zone", {
                fontFamily: "JetBrains Mono",
                fontSize: "10px",
                fontWeight: 400,
                color: "rgba(255,255,255,0.18)",
                letterSpacing: "0.04em",
              }),
            ]
          ),
        ]
      ),
    ]
  );

  const svg = await satori(card as Parameters<typeof satori>[0], {
    width: W,
    fonts,
  });

  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: W * 2 } }); // 2x for retina
  return Buffer.from(resvg.render().asPng());
}
