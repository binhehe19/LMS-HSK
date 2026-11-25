package pl.co.lms.dto.response;

import java.util.List;

public record QuadWordGuessResponse(String letters, List<String> feedback) {}
