package pl.co.lms.config;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.jsontype.impl.LaissezFaireSubTypeValidator;
import org.springframework.boot.autoconfigure.cache.RedisCacheManagerBuilderCustomizer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext.SerializationPair;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;

@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public RedisCacheConfiguration defaultCacheConfiguration(ObjectMapper objectMapper) {
        ObjectMapper cacheObjectMapper = objectMapper.copy();
        cacheObjectMapper.activateDefaultTyping(
                LaissezFaireSubTypeValidator.instance,
                ObjectMapper.DefaultTyping.NON_FINAL,
                JsonTypeInfo.As.PROPERTY
        );

        return RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofMinutes(15))
                .disableCachingNullValues()
                .serializeKeysWith(SerializationPair.fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(SerializationPair.fromSerializer(new GenericJackson2JsonRedisSerializer(cacheObjectMapper)));
    }

    @Bean
    public RedisCacheManagerBuilderCustomizer redisCacheManagerBuilderCustomizer(
            RedisCacheConfiguration defaultCacheConfiguration) {
        return builder -> builder
                // Syllabus version is immutable in ERP: cache for 2 hours
                .withCacheConfiguration("cms-syllabus-version",
                        defaultCacheConfiguration.entryTtl(Duration.ofHours(2)))
                // Dropdown lists: cache for 15 minutes
                .withCacheConfiguration("cms-syllabus-list",
                        defaultCacheConfiguration.entryTtl(Duration.ofMinutes(15)))
                // Trang giáo trình theo (cấp độ, loại, trang, cỡ trang): TTL ngắn vì admin thêm/sửa giáo trình.
                .withCacheConfiguration("cms-syllabus-page",
                        defaultCacheConfiguration.entryTtl(Duration.ofMinutes(5)))
                .withCacheConfiguration("cms-syllabus-filter-options",
                        defaultCacheConfiguration.entryTtl(Duration.ofMinutes(15)))
                .withCacheConfiguration("cms-syllabus-versions-list",
                        defaultCacheConfiguration.entryTtl(Duration.ofMinutes(15)))
                .withCacheConfiguration("cms-syllabus-detail",
                        defaultCacheConfiguration.entryTtl(Duration.ofMinutes(15)))
                // Class and session operational schedules: cache for 15 minutes
                .withCacheConfiguration("cms-class-detail",
                        defaultCacheConfiguration.entryTtl(Duration.ofMinutes(15)))
                .withCacheConfiguration("cms-class-sessions",
                        defaultCacheConfiguration.entryTtl(Duration.ofMinutes(15)))
                // Danh sách lớp filter theo nhiều tổ hợp tham số - TTL ngắn hơn vì trạng
                // thái/giáo viên lớp thay đổi thường xuyên hơn giáo trình.
                .withCacheConfiguration("cms-class-list",
                        defaultCacheConfiguration.entryTtl(Duration.ofMinutes(5)))
                // Danh sách lớp CỦA TỪNG NGƯỜI DÙNG (khoá theo userId): TTL rất ngắn vì việc xếp lớp có thể vừa
                // đổi; nút "Tải lại" ở trang lớp học xoá cache này (CmsClient#evictAllCmsCache).
                .withCacheConfiguration("cms-my-classes",
                        defaultCacheConfiguration.entryTtl(Duration.ofSeconds(45)))
                // Học viên/điểm/điểm danh thay đổi thường xuyên - TTL ngắn.
                .withCacheConfiguration("cms-class-enrollments",
                        defaultCacheConfiguration.entryTtl(Duration.ofMinutes(5)))
                .withCacheConfiguration("cms-class-feedback",
                        defaultCacheConfiguration.entryTtl(Duration.ofMinutes(5)));
    }
}
