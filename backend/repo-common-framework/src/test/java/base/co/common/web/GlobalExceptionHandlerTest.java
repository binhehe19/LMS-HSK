package base.co.common.web;

import base.co.common.dto.ApiResponse;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void dataIntegrityViolationIsConflictWithoutLeakingSql() {
        DataIntegrityViolationException ex = new DataIntegrityViolationException(
                "could not execute statement; SQL [insert into ticket ...]; constraint [uk_ticket_open_subject]");

        ResponseEntity<ApiResponse<Void>> response = handler.handleDataIntegrity(ex);

        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        String message = response.getBody().errorMessage();
        assertEquals("CONFLICT", response.getBody().errorCode());
        assertFalse(message.contains("uk_ticket_open_subject"), "không được lộ tên constraint/SQL ra client");
        assertFalse(message.contains("insert into"));
    }
}
