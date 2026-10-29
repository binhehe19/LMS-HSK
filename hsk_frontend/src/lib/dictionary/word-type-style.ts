// Màu huy hiệu từ loại (nguyên văn getWordTypeBadgeStyle của LMS_Frontend/src/core/utils/vocabulary-utils.ts). Khoá là chuỗi tiếng Việt chính xác.
export interface BadgeStyle {
  bg: string;
  color: string;
  border?: string;
}

/**
 * Returns the premium badge style for a given word type.
 * Uses a refined pastel palette with high-contrast text.
 */
export const getWordTypeBadgeStyle = (type: string): BadgeStyle => {
  const typeMap: Record<string, BadgeStyle> = {
    // 1. Danh từ (Noun) - Blue
    "Danh từ": {
      bg: "#e3f2fd",
      color: "#1565c0",
      border: "1px solid #bbdefb",
    },

    // 2. Động từ (Verb) - Green
    "Động từ": {
      bg: "#e8f5e9",
      color: "#2e7d32",
      border: "1px solid #c8e6c9",
    },

    // 3. Tính từ (Adjective) - Purple
    "Tính từ": {
      bg: "#f3e5f5",
      color: "#7b1fa2",
      border: "1px solid #e1bee7",
    },

    // 4. Trạng từ (Adverb) - Orange
    "Trạng từ": {
      bg: "#fff3e0",
      color: "#e65100",
      border: "1px solid #ffe0b2",
    },
    "Phó từ": {
      // Fallback/Alias
      bg: "#fff3e0",
      color: "#e65100",
      border: "1px solid #ffe0b2",
    },

    // 5. Đại từ (Pronoun) - Indigo
    "Đại từ": {
      bg: "#e8eaf6",
      color: "#283593",
      border: "1px solid #c5cae9",
    },

    // 6. Giới từ (Preposition) - Deep Orange
    "Giới từ": {
      bg: "#fbe9e7",
      color: "#d84315",
      border: "1px solid #ffccbc",
    },

    // 7. Liên từ (Conjunction) - Cyan
    "Liên từ": {
      bg: "#e0f7fa",
      color: "#00838f",
      border: "1px solid #b2ebf2",
    },

    // 8. Thán từ (Interjection) - Amber
    "Thán từ": {
      bg: "#fff8e1",
      color: "#f57f17",
      border: "1px solid #ffecb3",
    },

    // 9. Thành ngữ (Idiom) - Teal
    "Thành ngữ": {
      bg: "#e0f2f1",
      color: "#00695c",
      border: "1px solid #b2dfdb",
    },

    // 10. Cụm từ (Phrase) - Blue Grey
    "Cụm từ": {
      bg: "#eceff1",
      color: "#37474f",
      border: "1px solid #cfd8dc",
    },

    // 11. Trợ từ (Particle) - Grey
    "Trợ từ": {
      bg: "#f5f5f5",
      color: "#616161",
      border: "1px solid #e0e0e0",
    },

    // 12. Trợ động từ (Auxiliary Verb) - Light Green
    "Trợ động từ": {
      bg: "#f1f8e9",
      color: "#33691e",
      border: "1px solid #dcedc8",
    },

    // 13. Lượng từ (Measure word) - Cyan/Teal variant
    "Lượng từ": {
      bg: "#e0f2f1",
      color: "#00796b",
      border: "1px solid #b2dfdb",
    },

    // 14. Số từ (Numeral) - Pink
    "Số từ": {
      bg: "#fce4ec",
      color: "#c2185b",
      border: "1px solid #f8bbd0",
    },

    // 15. Từ tượng thanh (Onomatopoeia) - Lime
    "Từ tượng thanh": {
      bg: "#f9fbe7",
      color: "#827717",
      border: "1px solid #dce775",
    },

    // 16. Tiền tố (Prefix) - Brown
    "Tiền tố": {
      bg: "#efebe9",
      color: "#5d4037",
      border: "1px solid #d7ccc8",
    },

    // 17. Hậu tố (Suffix) - Brown
    "Hậu tố": {
      bg: "#efebe9",
      color: "#5d4037",
      border: "1px solid #d7ccc8",
    },

    // 18. Hình dung từ (Adjectival Verb) - Deep Purple
    "Hình dung từ": {
      bg: "#ede7f6",
      color: "#4527a0",
      border: "1px solid #d1c4e9",
    },
  };

  return (
    typeMap[type] || {
      bg: "#f5f5f5",
      color: "#616161",
      border: "1px solid #eeeeee",
    }
  );
};
