package pl.co.lms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import pl.co.lms.service.grading.ai.WritingChatGradingClient;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import static org.assertj.core.api.Assertions.*;

class WritingChatGradingClientTest {
    ObjectMapper mapper = new ObjectMapper();
    @Test void compatibleProviderReceivesTaskFactsAndReturnsStructuredRubric() throws Exception {
        HttpServer server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        AtomicReference<String> request=new AtomicReference<>();
        server.createContext("/v1/chat/completions",exchange -> {
            request.set(new String(exchange.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));
            byte[] body="{\"choices\":[{\"finish_reason\":\"stop\",\"message\":{\"content\":\"{\\\"feedback\\\":\\\"Feedback\\\"}\"}}]}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200,body.length); exchange.getResponseBody().write(body); exchange.close();
        }); server.start();
        try {
            var client=new WritingChatGradingClient(mapper,"http://127.0.0.1:"+server.getAddress().getPort()+"/v1","test-key","test-model");
            var result=client.grade(mapper.createObjectNode().put("task",1).put("prompt","Describe this table").put("referenceText","1960: 25000 marriages"),"My essay");
            assertThat(result.path("feedback").asText()).isEqualTo("Feedback");
            var sent=mapper.readTree(request.get());
            assertThat(sent.path("response_format").path("type").asText()).isEqualTo("json_object");
            assertThat(sent.path("messages").get(1).path("content").asText()).contains("1960: 25000 marriages","My essay");
            assertThat(request.get()).doesNotContain("test-key","mentorRequest");
        } finally { server.stop(0); }
    }
    @Test void truncatedResponseCannotBecomeAScore() throws Exception {
        HttpServer server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/chat/completions",exchange -> {
            byte[] body="{\"choices\":[{\"finish_reason\":\"length\",\"message\":{\"content\":\"{}\"}}]}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200,body.length); exchange.getResponseBody().write(body); exchange.close();
        }); server.start();
        try {
            var client=new WritingChatGradingClient(mapper,"http://127.0.0.1:"+server.getAddress().getPort(),"test-key","test-model");
            assertThatThrownBy(() -> client.grade(mapper.createObjectNode(),"Essay")).isInstanceOf(IllegalStateException.class);
        } finally { server.stop(0); }
    }
    @Test void operatorMustConfigureProviderWithoutSendingCredentialsOverPublicHttp() {
        assertThatThrownBy(() -> new WritingChatGradingClient(mapper,"https://example.com","","model")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new WritingChatGradingClient(mapper,"http://example.com","key","model")).isInstanceOf(IllegalArgumentException.class);
    }
}
