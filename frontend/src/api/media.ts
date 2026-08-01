import { endpoints } from "./endpoints";
import { authHttp } from "./http";
import type { MediaFolder, SafeMedia } from "../types/media";

export function uploadMedia(file: File, folder: MediaFolder): Promise<SafeMedia> {
  const formData = new FormData();
  formData.append("file", file);
  return authHttp.post<{ media: SafeMedia }>(endpoints.media.upload(folder), formData).then((result) => result.media);
}

export function deleteMedia(path: string): Promise<void> {
  return authHttp.delete<void>(endpoints.media.delete, { body: { path } });
}

export function listMedia(folder: MediaFolder): Promise<{ media: SafeMedia[] }> {
  return authHttp.get<{ media: SafeMedia[] }>(endpoints.media.list(folder));
}
