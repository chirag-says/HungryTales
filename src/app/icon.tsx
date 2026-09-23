import { ImageResponse } from "next/og";

export function generateImageMetadata() {
  return [
    { id: "192", size: { width: 192, height: 192 }, contentType: "image/png" },
    { id: "512", size: { width: 512, height: 512 }, contentType: "image/png" },
  ];
}

/** App icon: a chili-red plate on warm paper. Drawn, not a raster asset, so it stays sharp at any size. */
export default async function Icon({ id }: { id: Promise<string> }) {
  const size = Number(await id);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f2ea" }}>
        <div
          style={{
            width: size * 0.62,
            height: size * 0.62,
            borderRadius: "50%",
            background: "#b83d26",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ width: size * 0.34, height: size * 0.34, borderRadius: "50%", border: `${Math.round(size * 0.035)}px solid #fffaf5` }} />
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
