package pl.co.lms.entity;

import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Locale;

public enum QuadWordStatus {
    PLAYING, WON, LOST;
    @JsonValue public String value() { return name().toLowerCase(Locale.ROOT); }
}
