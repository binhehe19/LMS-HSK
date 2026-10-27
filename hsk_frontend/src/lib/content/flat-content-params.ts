// Vị trí trong màn quản lý nội dung PHẲNG (Package → mục, không Folder/StudySet) nằm trong URL (?packageId=), cùng quy ước với
// content-tree-params.ts (F5/back về đúng chỗ) nhưng chỉ còn 1 cấp con. Hàm thuần, không import React/Next.
import { readId } from "@/lib/content/content-tree-params";

export type FlatContentLevel = "packages" | "items";

export interface FlatContentLocation {
  packageId: string | null;
}

export const FLAT_ROOT_LOCATION: FlatContentLocation = { packageId: null };

interface ParamsLike {
  get(name: string): string | null;
}

export function readFlatLocation(params: ParamsLike): FlatContentLocation {
  return { packageId: readId(params.get("packageId")) };
}

export function flatLevel(location: FlatContentLocation): FlatContentLevel {
  return location.packageId ? "items" : "packages";
}

export function flatQuery(location: FlatContentLocation): string {
  return location.packageId ? `?packageId=${location.packageId}` : "";
}

export function flatHref(pathname: string, location: FlatContentLocation): string {
  return `${pathname}${flatQuery(location)}`;
}

export const flatPackageLocation = (packageId: string): FlatContentLocation => ({ packageId });
