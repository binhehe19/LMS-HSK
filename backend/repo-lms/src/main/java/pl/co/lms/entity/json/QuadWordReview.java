package pl.co.lms.entity.json;

@com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = true)
public record QuadWordReview(String answer, String definition, String phonetic,
                             String usageNote, String exampleEn, String exampleVi, String audioUrl, String audioAccent,
                             String meaning) {
    public QuadWordReview(String answer, String definition, String phonetic, String usageNote,
            String exampleEn, String exampleVi, String audioUrl, String audioAccent) {
        this(answer, definition, phonetic, usageNote, exampleEn, exampleVi, audioUrl, audioAccent, null);
    }

    public QuadWordReview withMeaning(String meaning) {
        return new QuadWordReview(answer, definition, phonetic, usageNote, exampleEn, exampleVi, audioUrl, audioAccent, meaning);
    }
}
