package pl.co.lms.service;

import java.text.Normalizer;
import java.util.*;

/** Meaning checks shared by saved lessons and skip tests; mirrors space-learning.ts. */
final class VocabularyMeaningMatcher {
    private VocabularyMeaningMatcher() {}
    private static final Set<String> PROTECTED = Set.of("khong", "chua", "chang", "thieu", "not", "no", "never", "without");

    private static String key(String value) {
        return Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT).replace('đ', 'd')
                .replaceAll("[^\\p{L}\\p{N}\\s]", " ").replaceAll("\\s+", " ").trim()
                .replaceFirst("^(?:(?:la|su|viec|mot|nhung|cac)\\s+)+", "");
    }

    static boolean matches(Collection<String> meanings, String answer) {
        String actual = key(answer);
        if (actual.isBlank()) return false;
        for (String meaning : meanings) {
            if (meaning == null || meaning.isBlank()) continue;
            String plain = meaning.replaceAll("\\([^)]*\\)|\\[[^\\]]*\\]", " ");
            var variants = new ArrayList<>(List.of(meaning, plain));
            variants.addAll(Arrays.asList(plain.split("[;,|/\\n]+")));
            if (variants.stream().map(VocabularyMeaningMatcher::key).filter(s -> !s.isBlank())
                    .anyMatch(expected -> near(expected, actual))) return true;
        }
        return false;
    }

    private static boolean near(String expected, String actual) {
        if (expected.equals(actual)) return true;
        String[] left = expected.split(" "), right = actual.split(" ");
        int length = Math.min(expected.length(), actual.length());
        if (left.length != right.length || length < 6) return false;
        for (int i = 0; i < left.length; i++) {
            if (!left[i].equals(right[i]) && (PROTECTED.contains(left[i]) || PROTECTED.contains(right[i])
                    || Math.min(left[i].length(), right[i].length()) < 3
                    || (left[i].length() <= 3 && left[i].length() == right[i].length()))) return false;
        }
        int limit = Math.min(2, (int) Math.floor(length * 0.15));
        if (Math.abs(expected.length() - actual.length()) > limit) return false;
        int[][] rows = new int[expected.length() + 1][actual.length() + 1];
        for (int j = 0; j <= actual.length(); j++) rows[0][j] = j;
        for (int i = 1; i <= expected.length(); i++) {
            rows[i][0] = i;
            int minimum = i;
            for (int j = 1; j <= actual.length(); j++) {
                rows[i][j] = Math.min(Math.min(rows[i][j - 1] + 1, rows[i - 1][j] + 1),
                        rows[i - 1][j - 1] + (expected.charAt(i - 1) == actual.charAt(j - 1) ? 0 : 1));
                if (i > 1 && j > 1 && expected.charAt(i - 1) == actual.charAt(j - 2)
                        && expected.charAt(i - 2) == actual.charAt(j - 1))
                    rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
                minimum = Math.min(minimum, rows[i][j]);
            }
            if (minimum > limit) return false;
        }
        return rows[expected.length()][actual.length()] <= limit;
    }
}
