package pl.co.lms.dto.request;
import jakarta.validation.constraints.*;
public record SpeakingBookingRequest(@Size(max=100) String itemId,
    @NotBlank @Size(max=150) String name, @NotBlank @Email @Size(max=150) String email,
    @NotBlank @Pattern(regexp="[+0-9() .-]{8,20}") String phone,
    @NotBlank @Size(max=100) String slot, @NotNull @Size(max=5000) String note) {}
