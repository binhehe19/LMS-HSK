package pl.co.lms.dto.response;

import pl.co.lms.client.dto.CmsSyllabusMaterial;

public record SyllabusMaterialResponse(
        String id,
        String title,
        String type,
        String isbn,
        String author,
        String publisher,
        String year,
        String edition
) {
    public static SyllabusMaterialResponse from(CmsSyllabusMaterial m) {
        return new SyllabusMaterialResponse(
                m.getId(), m.getTitle(), m.getType(), m.getIsbn(),
                m.getAuthor(), m.getPublisher(), m.getYear(), m.getEdition());
    }
}
