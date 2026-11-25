package pl.co.lms.entity.json;

import java.util.List;

public record QuadWordGuess(String requestId, String letters, List<String> feedback) {}
