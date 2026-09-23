"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LIMITS } from "@/lib/domain";
import type { DuplicateWarning } from "@/lib/engine/duplicates";
import { hashFile, PhotoError, processPhoto, readPhotoMeta, uploadBlob, validatePhotoFile, type PhotoMeta, type UploadReceipt } from "@/lib/client/photos";
import { checkPhotoDuplicates, preparePhotoUploads, type PreparedUpload } from "@/server/actions/memories";

export type PhotoStatus = "reading" | "uploading" | "ready" | "error";

export interface DraftPhoto {
  key: string;
  /** Server photo id: issued before upload for new photos, or the saved id. */
  id: string | null;
  isNew: boolean;
  source: "camera" | "gallery" | "existing";
  status: PhotoStatus;
  progress: number;
  previewUrl: string | null;
  width: number;
  height: number;
  bytes: number;
  hash: string | null;
  meta: PhotoMeta;
  error: string | null;
  /** True when the photo is prepared locally and only the upload failed. */
  retryable: boolean;
  /** Signed upload response from storage, passed back to the server for verification. */
  receipt: UploadReceipt | null;
  duplicate: DuplicateWarning | null;
}

export interface ExistingPhoto {
  id: string;
  thumbUrl: string | null;
  width: number;
  height: number;
  bytes: number;
  isCover: boolean;
  takenAt: string | null;
  contentHash: string | null;
}

interface Pending {
  blob: Blob;
  target: PreparedUpload | null;
}

const EMPTY_META: PhotoMeta = { takenAt: null, latitude: null, longitude: null };

/**
 * Owns the photo list for the composer. New photos start processing and
 * uploading the moment they are added, so by the time details are typed the
 * upload is usually done and saving is instant.
 */
