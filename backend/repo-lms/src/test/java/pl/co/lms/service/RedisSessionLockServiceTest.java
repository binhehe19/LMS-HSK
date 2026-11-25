package pl.co.lms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RedisSessionLockServiceTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @SuppressWarnings("unchecked")
    @Mock
    private ValueOperations<String, String> valueOps;

    private RedisSessionLockService service;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        service = new RedisSessionLockService(redisTemplate, objectMapper);
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void acquireOrRenew_NewKey_ReturnsAcquiredTrue() {
        doReturn(List.of(1L, "user1", 60000L))
                .when(redisTemplate)
                .execute(any(), anyList(), any(Object[].class));

        RedisSessionLockService.LockResult result =
                service.acquireOrRenew("pkg-edit-lock", "pkg-1", "user1", "tok1", 60L, false);

        assertThat(result.acquired()).isTrue();
        assertThat(result.holderUserId()).isEqualTo("user1");
        assertThat(result.expiresAt()).isNotNull();
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void acquireOrRenew_SameToken_Renews() {
        doReturn(List.of(1L, "user1", 60000L))
                .when(redisTemplate)
                .execute(any(), anyList(), any(Object[].class));

        RedisSessionLockService.LockResult result =
                service.acquireOrRenew("pkg-edit-lock", "pkg-1", "user1", "tok1", 60L, false);

        assertThat(result.acquired()).isTrue();
        assertThat(result.expiresAt()).isNotNull();
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void acquireOrRenew_DifferentToken_ReturnsAcquiredFalse() {
        doReturn(List.of(0L, "holder-user", 30000L))
                .when(redisTemplate)
                .execute(any(), anyList(), any(Object[].class));

        RedisSessionLockService.LockResult result =
                service.acquireOrRenew("pkg-edit-lock", "pkg-1", "user2", "tok2", 60L, false);

        assertThat(result.acquired()).isFalse();
        assertThat(result.holderUserId()).isEqualTo("holder-user");
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void acquireOrRenew_NullResult_ReturnsAcquiredFalse() {
        doReturn(null)
                .when(redisTemplate)
                .execute(any(), anyList(), any(Object[].class));

        RedisSessionLockService.LockResult result =
                service.acquireOrRenew("pkg-edit-lock", "pkg-1", "user1", "tok1", 60L, false);

        assertThat(result.acquired()).isFalse();
        assertThat(result.holderUserId()).isNull();
        assertThat(result.expiresAt()).isNull();
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void release_MatchingToken_CallsExecute() {
        doReturn(1L)
                .when(redisTemplate)
                .execute(any(), anyList(), any(Object[].class));

        service.release("pkg-edit-lock", "pkg-1", "tok1");

        verify(redisTemplate).execute(any(), anyList(), any(Object[].class));
    }

    @Test
    void isHeldBy_WhenKeyExists_AndTokenMatches_ReturnsTrue() throws Exception {
        String json = objectMapper.writeValueAsString(
                new RedisSessionLockService.LockHolder("u1", "tok1"));
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.get("pkg-edit-lock:pkg-1")).thenReturn(json);

        boolean result = service.isHeldBy("pkg-edit-lock", "pkg-1", "tok1");

        assertThat(result).isTrue();
    }

    @Test
    void isHeldBy_WhenKeyExists_AndTokenMismatch_ReturnsFalse() throws Exception {
        String json = objectMapper.writeValueAsString(
                new RedisSessionLockService.LockHolder("u1", "tok1"));
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.get("pkg-edit-lock:pkg-1")).thenReturn(json);

        boolean result = service.isHeldBy("pkg-edit-lock", "pkg-1", "wrong-tok");

        assertThat(result).isFalse();
    }

    @Test
    void forceDelete_CallsRedisDelete() {
        service.forceDelete("pkg-edit-lock", "pkg-1");

        verify(redisTemplate).delete("pkg-edit-lock:pkg-1");
    }
}
