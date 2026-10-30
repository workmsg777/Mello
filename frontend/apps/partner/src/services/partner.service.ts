import { api, API_BASE_URL } from "../config/api";
import { Platform } from "react-native";
import type { ImagePickerAsset } from "expo-image-picker";
export interface Permissions {
  manageTeam: boolean;
  manageListing: boolean;
  manageRequests: boolean;
  manageContent: boolean;
}
export interface PartnerCity {
  value: string;
  label: string;
  state: string;
  countryCode: string;
}
export interface PartnerCatalog {
  cities: PartnerCity[];
  states: string[];
  roles: {
    code: string;
    label: string;
    assignable: boolean;
    permissions: Permissions;
  }[];
  contentKinds: string[];
}
export interface PartnerPhoto {
  id: string;
  url: string;
}
export interface PartnerContent {
  id: string;
  kind: string;
  title: string;
  description: string;
  priceInr: number | null;
  startsAt: string | null;
  endsAt: string | null;
  isPublished: boolean;
  photoIds: string[];
  photos: PartnerPhoto[];
  updatedAt: string;
}
export interface Employee {
  id: string;
  name: string;
  phone: string;
  role: string;
  accountId: string;
  status: string;
}
let catalogPromise: Promise<PartnerCatalog> | null = null;
export function getPartnerCatalog() {
  catalogPromise ??= api
    .get<PartnerCatalog>("/partner/catalog")
    .then((response) => response.data)
    .catch((error) => {
      catalogPromise = null;
      throw error;
    });
  return catalogPromise;
}
export const partnerApi = {
  async team() {
    return (await api.get<Employee[]>("/partner/team")).data;
  },
  async addEmployee(input: { name: string; phone: string; role: string }) {
    return (await api.post<Employee[]>("/partner/team", input)).data;
  },
  async setEnabled(id: string, enabled: boolean) {
    return (await api.patch<Employee[]>(`/partner/team/${id}`, { enabled }))
      .data;
  },
  async content() {
    return (await api.get<PartnerContent[]>("/partner/content")).data;
  },
  async saveContent(
    value: Omit<PartnerContent, "id" | "photos" | "updatedAt">,
    id?: string,
  ) {
    return (
      await api.request<PartnerContent[]>({
        method: id ? "PUT" : "POST",
        url: id ? `/partner/content/${id}` : "/partner/content",
        data: value,
      })
    ).data;
  },
  async removeContent(id: string) {
    await api.delete(`/partner/content/${id}`);
  },
  async upload(asset: ImagePickerAsset) {
    const form = new FormData();
    if (Platform.OS === "web") {
      const file = asset.file ?? (await (await fetch(asset.uri)).blob());
      form.append("photo", file, asset.fileName ?? "cafe-photo.jpg");
    } else
      form.append("photo", {
        uri: asset.uri,
        name:
          asset.fileName ??
          (asset.mimeType === "image/png"
            ? "cafe-photo.png"
            : "cafe-photo.jpg"),
        type: asset.mimeType ?? "image/jpeg",
      } as unknown as Blob);
    // Remove the JSON default so the browser/native networking stack owns the multipart boundary.
    return (
      await api.post<PartnerPhoto>("/partner/photos", form, {
        headers: { "Content-Type": undefined },
        transformRequest: [(data) => data],
      })
    ).data;
  },
};
export function partnerPhotoUrl(value: string) {
  return new URL(value, new URL(API_BASE_URL).origin).toString();
}
