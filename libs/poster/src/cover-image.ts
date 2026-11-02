import { ResultAsync, err, errAsync, ok, type Result } from "neverthrow";
import { extractPalette } from "./palette";
import { toError } from "@freetsy/utils";
import i18n from "@freetsy/i18n";

export type UploadedCover = {
  objectUrl: string;
  palette: string[];
  original: CoverOriginal;
  aspect: number;
};

export type CoverOriginal = {
  blob: Blob;
  width: number;
  height: number;
  crop: PixelCrop;
};

export type PixelCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const MAX_COVER_BYTES = 20 * 1024 * 1024;

const MAX_PREVIEW_EDGE = 1500;

const COVER_MIME = "image/png";

export function readCoverFile(file: File): Result<string, Error> {
  if (!file.type.startsWith("image/")) {
    return err(new Error(i18n.t("errors.imageType")));
  }
  if (file.size > MAX_COVER_BYTES) {
    return err(new Error(i18n.t("errors.imageTooLarge")));
  }
  return ok(URL.createObjectURL(file));
}

function loadImageElement(src: string): ResultAsync<HTMLImageElement, Error> {
  return ResultAsync.fromPromise(
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(i18n.t("errors.imageLoad")));
      img.src = src;
    }),
    (cause) => toError(cause, i18n.t("errors.imageLoad")),
  );
}

function cropToCoverBlob(image: HTMLImageElement, crop: PixelCrop): ResultAsync<Blob, Error> {
  const scale = Math.min(1, MAX_PREVIEW_EDGE / Math.max(crop.width, crop.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(crop.width * scale));
  canvas.height = Math.max(1, Math.round(crop.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return errAsync(new Error(i18n.t("errors.canvasUnsupported")));
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);

  return ResultAsync.fromPromise(
    new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        canvas.width = 0;
        canvas.height = 0;
        if (b) resolve(b);
        else reject(new Error(i18n.t("errors.cropFailed")));
      }, COVER_MIME);
    }),
    (cause) => toError(cause, i18n.t("errors.cropFailed")),
  );
}

export function cropCoverImage(
  imageUrl: string,
  crop: PixelCrop,
): ResultAsync<UploadedCover, Error> {
  return ResultAsync.combine([
    loadImageElement(imageUrl),
    ResultAsync.fromPromise(
      fetch(imageUrl).then((response) => response.blob()),
      (cause) => toError(cause, i18n.t("errors.coverRead")),
    ),
  ]).andThen(([image, originalBlob]: [HTMLImageElement, Blob]) =>
    cropToCoverBlob(image, crop).andThen((blob) =>
      ResultAsync.fromSafePromise(blob.arrayBuffer())
        .map((buffer) => new Uint8Array(buffer))
        .andThen((bytes) => extractPalette(bytes))
        .map((palette) => ({
          objectUrl: URL.createObjectURL(blob),
          palette,
          aspect: crop.width / Math.max(crop.height, 1),
          original: {
            blob: originalBlob,
            width: image.naturalWidth,
            height: image.naturalHeight,
            crop: { ...crop },
          },
        })),
    ),
  );
}
