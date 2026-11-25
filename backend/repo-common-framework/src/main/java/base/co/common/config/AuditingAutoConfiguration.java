package base.co.common.config;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.data.jpa.JpaRepositoriesAutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.data.domain.AuditorAware;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;
import org.springframework.data.jpa.mapping.JpaMetamodelMappingContext;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import base.co.common.filter.principal.AuthPrincipal;
import base.co.common.filter.principal.ServicePrincipal;

import java.util.Optional;

@AutoConfiguration(after = {HibernateJpaAutoConfiguration.class, JpaRepositoriesAutoConfiguration.class})
@EnableJpaAuditing
@ConditionalOnClass({AuditingEntityListener.class, JpaMetamodelMappingContext.class})
@ConditionalOnBean(JpaMetamodelMappingContext.class)
public class AuditingAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(AuditorAware.class)
    public AuditorAware<String> auditorAware() {
        return () -> {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication == null || !authentication.isAuthenticated()) {
                return Optional.empty();
            }
            Object principal = authentication.getPrincipal();
            if (principal instanceof AuthPrincipal authPrincipal) {
                return Optional.ofNullable(authPrincipal.userId());
            }
            if (principal instanceof ServicePrincipal servicePrincipal) {
                return Optional.ofNullable(servicePrincipal.serviceName());
            }
            if (principal instanceof String value && !"anonymousUser".equals(value)) {
                return Optional.of(value);
            }
            return Optional.empty();
        };
    }
}
