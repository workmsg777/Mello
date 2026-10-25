export interface PhotoUploadAsset {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  file?: File;
}

/** Web FormData needs file bytes; React Native's FormData accepts a URI descriptor. */
export async function createPhotoFormData(
  asset: PhotoUploadAsset,
  platform: "web" | "native",
): Promise<FormData> {
  const data = new FormData();
  if (platform === "web") {
    let photo: Blob;
    if (asset.file) {
      photo = asset.file;
    } else {
      const response = await fetch(asset.uri);
      if (!response.ok)
        throw new Error(
          "Unable to read the selected photo. Please choose it again.",
        );
      photo = await response.blob();
    }
    if (!photo.size)
      throw new Error(
        "The selected photo is empty. Please choose another photo.",
      );
    const type = photo.type || asset.mimeType || "image/jpeg";
    const extension =
      type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
    data.append(
      "photo",
      photo.type ? photo : new Blob([photo], { type }),
      asset.fileName || asset.file?.name || `mello-${Date.now()}.${extension}`,
    );
  } else {
    data.append("photo", {
      uri: asset.uri,
      name: asset.fileName || `mello-${Date.now()}.jpg`,
      type: asset.mimeType || "image/jpeg",
    } as unknown as Blob);
  }
  return data;
}
