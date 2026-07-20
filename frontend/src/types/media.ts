export type MediaFolder = "general" | "categories" | "products" | "staff" | "customers";

export type SafeMedia = {
  path: string;
  url: string;
  folder: string;
  mimeType: string;
  sizeBytes: number;
  originalName: string;
};
