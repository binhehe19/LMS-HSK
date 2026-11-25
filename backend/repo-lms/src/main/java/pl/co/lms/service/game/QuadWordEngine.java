package pl.co.lms.service.game;

import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import java.util.*;

public final class QuadWordEngine {
    public static final int MAX_GUESSES = 6;
    private QuadWordEngine() {}
    public static String letters(String value) {
        return value.replaceAll("[^a-zA-Z]", "").toUpperCase(Locale.ROOT);
    }
    public static String pattern(String answer) {
        return answer.trim().replaceAll("\\s+", " ").replaceAll("[a-zA-Z]", "_");
    }
    public static String validate(String input, String answer) {
        if (input == null || !input.trim().matches("(?U)[a-zA-Z\\s'-]+"))
            throw new ApiException(ErrorCode.E200, "Chỉ nhập chữ cái tiếng Anh. Khoảng trắng và dấu ngăn cách đã có sẵn.");
        String value = letters(input);
        if (value.length() != letters(answer).length())
            throw new ApiException(ErrorCode.E200, "Cần điền đủ " + letters(answer).length() + " chữ cái trước khi gửi.");
        return value;
    }
    public static List<String> evaluate(String answer, String guess) {
        Map<Character, Integer> remaining = new HashMap<>();
        var feedback = new ArrayList<>(Collections.nCopies(guess.length(), "absent"));
        for (int i = 0; i < answer.length(); i++) {
            if (answer.charAt(i) == guess.charAt(i)) feedback.set(i, "correct");
            else remaining.merge(answer.charAt(i), 1, Integer::sum);
        }
        for (int i = 0; i < guess.length(); i++) {
            if (feedback.get(i).equals("correct")) continue;
            char letter = guess.charAt(i);
            int count = remaining.getOrDefault(letter, 0);
            if (count > 0) { feedback.set(i, "present"); remaining.put(letter, count - 1); }
        }
        return List.copyOf(feedback);
    }
}
