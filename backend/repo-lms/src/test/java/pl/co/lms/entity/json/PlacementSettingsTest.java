package pl.co.lms.entity.json;

import base.co.common.exception.ApiException;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PlacementSettingsTest {

    @Test
    void validSettingsPass_andCloCodesHaveNoCountLimit() {
        var codes = new java.util.ArrayList<String>();
        for (int i = 1; i <= 40; i++) codes.add("CLO" + i);
        var s = PlacementSettings.builder().assignmentType(PlacementSettings.AssignmentType.HOMEWORK).maxAttempts(3)
                .showAnswer(PlacementSettings.ShowAnswer.AFTER_DUE).passThresholdPct(70).releaseOffsetH(0).dueOffsetH(48)
                .cloCodes(codes).gradingItem(new PlacementSettings.GradingItemRef("LMS", 0)).build();
        assertThatCode(s::validate).doesNotThrowAnyException();
        assertThatCode(() -> new PlacementSettings().validate()).doesNotThrowAnyException();
    }

    @Test
    void invalidValuesAreRejected() {
        List<PlacementSettings> bad = List.of(
                PlacementSettings.builder().maxAttempts(0).build(),
                PlacementSettings.builder().maxAttempts(4).build(),
                PlacementSettings.builder().passThresholdPct(150).build(),
                PlacementSettings.builder().passThresholdPct(-1).build(),
                PlacementSettings.builder().releaseOffsetH(-1).build(),
                PlacementSettings.builder().releaseOffsetH(48).dueOffsetH(24).build(),
                PlacementSettings.builder().cloCodes(List.of("CLO1", "CLO1")).build(),
                PlacementSettings.builder().cloCodes(List.of(" ")).build(),
                PlacementSettings.builder().gradingItem(new PlacementSettings.GradingItemRef(" ", 0)).build(),
                PlacementSettings.builder().gradingItem(new PlacementSettings.GradingItemRef("LMS", -2)).build());
        for (var s : bad) assertThatThrownBy(s::validate).isInstanceOf(ApiException.class);
    }
}
