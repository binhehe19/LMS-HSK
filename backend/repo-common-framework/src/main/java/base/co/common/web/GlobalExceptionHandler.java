package base.co.common.web;

import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.exc.InvalidFormatException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.ErrorResponseException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.persistence.EntityNotFoundException;
import base.co.common.dto.ApiResponse;
import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;

import java.util.Arrays;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiResponse<Object>> handleApiException(ApiException ex) {
        ErrorCode code = ex.getErrorCode() == null ? ErrorCode.INTERNAL_ERROR : ex.getErrorCode();
        HttpStatus status = code.status();
        // Giữ nguyên payload ngữ cảnh (vd danh sách lớp trùng lịch) để client hiển thị chi tiết.
        ApiResponse<Object> body = ApiResponse.error(code.code(), ex.getMessage(), ex.getData());
        return ResponseEntity.status(status).body(body);
    }

    /**
     * Body validation failures from {@code @Valid @RequestBody}. Distinguish missing-required
     * (NotBlank/NotNull/NotEmpty) → E243 vs other validation rules → BAD_REQUEST.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException ex) {
        boolean missingParam = ex.getBindingResult().getAllErrors().stream()
                .anyMatch(err -> {
                    String[] codes = err.getCodes();
                    if (codes == null) return false;
                    for (String c : codes) {
                        if (c == null) continue;
                        if (c.contains("NotBlank") || c.contains("NotNull") || c.contains("NotEmpty")) {
                            return true;
                        }
                    }
                    return false;
                });
        String message = ex.getBindingResult().getAllErrors().stream()
                .map(err -> {
                    if (!(err instanceof FieldError fe)) return err.getDefaultMessage();
                    // Ràng buộc @AssertTrue là kiểm tra liên-trường đặt trên một
                    // getter, nên "field" của nó là tên phương thức suy ra
                    // (isTimeRangeValid -> "timeRangeValid") — vô nghĩa với người
                    // dùng cuối và luôn đi kèm câu thông báo tự viết đã đủ ý.
                    // Các ràng buộc còn lại phần lớn dùng message mặc định tiếng
                    // Anh ("must not be blank"), ở đó tên trường là thông tin cần.
                    if (isAssertTrue(fe)) return fe.getDefaultMessage();
                    return fe.getField() + " " + fe.getDefaultMessage();
                })
                .collect(Collectors.joining("; "));
        ErrorCode code = missingParam ? ErrorCode.E243 : ErrorCode.BAD_REQUEST;
        ApiResponse<Void> body = ApiResponse.error(code.code(), message);
        return ResponseEntity.status(code.status()).body(body);
    }

    private static boolean isAssertTrue(FieldError error) {
        String[] codes = error.getCodes();
        if (codes == null) return false;
        for (String code : codes) {
            if (code != null && code.startsWith("AssertTrue")) return true;
        }
        return false;
    }

    /**
     * Constraint violations from {@code @Validated} on parameters/path variables. Same
     * missing-required vs other-validation distinction as {@link #handleValidation}.
     */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleConstraint(ConstraintViolationException ex) {
        boolean missingParam = ex.getConstraintViolations().stream()
                .map(ConstraintViolation::getConstraintDescriptor)
                .map(d -> d.getAnnotation().annotationType().getSimpleName())
                .anyMatch(name -> "NotBlank".equals(name) || "NotNull".equals(name) || "NotEmpty".equals(name));
        String message = ex.getConstraintViolations().stream()
                .map(ConstraintViolation::getMessage)
                .collect(Collectors.joining("; "));
        ErrorCode code = missingParam ? ErrorCode.E243 : ErrorCode.BAD_REQUEST;
        ApiResponse<Void> body = ApiResponse.error(code.code(), message);
        return ResponseEntity.status(code.status()).body(body);
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<ApiResponse<Void>> handleMethodValidation(HandlerMethodValidationException ex) {
        String message = ex.getAllErrors().stream()
                .map(error -> error.getDefaultMessage() == null ? "Invalid request parameter" : error.getDefaultMessage())
                .collect(Collectors.joining("; "));
        ApiResponse<Void> body = ApiResponse.error(ErrorCode.BAD_REQUEST.code(), message);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    /**
     * Malformed/unparseable request body → E202 (Invalid data type/format).
     * Surfaces the field path when Jackson reports {@link InvalidFormatException}.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleNotReadable(HttpMessageNotReadableException ex) {
        String message = ErrorCode.E202.message();
        Throwable cause = ex.getMostSpecificCause();
        if (cause instanceof InvalidFormatException invalidFormat) {
            String path = invalidFormat.getPath().stream()
                    .map(JsonMappingException.Reference::getFieldName)
                    .collect(Collectors.joining("."));
            if (!path.isBlank()) {
                message = "Invalid data type: " + path;
            }
        }
        ApiResponse<Void> body = ApiResponse.error(ErrorCode.E202.code(), message);
        return ResponseEntity.status(ErrorCode.E202.status()).body(body);
    }

    /**
     * HTTP method not supported on the matched route.
     */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiResponse<Void>> handleMethodNotSupported(HttpRequestMethodNotSupportedException ex) {
        ApiResponse<Void> body = ApiResponse.error(ErrorCode.METHOD_NOT_ALLOW.code(), ex.getMessage());
        return ResponseEntity.status(ErrorCode.METHOD_NOT_ALLOW.status()).body(body);
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ApiResponse<Void>> handleMediaTypeNotSupported(HttpMediaTypeNotSupportedException ex) {
        ApiResponse<Void> body = ApiResponse.error(ErrorCode.BAD_REQUEST.code(), ex.getMessage());
        return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).body(body);
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    public ResponseEntity<ApiResponse<Void>> handleMissingPart(MissingServletRequestPartException ex) {
        ApiResponse<Void> body = ApiResponse.error(
                ErrorCode.E243.code(), "Required request part missing: " + ex.getRequestPartName());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleEntityNotFound(EntityNotFoundException ex) {
        ApiResponse<Void> body = ApiResponse.error(ErrorCode.E227.code(), ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
    }

    @ExceptionHandler(ErrorResponseException.class)
    public ResponseEntity<ApiResponse<Void>> handleErrorResponse(ErrorResponseException ex) {
        HttpStatus status = HttpStatus.resolve(ex.getStatusCode().value());
        if (status == null) {
            return handleGeneric(ex);
        }
        String message = ex.getBody().getDetail();
        if (message == null || message.isBlank()) {
            message = status.getReasonPhrase();
        }
        ApiResponse<Void> body = ApiResponse.error(mapErrorCodeByStatus(status), message);
        return ResponseEntity.status(status).body(body);
    }

    /**
     * Missing required {@code @RequestParam} — handled before generic validation.
     */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiResponse<Void>> handleMissingParam(MissingServletRequestParameterException ex) {
        String name = ex.getParameterName();
        String message = (name == null || name.isBlank())
                ? ErrorCode.E243.message()
                : "Required parameter missing: " + name;
        ApiResponse<Void> body = ApiResponse.error(ErrorCode.E243.code(), message);
        return ResponseEntity.status(ErrorCode.E243.status()).body(body);
    }

    /**
     * Missing required {@code @RequestHeader}.
     */
    @ExceptionHandler(MissingRequestHeaderException.class)
    public ResponseEntity<ApiResponse<Void>> handleMissingHeader(MissingRequestHeaderException ex) {
        String name = ex.getHeaderName();
        String message = (name == null || name.isBlank())
                ? "Header is required"
                : name + " is required";
        ApiResponse<Void> body = ApiResponse.error(ErrorCode.E221.code(), message);
        return ResponseEntity.status(ErrorCode.E221.status()).body(body);
    }

    /**
     * Type-mismatch on path/query parameters. Keeps the enum allowed-values hint.
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Void>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        String message = "Invalid value for parameter '" + ex.getName() + "'";
        Class<?> requiredType = ex.getRequiredType();
        if (requiredType != null && requiredType.isEnum()) {
            Object[] allowed = requiredType.getEnumConstants();
            String allowedValues = allowed == null ? ""
                    : Arrays.stream(allowed)
                            .map(String::valueOf)
                            .collect(Collectors.joining(", "));
            message = message + ". Allowed values: " + allowedValues;
        }
        ApiResponse<Void> body = ApiResponse.error(ErrorCode.BAD_REQUEST.code(), message);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgument(IllegalArgumentException ex) {
        ApiResponse<Void> body = ApiResponse.error(ErrorCode.BAD_REQUEST.code(), ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiResponse<Void>> handleMaxUploadSize(MaxUploadSizeExceededException ex) {
        ApiResponse<Void> body = ApiResponse.error(
                ErrorCode.BAD_REQUEST.code(), "File size exceeds maximum limit");
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(body);
    }

    @ExceptionHandler(InvalidFormatException.class)
    public ResponseEntity<ApiResponse<Void>> handleInvalidFormat(InvalidFormatException ex) {
        String path = ex.getPath().stream()
                .map(JsonMappingException.Reference::getFieldName)
                .collect(Collectors.joining("."));
        String message = path.isBlank() ? "Invalid value" : "Invalid value for field: " + path;
        ApiResponse<Void> body = ApiResponse.error(ErrorCode.BAD_REQUEST.code(), message);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<ApiResponse<Void>> handleMultipart(MultipartException ex) {
        String message = ex.getMessage() != null
                ? "File upload error: " + ex.getMessage()
                : "File upload error";
        ApiResponse<Void> body = ApiResponse.error(ErrorCode.BAD_REQUEST.code(), message);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDenied(AccessDeniedException ex) {
        ApiResponse<Void> body = ApiResponse.error(ErrorCode.FORBIDDEN.code(), ex.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
    }

    /**
     * Unique index / CHECK constraint bị vi phạm (thường do hai request đồng thời) là lỗi nghiệp vụ,
     * không phải lỗi máy chủ. Không trả message gốc vì nó chứa tên bảng, cột và câu SQL.
     */
    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleDataIntegrity(
            org.springframework.dao.DataIntegrityViolationException ex) {
        log.warn("Data integrity violation: {}", ex.getMostSpecificCause().getMessage());
        ApiResponse<Void> body = ApiResponse.error(ErrorCode.CONFLICT.code(),
                "Dữ liệu bị trùng hoặc vi phạm ràng buộc. Vui lòng tải lại trang và thử lại.");
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    /**
     * Honor {@code @ResponseStatus} on custom runtime exceptions.
     */
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ApiResponse<Void>> handleRuntimeWithResponseStatus(RuntimeException ex) {
        ResponseStatus responseStatus = AnnotationUtils.findAnnotation(ex.getClass(), ResponseStatus.class);
        if (responseStatus == null) {
            return handleGeneric(ex);
        }
        HttpStatus status = responseStatus.code() != HttpStatus.INTERNAL_SERVER_ERROR
                ? responseStatus.code()
                : responseStatus.value();
        if (status == HttpStatus.INTERNAL_SERVER_ERROR) {
            return handleGeneric(ex);
        }
        String message = ex.getMessage() != null ? ex.getMessage() : status.getReasonPhrase();
        ApiResponse<Void> body = ApiResponse.error(mapErrorCodeByStatus(status), message);
        return ResponseEntity.status(status).body(body);
    }

    /**
     * Catch-all. Treats Spring's NoHandler/NoResource exceptions as 404 to avoid leaking
     * generic INTERNAL_ERROR for unknown routes / static resource misses.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGeneric(Exception ex) {
        if (isNotFoundException(ex)) {
            ApiResponse<Void> body = ApiResponse.error(ErrorCode.NOT_FOUND.code(), ErrorCode.NOT_FOUND.message());
            return ResponseEntity.status(ErrorCode.NOT_FOUND.status()).body(body);
        }
        log.error("Unhandled exception", ex);
        ApiResponse<Void> body = ApiResponse.error(ErrorCode.INTERNAL_ERROR.code(), "Internal server error");
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
    }

    private boolean isNotFoundException(Exception ex) {
        String name = ex.getClass().getName();
        return "org.springframework.web.servlet.NoHandlerFoundException".equals(name)
                || "org.springframework.web.servlet.resource.NoResourceFoundException".equals(name);
    }

    private String mapErrorCodeByStatus(HttpStatus status) {
        return switch (status) {
            case BAD_REQUEST -> ErrorCode.BAD_REQUEST.code();
            case UNAUTHORIZED -> ErrorCode.UNAUTHORIZED.code();
            case FORBIDDEN -> ErrorCode.FORBIDDEN.code();
            case NOT_FOUND -> ErrorCode.NOT_FOUND.code();
            case CONFLICT -> ErrorCode.CONFLICT.code();
            case TOO_MANY_REQUESTS -> ErrorCode.TOO_MANY_REQUESTS.code();
            default -> ErrorCode.INTERNAL_ERROR.code();
        };
    }
}
