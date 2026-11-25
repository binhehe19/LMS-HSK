package pl.co.lms.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

// Khoá phiên Redis dùng chung — key `{prefix}:{id}`, giá trị JSON `{userId, sessionToken}`.
// Dùng cho: khóa làm bài (prefix "assessment-attempt-lock") và khóa sửa package (prefix "pkg-edit-lock").
// Mọi thao tác nguyên tử qua Lua script để tránh race condition.
@Service
@RequiredArgsConstructor
public class RedisSessionLockService {

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    // Chiếm hoặc gia hạn khóa.
    // Trả về LockResult với acquired=true nếu thành công.
    // force=true: ghi đè ngay cả khi token khác (tab cũ treo).
    private static final DefaultRedisScript<List> ACQUIRE_SCRIPT = new DefaultRedisScript<>(
            """
            local key   = KEYS[1]
            local uid   = ARGV[1]
            local token = ARGV[2]
            local ttlMs = tonumber(ARGV[3])
            local force = ARGV[4] == '1'
            local value = ARGV[5]
            local existing = redis.call('GET', key)
            if not existing then
              redis.call('SET', key, value, 'PX', ttlMs)
              return {1, uid, ttlMs}
            end
            local ok, data = pcall(cjson.decode, existing)
            if (ok and data['sessionToken'] == token) or force then
              redis.call('SET', key, value, 'PX', ttlMs)
              return {1, uid, ttlMs}
            end
            local remaining = redis.call('PTTL', key)
            local holderId = ''
            if ok and data['userId'] then holderId = data['userId'] end
            return {0, holderId, remaining}
            """,
            List.class
    );

    // Nhả khóa — chỉ xóa khi token khớp (idempotent, bỏ qua nếu không khớp).
    private static final DefaultRedisScript<Long> RELEASE_SCRIPT = new DefaultRedisScript<>(
            """
            local key   = KEYS[1]
            local token = ARGV[1]
            local existing = redis.call('GET', key)
            if not existing then return 0 end
            local ok, data = pcall(cjson.decode, existing)
            if ok and data['sessionToken'] == token then
              redis.call('DEL', key)
              return 1
            end
            return 0
            """,
            Long.class
    );

    public record LockResult(boolean acquired, String holderUserId, Instant expiresAt) {}

    public record LockHolder(String userId, String sessionToken) {}

    public LockResult acquireOrRenew(
            String prefix, String id,
            String userId, String sessionToken,
            long ttlSeconds, boolean force) {

        String key = prefix + ":" + id;
        String value = toJson(new LockHolder(userId, sessionToken));
        long ttlMs = ttlSeconds * 1000;

        List<?> result = redisTemplate.execute(
                ACQUIRE_SCRIPT,
                List.of(key),
                userId, sessionToken, String.valueOf(ttlMs),
                force ? "1" : "0", value);

        if (result == null || result.isEmpty()) {
            return new LockResult(false, null, null);
        }
        boolean acquired = toLong(result.get(0)) == 1L;
        String holder = result.size() > 1 ? String.valueOf(result.get(1)) : userId;
        long remainingMs = result.size() > 2 ? toLong(result.get(2)) : ttlMs;
        Instant expiresAt = remainingMs > 0
                ? Instant.now().plusMillis(remainingMs)
                : Instant.now().plusMillis(ttlMs);
        return new LockResult(acquired, acquired ? userId : holder, expiresAt);
    }

    public void release(String prefix, String id, String sessionToken) {
        redisTemplate.execute(RELEASE_SCRIPT, List.of(prefix + ":" + id), sessionToken);
    }

    public boolean isHeldBy(String prefix, String id, String sessionToken) {
        String val = redisTemplate.opsForValue().get(prefix + ":" + id);
        if (val == null) return false;
        try {
            LockHolder holder = objectMapper.readValue(val, LockHolder.class);
            return sessionToken.equals(holder.sessionToken());
        } catch (Exception e) {
            return false;
        }
    }

    public Optional<LockHolder> holder(String prefix, String id) {
        String val = redisTemplate.opsForValue().get(prefix + ":" + id);
        if (val == null) return Optional.empty();
        try {
            return Optional.of(objectMapper.readValue(val, LockHolder.class));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize lock value", e);
        }
    }

    // Xóa khóa vô điều kiện — dùng sau khi publish/discard để giải phóng khóa mà không cần token.
    public void forceDelete(String prefix, String id) {
        redisTemplate.delete(prefix + ":" + id);
    }

    private long toLong(Object o) {
        if (o instanceof Long l) return l;
        if (o instanceof Number n) return n.longValue();
        return 0L;
    }
}
