package pl.co.lms;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@SpringBootApplication(scanBasePackages = {"pl.co.lms", "base.co.common"})
public class RepoLmsApplication {
    public static void main(String[] args) {
        SpringApplication.run(RepoLmsApplication.class, args);
    }
}
