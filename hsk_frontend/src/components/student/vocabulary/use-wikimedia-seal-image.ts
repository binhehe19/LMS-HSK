"use client";

// Ảnh chữ triện (seal script) từ Wikimedia Commons khi từ chưa có ảnh — logic tìm ảnh của useWikimediaImage ở HSK cũ.
// Khác bản cũ: CHỈ hiển thị. Không tải ảnh về rồi upload lên kho lưu trữ, không gọi sync-etymology (bản cũ ghi ngầm vào DB từ máy học viên).
// Mặc định TẮT: chỉ bật khi NEXT_PUBLIC_DICTIONARY_WIKIMEDIA_FALLBACK=enabled (gọi ra dịch vụ bên ngoài từ trình duyệt học viên),
// và chỉ chạy cho từ đơn chưa có imageUrl.
import { useEffect, useState } from "react";

export function isWikimediaFallbackEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DICTIONARY_WIKIMEDIA_FALLBACK === "enabled";
}

/** `character` rỗng hoặc nhiều hơn một chữ => không tìm. Kết quả gắn với chữ đã tìm để không cần reset đồng bộ trong effect. */
export function useWikimediaSealImage(character: string): string | null {
  const [found, setFound] = useState<{ char: string; url: string | null } | null>(null);
  const active = isWikimediaFallbackEnabled() && Array.from(character).length === 1 ? character : "";

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    (async () => {
      let url: string | null = null;
      try {
        const res = await fetch(
          `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(active)}%20seal&gsrnamespace=6&prop=imageinfo&iiprop=url&format=json&origin=*`,
        );
        const data = (await res.json()) as { query?: { pages?: Record<string, { imageinfo?: { url?: string }[] }> } };
        const pages = data.query?.pages;
        const first = pages ? pages[Object.keys(pages)[0]] : undefined;
        const candidate = first?.imageinfo?.[0]?.url ?? null;
        if (candidate) {
          const ok = await new Promise<boolean>((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = candidate;
          });
          url = ok ? candidate : null;
        }
      } catch {
        url = null;
      }
      if (!cancelled) setFound({ char: active, url });
    })();
    return () => {
      cancelled = true;
    };
  }, [active]);

  return active && found?.char === active ? found.url : null;
}
