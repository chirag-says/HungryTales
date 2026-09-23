import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { LIMITS } from "@/lib/domain";
import { localPathFor, verifyLocal } from "@/lib/storage/local";

/** Local-disk stand-in for Cloudinary during development. Disabled in production. */

type Params = { params: Promise<{ key: string[] }> };

function guard() {
  if (process.env.NODE_ENV === "production" || process.env.CLOUDINARY_CLOUD_NAME) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return null;
}

export async function GET(req: NextRequest, { params }: Params) {
  const blocked = guard();
  if (blocked) return blocked;
  const key = (await params).key.join("/");
  const exp = Number(req.nextUrl.searchParams.get("exp"));
  const sig = req.nextUrl.searchParams.get("sig") ?? "";
  const file = localPathFor(key);
  if (!file || !verifyLocal("read", key, exp, sig)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const bytes = await readFile(file);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const blocked = guard();
  if (blocked) return blocked;
  const key = (await params).key.join("/");
  const exp = Number(req.nextUrl.searchParams.get("exp"));
  const sig = req.nextUrl.searchParams.get("sig") ?? "";
  const file = localPathFor(key);
  if (!file || !verifyLocal("write", key, exp, sig)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = new Uint8Array(await req.arrayBuffer());
  if (body.byteLength === 0 || body.byteLength > LIMITS.photoUploadMaxBytes) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }
  if (!(body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff)) {
    return NextResponse.json({ error: "Only JPEG uploads are accepted" }, { status: 415 });
  }
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body, { flag: "wx" }).catch(async (err: NodeJS.ErrnoException) => {
    if (err.code !== "EEXIST") throw err;
  });
  return NextResponse.json({ ok: true });
}
