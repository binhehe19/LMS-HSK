package pl.co.lms.service.studymaterials;

import java.util.*;
import java.util.regex.Pattern;

/** Token trie: one pass per paragraph, whole tokens, explicit variants, original UTF-16 offsets. */
public final class VocabularyTextMatcher {
    private static final Pattern TOKENS = Pattern.compile("\\s+|[\\p{L}\\p{M}\\p{N}]+(?:['’][\\p{L}\\p{M}\\p{N}]+)*|[^\\s\\p{L}\\p{M}\\p{N}]", Pattern.UNICODE_CHARACTER_CLASS);
    public record Term(String resourceId, String text) {}
    public record Match(String resourceId, int start, int end, String surface) {}
    private record Token(String key, int start, int end) {}
    private static final class Node {
        final Map<String, Node> children = new HashMap<>();
        final Set<String> ids = new TreeSet<>();
    }
    private final Node root = new Node();
    public VocabularyTextMatcher(Collection<Term> terms) {
        for (var term : terms) {
            if (term.text() == null || term.text().isBlank()) continue;
            var node = root;
            for (var token : tokens(term.text().strip())) node = node.children.computeIfAbsent(token.key(), key -> new Node());
            node.ids.add(term.resourceId());
        }
    }
    public List<Match> find(String text) {
        if (text == null || text.isEmpty()) return List.of();
        var tokens = tokens(text);
        var result = new ArrayList<Match>();
        for (int start = 0; start < tokens.size(); start++) {
            if (tokens.get(start).key().equals(" ")) continue;
            var node = root;
            for (int end = start; end < tokens.size(); end++) {
                node = node.children.get(tokens.get(end).key());
                if (node == null) break;
                for (String id : node.ids) {
                    int from = tokens.get(start).start(), to = tokens.get(end).end();
                    result.add(new Match(id, from, to, text.substring(from, to)));
                    StudyMaterialValidation.require(result.size() <= 100000, "Bài đọc có quá nhiều vị trí từ vựng");
                }
            }
        }
        return result;
    }
    /**
     * Các khoá từ (cùng quy ước với ResourceSearchColumns.wordKey: chữ thường, khoảng trắng gộp một) của mọi cụm tối đa maxTokens token liên tiếp
     * trong văn bản. Tra các khoá này ở cột word_key cho ra đúng các từ mà find() có thể khớp (cùng cách tách token, khớp nguyên token).
     */
    public static Set<String> lookupKeys(String text, int maxTokens) {
        var keys = new LinkedHashSet<String>();
        if (text == null || text.isEmpty()) return keys;
        var tokens = tokens(text);
        for (int start = 0; start < tokens.size(); start++) {
            if (tokens.get(start).key().equals(" ")) continue;
            var key = new StringBuilder();
            int used = 0;
            for (int end = start; end < tokens.size() && used < maxTokens; end++) {
                String token = tokens.get(end).key();
                key.append(token);
                if (token.equals(" ")) continue;
                used++;
                keys.add(key.toString());
            }
        }
        return keys;
    }
    public static List<Match> nonOverlapping(Collection<Match> candidates) {
        var ordered = candidates.stream().sorted(Comparator.<Match>comparingInt(match -> match.end() - match.start()).reversed()
                .thenComparingInt(Match::start).thenComparing(Match::resourceId)).toList();
        var accepted = new TreeMap<Integer, Match>();
        for (var match : ordered) {
            var before = accepted.floorEntry(match.start());
            var after = accepted.ceilingEntry(match.start());
            if (before != null && before.getValue().end() > match.start() || after != null && after.getKey() < match.end()) continue;
            accepted.put(match.start(), match);
        }
        return List.copyOf(accepted.values());
    }
    private static List<Token> tokens(String text) {
        var result = new ArrayList<Token>();
        var matcher = TOKENS.matcher(text);
        while (matcher.find()) {
            String value = matcher.group();
            boolean whitespace = value.codePoints().allMatch(point -> Character.isWhitespace(point) || Character.isSpaceChar(point));
            result.add(new Token(whitespace ? " " : value.toLowerCase(Locale.ROOT), matcher.start(), matcher.end()));
        }
        return result;
    }
}
