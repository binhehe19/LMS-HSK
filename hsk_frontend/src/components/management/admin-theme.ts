import type { CSSProperties } from "react";
import type { ThemeConfig } from "antd";
import { BRAND_COLORS, brandTheme } from "@/theme/brand-tokens";

export const adminPalette = {
  "--admin-primary": BRAND_COLORS.primary,
  "--admin-primary-hover": BRAND_COLORS.primaryHover,
  "--admin-neutral": BRAND_COLORS.neutral,
  "--admin-soft": BRAND_COLORS.soft,
  "--admin-surface": BRAND_COLORS.surface,
} as CSSProperties;

export const adminTheme: ThemeConfig = {
  token: { ...brandTheme.token, borderRadius: 10 },
  components: {
    ...brandTheme.components,
    Button: { primaryShadow: "none", fontWeight: 600 },
  },
};
