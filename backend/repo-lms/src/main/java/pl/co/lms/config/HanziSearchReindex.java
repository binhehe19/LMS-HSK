package pl.co.lms.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import pl.co.lms.entity.LearningResource;
import pl.co.lms.entity.LearningResourceType;
import pl.co.lms.entity.ResourceSubTypes;
import pl.co.lms.repository.LearningResourceRepository;
import pl.co.lms.service.LearningResourceService;

import java.util.List;

@Slf4j
@Component
@Profile("reindex-hanzi-search")
@RequiredArgsConstructor
public class HanziSearchReindex implements CommandLineRunner {
    private static final PageRequest BATCH = PageRequest.of(0, 200);

    private final LearningResourceRepository resources;
    private final LearningResourceService resourceService;
    private final TransactionTemplate transactions;

    @Override
    public void run(String... args) {
        String lastId = "";
        long total = 0;
        while (true) {
            String afterId = lastId;
            List<String> ids = transactions.execute(status -> {
                var batch = resources.findByTypeAndSubTypeAndDeletedFalseAndIdGreaterThanOrderByIdAsc(
                        LearningResourceType.VOCABULARY, ResourceSubTypes.ZH, afterId, BATCH);
                batch.forEach(resourceService::refreshSearchColumns);
                return batch.stream().map(LearningResource::getId).toList();
            });
            if (ids.isEmpty()) break;
            lastId = ids.getLast();
            total += ids.size();
        }
        log.info("Rebuilt Hanzi search columns for {} resources", total);
    }
}