export function usePhotoQueue(initial: ExistingPhoto[], memoryId?: string) {
  const [photos, setPhotos] = useState<DraftPhoto[]>(() =>
    initial.map((p) => ({
      key: p.id,
      id: p.id,
      isNew: false,
      source: "existing",
      status: "ready",
      progress: 1,
      previewUrl: p.thumbUrl,
      width: p.width,
      height: p.height,
      bytes: p.bytes,
      hash: p.contentHash,
      meta: { ...EMPTY_META, takenAt: p.takenAt },
      error: null,
      retryable: false,
      receipt: null,
      duplicate: null,
    })),
  );
  const [coverKey, setCoverKey] = useState<string | null>(() => initial.find((p) => p.isCover)?.id ?? initial[0]?.id ?? null);
  const [rejections, setRejections] = useState<string[]>([]);
  const blobs = useRef(new Map<string, Pending>());
  const objectUrls = useRef(new Set<string>());
  const aborts = useRef(new Map<string, AbortController>());
  const processing = useRef<Promise<void>>(Promise.resolve());

  const update = useCallback((key: string, patch: Partial<DraftPhoto>) => {
    setPhotos((list) => list.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }, []);

  useEffect(() => {
    const urls = objectUrls.current;
    const controllers = aborts.current;
    return () => {
      controllers.forEach((c) => c.abort());
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const upload = useCallback(
    async (key: string) => {
      const entry = blobs.current.get(key);
      if (!entry) return;
      update(key, { status: "uploading", error: null, retryable: false, progress: 0 });
      const controller = new AbortController();
      aborts.current.set(key, controller);
      try {
        if (!entry.target) {
          const prepared = await preparePhotoUploads(1);
          if (!prepared.ok) throw new PhotoError(prepared.error);
          entry.target = prepared.data[0];
          update(key, { id: entry.target.photoId });
        }
        const receipt = await uploadBlob(entry.target.target, entry.blob, (f) => update(key, { progress: f }), controller.signal);
        blobs.current.delete(key); // uploaded: drop the local copy
        update(key, { status: "ready", progress: 1, receipt });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        update(key, { status: "error", retryable: true, error: error instanceof PhotoError ? error.message : "Upload failed. Check your connection and retry." });
      } finally {
        aborts.current.delete(key);
      }
    },
    [update],
  );

  const addFiles = useCallback(
    (files: File[], source: "camera" | "gallery") => {
      const problems: string[] = [];
      const room = LIMITS.photosPerMemory - photos.length;
      const accepted: { file: File; key: string }[] = [];
      for (const file of files) {
        const problem = validatePhotoFile(file);
        if (problem) problems.push(problem);
        else if (accepted.length >= room) problems.push(`Up to ${LIMITS.photosPerMemory} photos per memory.`);
        else accepted.push({ file, key: crypto.randomUUID() });
      }
      setRejections([...new Set(problems)]);
      if (accepted.length === 0) return;

      setPhotos((list) => [
        ...list,
        ...accepted.map(({ key }) => ({
          key,
          id: null,
          isNew: true,
          source,
          status: "reading" as const,
          progress: 0,
          previewUrl: null,
          width: 0,
          height: 0,
          bytes: 0,
          hash: null,
          meta: EMPTY_META,
          error: null,
          retryable: false,
          receipt: null,
          duplicate: null,
        })),
      ]);
      setCoverKey((current) => current ?? accepted[0].key);

      // Decode one photo at a time: phones run out of memory decoding several 12 MP images at once.
      processing.current = processing.current.then(async () => {
        const prepared = await preparePhotoUploads(accepted.length).catch(() => null);
        const targets = prepared?.ok ? prepared.data : [];
        const fingerprints: { key: string; hash: string | null; takenAt: string | null; width: number; height: number }[] = [];
        for (const [i, { file, key }] of accepted.entries()) {
          try {
            const [meta, hash, processed] = await Promise.all([readPhotoMeta(file), hashFile(file), processPhoto(file)]);
            const previewUrl = URL.createObjectURL(processed.blob);
            objectUrls.current.add(previewUrl);
            const target = targets[i] ?? null;
            blobs.current.set(key, { blob: processed.blob, target });
            update(key, {
              id: target?.photoId ?? null,
              meta,
              hash,
              previewUrl,
              width: processed.width,
              height: processed.height,
              bytes: processed.blob.size,
            });
            fingerprints.push({ key, hash, takenAt: meta.takenAt, width: processed.width, height: processed.height });
            void upload(key);
          } catch (error) {
            update(key, { status: "error", error: error instanceof PhotoError ? error.message : "This photo couldn't be read." });
          }
        }
        if (fingerprints.length) {
          const result = await checkPhotoDuplicates(
            fingerprints.map(({ hash, takenAt, width, height }) => ({ hash, takenAt, width, height })),
            memoryId,
          );
          if (result.ok) for (const w of result.data) update(fingerprints[w.index].key, { duplicate: w });
        }
      });
    },
    [photos.length, update, upload, memoryId],
  );

  const remove = useCallback((key: string) => {
    aborts.current.get(key)?.abort();
    blobs.current.delete(key);
    setPhotos((list) => {
      const next = list.filter((p) => p.key !== key);
      const removed = list.find((p) => p.key === key);
      if (removed?.previewUrl && objectUrls.current.has(removed.previewUrl)) {
        URL.revokeObjectURL(removed.previewUrl);
        objectUrls.current.delete(removed.previewUrl);
      }
      return next;
    });
  }, []);

  const move = useCallback((key: string, delta: -1 | 1) => {
    setPhotos((list) => {
      const i = list.findIndex((p) => p.key === key);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }, []);

  // The cover falls back to the first photo if the chosen one was removed.
  const effectiveCover = coverKey && photos.some((p) => p.key === coverKey) ? coverKey : (photos[0]?.key ?? null);
  const busy = photos.some((p) => p.status === "reading" || p.status === "uploading");
  const failed = photos.filter((p) => p.status === "error");

  return {
    photos,
    coverKey: effectiveCover,
    setCoverKey,
    addFiles,
    remove,
    move,
    retry: upload,
    busy,
    failed,
    rejections,
    clearRejections: () => setRejections([]),
    /** Progress across all uploading photos, 0..1. */
    progress: photos.length ? photos.reduce((a, p) => a + (p.status === "ready" ? 1 : p.progress), 0) / photos.length : 1,
  };
}
