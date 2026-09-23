import "server-only";
import { v2 as cloudinary } from "cloudinary";
import { env } from "@/lib/env";
import type { PhotoUrls, StorageDriver } from "./index";

let configured = false;

function client() {
  if (!configured) {
    const e = env();
    cloudinary.config({
      cloud_name: e.CLOUDINARY_CLOUD_NAME,
      api_key: e.CLOUDINARY_API_KEY,
      api_secret: e.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}

/**
 * Photos are stored as `authenticated` assets: they can only be fetched through
 * URLs signed with our API secret, so nobody can enumerate or guess them, and the
 * named sizes below are the only transformations we ever sign.
 */
const VARIANTS: Record<keyof PhotoUrls, object[]> = {
  thumb: [{ width: 720, crop: "limit" }, { fetch_format: "auto", quality: "auto" }],
  display: [{ width: 2048, height: 2048, crop: "limit" }, { fetch_format: "auto", quality: "auto:good" }],
};

function signedUrl(key: string, variant: keyof PhotoUrls): string {
  return client().url(key, {
    type: "authenticated",
    resource_type: "image",
    sign_url: true,
    long_url_signature: true,
    secure: true,
    transformation: VARIANTS[variant],
  });
}

export function cloudinaryDriver(): StorageDriver {
  return {
    async createUploadTarget(key) {
      const c = client();
      const e = env();
      const params = {
        public_id: key,
        type: "authenticated",
        timestamp: Math.floor(Date.now() / 1000),
        overwrite: false,
        allowed_formats: "jpg",
      };
      const signature = c.utils.api_sign_request(params, e.CLOUDINARY_API_SECRET as string);
      return {
        url: `https://api.cloudinary.com/v1_1/${e.CLOUDINARY_CLOUD_NAME}/image/upload`,
        method: "POST",
        headers: {},
        fields: {
          public_id: params.public_id,
          type: params.type,
          timestamp: String(params.timestamp),
          overwrite: "false",
          allowed_formats: params.allowed_formats,
          api_key: e.CLOUDINARY_API_KEY as string,
          signature,
        },
      };
    },
    async confirmUpload(key, receipt) {
      if (!receipt?.signature || typeof receipt.version !== "number") return false;
      // Cloudinary signs every upload response with our secret; a valid one proves the upload happened.
      // The SDK ships this helper but its type definitions omit it.
      const utils = client().utils as unknown as { verify_api_response_signature(id: string, version: number, signature: string): boolean };
      return utils.verify_api_response_signature(key, receipt.version, receipt.signature);
    },
    async urls(keys) {
      return Object.fromEntries(keys.map((k) => [k, { thumb: signedUrl(k, "thumb"), display: signedUrl(k, "display") }]));
    },
    async remove(keys) {
      const c = client();
      for (let i = 0; i < keys.length; i += 100) {
        await c.api.delete_resources(keys.slice(i, i + 100), { type: "authenticated", resource_type: "image" });
      }
    },
  };
}
