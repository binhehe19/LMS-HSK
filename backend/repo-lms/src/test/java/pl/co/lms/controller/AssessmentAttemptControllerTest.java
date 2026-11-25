package pl.co.lms.controller;

import base.co.common.dto.ApiResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import pl.co.lms.dto.request.AcquireAssessmentLockRequest;
import pl.co.lms.dto.request.HeartbeatAssessmentAttemptRequest;
import pl.co.lms.dto.request.StartAssessmentAttemptRequest;
import pl.co.lms.dto.request.SubmitAssessmentAttemptRequest;
import pl.co.lms.dto.response.HeartbeatAssessmentAttemptResponse;
import pl.co.lms.dto.response.AssessmentAttemptResponse;
import pl.co.lms.dto.response.AssessmentLockResponse;
import pl.co.lms.dto.response.SubmitAssessmentAttemptResponse;
import pl.co.lms.entity.AssessmentAttemptStatus;
import pl.co.lms.service.AssessmentAttemptService;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AssessmentAttemptControllerTest {

    @Mock
    private AssessmentAttemptService assessmentAttemptService;

    @InjectMocks
    private AssessmentAttemptController assessmentAttemptController;

    @Test
    @DisplayName("startOrResume should return 200 and delegate to service")
    void startOrResume_ShouldReturnAttemptResponse() {
        AssessmentAttemptResponse stub = new AssessmentAttemptResponse(
                "att-1", "ver-1", "res-1", "session-1", 1,
                AssessmentAttemptStatus.IN_PROGRESS, null, null, null, null, List.of(), List.of(),
                null, null, null, 0L, null, null, null);
        when(assessmentAttemptService.startOrResume(any(StartAssessmentAttemptRequest.class))).thenReturn(stub);

        ResponseEntity<ApiResponse<AssessmentAttemptResponse>> response =
                assessmentAttemptController.startOrResume(new StartAssessmentAttemptRequest("session-1", 1, "ver-1", "res-1"));

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().success()).isTrue();
        verify(assessmentAttemptService).startOrResume(any(StartAssessmentAttemptRequest.class));
    }

    @Test
    @DisplayName("getAttempt should return 200 and delegate to service")
    void getAttempt_ShouldReturnAttemptResponse() {
        AssessmentAttemptResponse stub = new AssessmentAttemptResponse(
                "att-1", "ver-1", "res-1", "session-1", 1,
                AssessmentAttemptStatus.IN_PROGRESS, null, null, null, null, List.of(), List.of(),
                null, null, null, 0L, null, null, null);
        when(assessmentAttemptService.getAttempt("att-1")).thenReturn(stub);

        ResponseEntity<ApiResponse<AssessmentAttemptResponse>> response =
                assessmentAttemptController.getAttempt("att-1");

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().success()).isTrue();
        verify(assessmentAttemptService).getAttempt("att-1");
    }

    @Test
    @DisplayName("acquireLock should return 200 and delegate to service")
    void acquireLock_ShouldReturnLockResponse() {
        AssessmentLockResponse stub = new AssessmentLockResponse(true, "user-1", Instant.now().plusSeconds(60),
                Instant.now(), null);
        when(assessmentAttemptService.acquireLock(eq("att-1"), any(AcquireAssessmentLockRequest.class))).thenReturn(stub);

        ResponseEntity<ApiResponse<AssessmentLockResponse>> response =
                assessmentAttemptController.acquireLock("att-1", new AcquireAssessmentLockRequest("tok", false));

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().success()).isTrue();
        verify(assessmentAttemptService).acquireLock(eq("att-1"), any(AcquireAssessmentLockRequest.class));
    }

    @Test
    @DisplayName("releaseLock should return 200 and delegate to service")
    void releaseLock_ShouldReturnLockResponse() {
        AssessmentLockResponse stub = new AssessmentLockResponse(true, "user-1", null, Instant.now(), null);
        when(assessmentAttemptService.releaseLock("att-1", "tok")).thenReturn(stub);

        ResponseEntity<ApiResponse<AssessmentLockResponse>> response =
                assessmentAttemptController.releaseLock("att-1", "tok");

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().success()).isTrue();
        verify(assessmentAttemptService).releaseLock("att-1", "tok");
    }

    @Test
    @DisplayName("heartbeat should return 200 and delegate to service")
    void heartbeat_ShouldReturnHeartbeatResponse() {
        HeartbeatAssessmentAttemptResponse stub = new HeartbeatAssessmentAttemptResponse(
                true, Instant.now().plusSeconds(60), Instant.now(), null, null,
                AssessmentAttemptStatus.IN_PROGRESS, List.of());
        when(assessmentAttemptService.heartbeat(eq("att-1"), any(HeartbeatAssessmentAttemptRequest.class))).thenReturn(stub);

        ResponseEntity<ApiResponse<HeartbeatAssessmentAttemptResponse>> response =
                assessmentAttemptController.heartbeat("att-1", new HeartbeatAssessmentAttemptRequest("tok", null));

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().success()).isTrue();
        verify(assessmentAttemptService).heartbeat(eq("att-1"), any(HeartbeatAssessmentAttemptRequest.class));
    }

    @Test
    @DisplayName("submit should return 200 and delegate to service")
    void submit_ShouldReturnSubmitResponse() {
        SubmitAssessmentAttemptResponse stub = new SubmitAssessmentAttemptResponse("att-1", false, Instant.now());
        when(assessmentAttemptService.submit(eq("att-1"), any(SubmitAssessmentAttemptRequest.class))).thenReturn(stub);

        ResponseEntity<ApiResponse<SubmitAssessmentAttemptResponse>> response =
                assessmentAttemptController.submit("att-1", new SubmitAssessmentAttemptRequest("tok", null));

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().success()).isTrue();
        verify(assessmentAttemptService).submit(eq("att-1"), any(SubmitAssessmentAttemptRequest.class));
    }
}
