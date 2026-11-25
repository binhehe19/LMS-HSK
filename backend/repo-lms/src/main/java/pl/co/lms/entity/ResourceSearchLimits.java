package pl.co.lms.entity;

/** Độ dài tối đa của các cột tìm kiếm của {@link LearningResource}; giá trị dài hơn bị cắt khi dựng cột. */
public final class ResourceSearchLimits {
    public static final int TITLE = 500;
    public static final int TEXT = 20_000;
    public static final int TAGS = 1_500;
    public static final int WORD_KEY = 300;
    public static final int CEFR = 20;
    public static final int TOPIC = 100;

    private ResourceSearchLimits() {}
}
