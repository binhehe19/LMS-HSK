import type { CSSProperties } from "react";
import { BRAND_COLORS } from "@/theme/brand-tokens";

export const adminPalette = {
  "--admin-primary": BRAND_COLORS.primary,
  "--admin-primary-hover": BRAND_COLORS.primaryHover,
  "--admin-neutral": BRAND_COLORS.neutral,
  "--admin-soft": BRAND_COLORS.soft,
  "--admin-surface": BRAND_COLORS.surface,
} as CSSProperties;
