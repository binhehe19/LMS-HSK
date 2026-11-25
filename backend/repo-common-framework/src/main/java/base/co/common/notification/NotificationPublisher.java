package base.co.common.notification;

import base.co.common.event.EventPublisher;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Publish NotificationEvent to a Kafka topic so notification-service can consume.
 */
@Component
public class NotificationPublisher {

    private final EventPublisher eventPublisher;
    private final String topic;

    public NotificationPublisher(EventPublisher eventPublisher,
                                 @Value("${notification.publisher.topic:notification.events}") String topic) {
        this.eventPublisher = eventPublisher;
        this.topic = topic;
    }

    public void publish(NotificationEvent event) {
        if (event == null || event.userId() == null || event.userId().isBlank()) {
            return;
        }
        eventPublisher.publish(topic, event.userId(), event);
    }
}
