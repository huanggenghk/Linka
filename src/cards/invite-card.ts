import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import QRCode from "qrcode";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = join(__dirname, "../assets/fonts");

// ── Font loading ─────────────────────────────────────────────────────────────

type FontEntry = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700 | 900;
  style: "normal";
};

let cachedFonts: FontEntry[] | null = null;

function loadFonts(): FontEntry[] {
  if (cachedFonts) return cachedFonts;

  const read = (file: string): ArrayBuffer => {
    const buf = readFileSync(join(FONTS_DIR, file));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  };

  cachedFonts = [
    { name: "Inter", data: read("Inter-Bold.ttf"), weight: 700, style: "normal" },
    { name: "Inter", data: read("Inter-Black.ttf"), weight: 900, style: "normal" },
    { name: "Noto Sans SC", data: read("NotoSansSC-Regular.ttf"), weight: 400, style: "normal" },
    { name: "Noto Sans SC", data: read("NotoSansSC-Bold.ttf"), weight: 700, style: "normal" },
    { name: "JetBrains Mono", data: read("JetBrainsMono-Regular.ttf"), weight: 400, style: "normal" },
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
  const fonts = loadFonts();

  // Render natively at 3× so Satori lays out at full resolution instead of
  // upscaling a 480px SVG. All logical values stay the same; only S changes.
  const S = 3;
  const W = 480 * S;   // 1440
  const H = 297 * S;   // 891

  const qrDataUrl = await QRCode.toDataURL(data.joinUrl, {
    width: 128 * S * 2, // oversample the QR source
    margin: 1,
    color: { dark: "#111111", light: "#FFFFFF" },
  });

  // ── Element helpers ──
  const px = (n: number) => `${n * S}px`;

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

  const glow = (style: Record<string, unknown>): unknown => ({
    type: "div",
    props: { style: { display: "flex", position: "absolute", ...style }, children: [] },
  });

  // ── Dynamic: event info rows ──
  const metaRows: unknown[] = [];
  if (data.date) {
    metaRows.push(
      flex({ flexDirection: "row", gap: px(10), alignItems: "center" }, [
        text("DATE", {
          fontFamily: "JetBrains Mono",
          fontSize: px(9),
          fontWeight: 400,
          color: "rgba(194,139,62,0.70)",
          letterSpacing: "0.07em",
          minWidth: px(36),
        }),
        text(data.date, {
          fontFamily: "Noto Sans SC",
          fontSize: px(11),
          fontWeight: 400,
          color: "rgba(255,240,210,0.42)",
        }),
      ])
    );
  }
  if (data.location) {
    metaRows.push(
      flex({ flexDirection: "row", gap: px(10), alignItems: "center" }, [
        text("LOC", {
          fontFamily: "JetBrains Mono",
          fontSize: px(9),
          fontWeight: 400,
          color: "rgba(194,139,62,0.70)",
          letterSpacing: "0.07em",
          minWidth: px(36),
        }),
        text(data.location, {
          fontFamily: "Noto Sans SC",
          fontSize: px(11),
          fontWeight: 400,
          color: "rgba(255,240,210,0.42)",
        }),
      ])
    );
  }

  // ── Template: fixed footer strip ──
  const FOOTER_H = 56;
  const footer = flex(
    {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingLeft: px(26),
      paddingRight: px(26),
      paddingTop: "0px",
      paddingBottom: "0px",
      height: px(FOOTER_H),
      background: "rgba(0,0,0,0.30)",
      borderTopWidth: `${S}px`,
      borderTopStyle: "solid",
      borderTopColor: "rgba(255,255,255,0.08)",
      gap: px(16),
      flexShrink: "0",
    },
    [
      flex({ flexDirection: "column", gap: px(3) }, [
        text("发给 Agent，接入 Linka", {
          fontFamily: "Noto Sans SC",
          fontSize: px(13),
          fontWeight: 700,
          color: "#C28B3E",
        }),
        text("在 Agent 网络中高效链接现场人脉", {
          fontFamily: "Noto Sans SC",
          fontSize: px(11),
          fontWeight: 400,
          color: "rgba(255,240,210,0.32)",
        }),
      ]),
      flex({ flexDirection: "column", alignItems: "flex-end", gap: px(3) }, [
        text("LINKA", {
          fontFamily: "Inter",
          fontSize: px(13),
          fontWeight: 700,
          color: "#C28B3E",
          letterSpacing: "0.16em",
        }),
        text(data.joinUrl.replace(/^https?:\/\//, ""), {
          fontFamily: "JetBrains Mono",
          fontSize: px(10),
          fontWeight: 400,
          color: "rgba(255,240,210,0.55)",
          letterSpacing: "0.04em",
        }),
      ]),
    ]
  );

  const QR_SIZE = 128;
  const PAD_H = 26;

  // ── Scene: dark base + ambient orbs + glass card ──
  const scene = {
    type: "div",
    props: {
      style: {
        display: "flex",
        position: "relative",
        width: `${W}px`,
        height: `${H}px`,
        background: "#07090F",
        borderRadius: px(16),
        overflow: "hidden",
      },
      children: [
        // Orb 1: warm amber, right-center (matches demo body::before)
        glow({
          top: "0px",
          left: px(140),
          width: px(360),
          height: px(260),
          background:
            "radial-gradient(ellipse at 70% 35%, rgba(180,110,20,0.60) 0%, rgba(180,110,20,0.18) 45%, transparent 70%)",
        }),
        // Orb 2: deep blue, left-center (matches demo body::after)
        glow({
          top: px(55),
          left: "0px",
          width: px(240),
          height: px(200),
          background:
            "radial-gradient(ellipse at 25% 55%, rgba(30,60,140,0.50) 0%, rgba(30,60,140,0.12) 45%, transparent 72%)",
        }),
        // Orb 3: small amber accent, top-right corner (matches demo .scene::before)
        glow({
          top: "0px",
          left: px(330),
          width: px(160),
          height: px(150),
          background:
            "radial-gradient(ellipse at 85% 15%, rgba(194,139,62,0.40) 0%, transparent 65%)",
        }),

        // Glass card layer
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              position: "absolute",
              top: "0px",
              left: "0px",
              width: `${W}px`,
              height: `${H}px`,
              background: "rgba(255,255,255,0.04)",
              borderWidth: `${S}px`,
              borderStyle: "solid",
              borderColor: "rgba(255,255,255,0.10)",
              borderRadius: px(16),
              overflow: "hidden",
            },
            children: [
              // Body: dynamic parts only (event name + QR)
              flex(
                {
                  flexDirection: "row",
                  flex: "1",
                  paddingTop: px(32),
                  paddingBottom: px(30),
                  paddingLeft: px(PAD_H),
                  paddingRight: px(PAD_H),
                  gap: px(22),
                  alignItems: "center",
                },
                [
                  // Left: event name + meta
                  flex({ flexDirection: "column", flex: "1" }, [
                    flex(
                      {
                        fontFamily: "Inter",
                        fontSize: px(20),
                        fontWeight: 900,
                        color: "rgba(255,252,244,0.92)",
                        lineHeight: 1.22,
                        marginBottom: px(18),
                        flexWrap: "wrap",
                      },
                      [text(data.eventName, {})]
                    ),
                    ...(metaRows.length > 0
                      ? [flex({ flexDirection: "column", gap: px(7) }, metaRows)]
                      : []),
                  ]),

                  // Vertical divider
                  flex(
                    {
                      width: `${S}px`,
                      alignSelf: "stretch",
                      background: "rgba(255,255,255,0.12)",
                      flexShrink: "0",
                      marginTop: px(4),
                      marginBottom: px(4),
                    },
                    []
                  ),

                  // Right: QR code
                  flex(
                    {
                      flexShrink: "0",
                      width: px(QR_SIZE + 16),
                      alignItems: "center",
                      justifyContent: "center",
                    },
                    [
                      {
                        type: "img",
                        props: {
                          src: qrDataUrl,
                          style: {
                            width: px(QR_SIZE),
                            height: px(QR_SIZE),
                            borderRadius: px(10),
                          },
                        },
                      },
                    ]
                  ),
                ]
              ),

              footer,
            ],
          },
        },
      ],
    },
  };

  const svg = await satori(scene as Parameters<typeof satori>[0], {
    width: W,
    height: H,
    fonts,
  });

  // Render at 1:1 — no upscaling needed since Satori already laid out at 3×
  // Transparent background so rounded corners don't produce white corner artifacts
  const resvg = new Resvg(svg, { background: "rgba(0,0,0,0)" });
  return Buffer.from(resvg.render().asPng());
}
