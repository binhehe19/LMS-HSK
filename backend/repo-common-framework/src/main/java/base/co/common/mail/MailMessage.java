package base.co.common.mail;

public record MailMessage(String to, String subject, String body, boolean html) {
}
