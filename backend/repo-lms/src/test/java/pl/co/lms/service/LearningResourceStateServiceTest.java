package pl.co.lms.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pl.co.lms.entity.FlashcardStatus;
import pl.co.lms.entity.LearningResource;
import pl.co.lms.entity.LearningResourceState;
import pl.co.lms.entity.LearningResourceType;
import pl.co.lms.entity.VocabularyComprehensionLevel;
import pl.co.lms.repository.LearningResourceRepository;
import pl.co.lms.repository.LearningResourceStateRepository;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.times;

@ExtendWith(MockitoExtension.class)
class LearningResourceStateServiceTest {

    @Mock
    private LearningResourceStateRepository stateRepository;
    @Mock
    private LearningResourceRepository resourceRepository;

    private LearningResourceStateService service;

    @BeforeEach
    void setUp() {
        service = new LearningResourceStateService(stateRepository, resourceRepository);
    }

    @Test
    void updateFlashcardStatus_UpdatesReviewCountAndTimestamp() {
        when(resourceRepository.findByIdAndDeletedFalse("res-1")).thenReturn(Optional.of(new LearningResource()));
        when(stateRepository.findByUserIdAndLearningResourceIdAndDeletedFalse("user-1", "res-1"))
                .thenReturn(Optional.empty());

        when(stateRepository.save(any(LearningResourceState.class))).thenAnswer(i -> {
            LearningResourceState s = i.getArgument(0);
            s.setId("state-1");
            return s;
        });

        LearningResourceState result = service.updateFlashcardStatus("user-1", "res-1", FlashcardStatus.LEARNED);
        assertThat(result.getId()).isEqualTo("state-1");
        assertThat(result.getStatus()).isEqualTo(FlashcardStatus.LEARNED);
        assertThat(result.getReviewCount()).isEqualTo(1);
        assertThat(result.getLastReviewedAt()).isNotNull();
    }

    @Test
    void updateVocabularyState_UpdatesSavedAndComprehension() {
        when(resourceRepository.findByIdAndDeletedFalse("res-1")).thenReturn(Optional.of(new LearningResource()));
        when(stateRepository.findByUserIdAndLearningResourceIdAndDeletedFalse("user-1", "res-1"))
                .thenReturn(Optional.empty());

        when(stateRepository.save(any(LearningResourceState.class))).thenAnswer(i -> {
            LearningResourceState s = i.getArgument(0);
            s.setId("state-1");
            return s;
        });

        LearningResourceState result = service.updateVocabularyState(
                "user-1", "res-1", true, "Important word", VocabularyComprehensionLevel.KNOWN);

        assertThat(result.isSaved()).isTrue();
        assertThat(result.getNote()).isEqualTo("Important word");
        assertThat(result.getComprehensionLevel()).isEqualTo(VocabularyComprehensionLevel.KNOWN);
    }

    @Test
    void getSavedResources_ReturnsList() {
        LearningResourceState state = LearningResourceState.builder()
                .userId("user-1").learningResourceId("res-1").saved(true).build();
        when(stateRepository.findByUserIdAndSavedTrueAndDeletedFalse("user-1")).thenReturn(List.of(state));

        List<LearningResourceState> saved = service.getSavedResources("user-1");
        assertThat(saved).hasSize(1);
        assertThat(saved.get(0).getLearningResourceId()).isEqualTo("res-1");
    }

    @Test
    void learningLessonCopyAlsoUpdatesTheMatchingPublishedSourceWithoutCopyingNotes() {
        var source = LearningResource.builder().type(LearningResourceType.VOCABULARY).inLibrary(true)
                .publishedVersionId("v1").wordKey("sustainable").build();
        source.setId("source");
        var copy = LearningResource.builder().type(LearningResourceType.VOCABULARY).sourceResourceId("source")
                .wordKey("sustainable").build();
        when(resourceRepository.findByIdAndDeletedFalse("copy")).thenReturn(Optional.of(copy));
        when(resourceRepository.findByIdAndDeletedFalse("source")).thenReturn(Optional.of(source));
        when(stateRepository.findByUserIdAndLearningResourceIdAndDeletedFalse("user", "copy")).thenReturn(Optional.empty());
        when(stateRepository.findByUserIdAndLearningResourceIdAndDeletedFalse("user", "source")).thenReturn(Optional.empty());
        when(stateRepository.save(any(LearningResourceState.class))).thenAnswer(call -> call.getArgument(0));
        service.updateVocabularyState("user", "copy", true, "Private lesson note", VocabularyComprehensionLevel.LEARNING);
        var saved = org.mockito.ArgumentCaptor.forClass(LearningResourceState.class);
        verify(stateRepository, times(2)).save(saved.capture());
        var mirrored = saved.getAllValues().stream().filter(state -> state.getLearningResourceId().equals("source")).findFirst().orElseThrow();
        assertThat(mirrored.getComprehensionLevel()).isEqualTo(VocabularyComprehensionLevel.LEARNING);
        assertThat(mirrored.getReviewAt()).isNotNull();
        assertThat(mirrored.getNote()).isNull();
    }
}
