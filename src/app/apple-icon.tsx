import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f2ea" }}>
        <div style={{ width: 112, height: 112, borderRadius: "50%", background: "#b83d26", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", border: "6px solid #fffaf5" }} />
        </div>
      </div>
    ),
    size,
  );
}
