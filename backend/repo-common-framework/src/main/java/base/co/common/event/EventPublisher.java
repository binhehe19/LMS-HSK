package base.co.common.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
public class EventPublisher {

    private static final Logger log = LoggerFactory.getLogger(EventPublisher.class);

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public EventPublisher(KafkaTemplate<String, String> kafkaTemplate,
                          ObjectMapper objectMapper) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
    }

    public void publish(String topic, String key, Object payload) {
        if (topic == null || topic.isBlank()) {
            return;
        }
        try {
            String message = payload == null ? null : objectMapper.writeValueAsString(payload);
            log.debug("Enqueuing event: topic={}, key={}, payloadType={}",
                    topic, key, payload == null ? "null" : payload.getClass().getSimpleName());
            kafkaTemplate.send(topic, key, message).whenComplete((result, ex) -> {
                if (ex != null) {
                    log.error("Failed to deliver event: topic={}, key={}, error={}",
                            topic, key, ex.getMessage(), ex);
                    return;
                }
                log.debug("Event delivered: topic={}, key={}, partition={}, offset={}",
                        topic, key,
                        result.getRecordMetadata().partition(),
                        result.getRecordMetadata().offset());
            });
        } catch (Exception ex) {
            log.warn("Failed to publish event: {}", ex.getMessage());
        }
    }
}
