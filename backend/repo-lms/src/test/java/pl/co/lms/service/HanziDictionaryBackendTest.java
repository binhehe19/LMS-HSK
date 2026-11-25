package pl.co.lms.service;

import base.co.common.exception.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManagerFactory;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.SharedEntityManagerCreator;
import org.springframework.orm.jpa.persistenceunit.PersistenceManagedTypes;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.springframework.transaction.support.TransactionTemplate;
import pl.co.lms.config.HanziSearchReindex;
import pl.co.lms.dto.request.CreateLearningResourceRequest;
import pl.co.lms.dto.request.BulkCreateLearningResourcesRequest;
import pl.co.lms.dto.request.BulkCreateLearningResourcesRequest.ExistingPolicy;
import pl.co.lms.dto.response.BulkCreateLearningResourcesResponse;
import pl.co.lms.dto.response.DictionaryWordResponse;
import pl.co.lms.entity.LearningResource;
import pl.co.lms.entity.LearningResourceType;
import pl.co.lms.entity.LearningResourceVersion;
import pl.co.lms.entity.json.VocabularyZhContent;
import pl.co.lms.entity.json.VocabularyZhContent.DictionaryMeaningItem;
import pl.co.lms.entity.json.VocabularyZhContent.DictionaryPinyinItem;
import pl.co.lms.repository.ContentPackageVersionResourceRepository;
import pl.co.lms.repository.LearningResourceRepository;
import pl.co.lms.repository.LearningResourceVersionRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

/** Từ điển Hán tự (màn /vocabulary) trên backend có sẵn: tạo hàng loạt, tìm kiếm, chi tiết — service/transaction/repository thật trên H2 cô lập. */
class HanziDictionaryBackendTest {
    static EntityManagerFactory emf;
    static TransactionTemplate transaction;
    static LearningResourceService catalog;
    static LearningResourceRepository resources;
    static ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();

    @BeforeAll
    static void setup() {
        var bean = new LocalContainerEntityManagerFactoryBean();
        bean.setDataSource(new DriverManagerDataSource("jdbc:h2:mem:hanzi;MODE=PostgreSQL;DB_CLOSE_DELAY=-1", "sa", ""));
        bean.setManagedTypes(PersistenceManagedTypes.of(LearningResource.class.getName(), LearningResourceVersion.class.getName()));
        bean.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
        bean.setJpaPropertyMap(Map.of("hibernate.hbm2ddl.auto", "create-drop",
                "hibernate.physical_naming_strategy", "org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy"));
        bean.afterPropertiesSet();
        emf = bean.getObject();
        var tx = new JpaTransactionManager(emf);
        transaction = new TransactionTemplate(tx);
        var factory = new JpaRepositoryFactory(SharedEntityManagerCreator.createSharedEntityManager(emf));
        resources = factory.getRepository(LearningResourceRepository.class);
        var versions = factory.getRepository(LearningResourceVersionRepository.class);
        catalog = proxy(new LearningResourceService(resources, versions, mock(ContentPackageVersionResourceRepository.class), mapper), tx);
    }

    @SuppressWarnings("unchecked")
    private static <T> T proxy(T value, JpaTransactionManager tx) {
        var factory = new ProxyFactory(value);
        factory.setProxyTargetClass(true);
        factory.addAdvice(new TransactionInterceptor(tx, new AnnotationTransactionAttributeSource()));
        return (T) factory.getProxy();
    }

    @BeforeEach
    void clear() {
        transaction.executeWithoutResult(s -> {
            var em = SharedEntityManagerCreator.createSharedEntityManager(emf);
            em.createNativeQuery("delete from learning_resource_tags").executeUpdate();
            em.createQuery("delete from LearningResourceVersion").executeUpdate();
            em.createQuery("delete from LearningResource").executeUpdate();
        });
    }

    // ---- dữ liệu mẫu theo đúng hình dạng dịch vụ từ điển cũ ----

    static VocabularyZhContent word(String hanzi, Integer hsk, String radical, String... pinyinTypeMeaning) {
        List<DictionaryPinyinItem> pinyins = new ArrayList<>();
        for (int i = 0; i + 2 < pinyinTypeMeaning.length; i += 3) {
            pinyins.add(DictionaryPinyinItem.builder().pinyin(pinyinTypeMeaning[i]).wordTypes(pinyinTypeMeaning[i + 1]).isPrimary(i == 0)
                    .meanings(new ArrayList<>(List.of(DictionaryMeaningItem.builder().meaningVi(pinyinTypeMeaning[i + 2])
                            .examples(List.of(VocabularyZhContent.DictionaryExampleItem.builder().zh("我" + hanzi).build())).build()))).build());
        }
        return VocabularyZhContent.builder().word(hanzi).hskLevel(hsk).radical(radical)
                .isSingleVocab(hanzi.length() == 1).pinyins(pinyins).build();
    }

    static BulkCreateLearningResourcesRequest.Item item(VocabularyZhContent content) {
        return new BulkCreateLearningResourcesRequest.Item(content, null);
    }

    /** Chờ sang mili giây mới: ULID chỉ tăng theo thời điểm tạo khi hai lần tạo khác mili giây. */
    static void nextMillisecond() {
        long now = System.currentTimeMillis();
        while (System.currentTimeMillis() == now) Thread.onSpinWait();
    }

    static BulkCreateLearningResourcesResponse bulk(boolean publish, ExistingPolicy policy, List<BulkCreateLearningResourcesRequest.Item> items) {
        return catalog.bulkCreateLibraryResources(new BulkCreateLearningResourcesRequest(LearningResourceType.VOCABULARY, items, publish, policy));
    }

    /** Danh sách từ điển xếp theo id; từ tạo lần lượt nên thứ tự là 一, 上, 好, 好人, 人, 学校. */
    void seed() {
        for (var content : List.of(
                word("一", 1, "NHẤT 一", "yī", "Số từ,Phó từ", "một; số một"),
                word("上", 1, "NHẤT 一", "shàng", "Danh từ", "trên; phía trên"),
                word("好", 1, "NỮ 女", "hǎo", "Tính từ", "tốt; hay", "hào", "Động từ", "thích"),
                word("好人", 3, null, "hǎorén", "Danh từ", "người tốt"),
                word("人", 1, "NHÂN 人", "rén", "Danh từ", "người"),
                word("学校", 2, null, "xuéxiào", "Danh từ", "trường học"))) {
            nextMillisecond();
            assertThat(bulk(true, ExistingPolicy.SKIP, List.of(item(content))).created()).isEqualTo(1);
        }
        nextMillisecond();
    }

    List<String> hanzi(List<DictionaryWordResponse> items) {
        return items.stream().map(DictionaryWordResponse::hanzi).toList();
    }

    // ---- danh sách học viên ----

    @Test
    void danhSachTheoThuTuIdCuVaPhanTrang() {
        seed();
        var page0 = catalog.searchPublishedDictionaryHanzi(null, null, null, null, null, 0, 4);
        assertThat(hanzi(page0.getItems())).containsExactly("一", "上", "好", "好人");
        assertThat(page0.getTotalElements()).isEqualTo(6);
        assertThat(page0.getTotalPages()).isEqualTo(2);
        assertThat(hanzi(catalog.searchPublishedDictionaryHanzi(null, null, null, null, null, 1, 4).getItems())).containsExactly("人", "学校");
    }

    @Test
    void tuKhoaKhopHanTuVaPhienAmKhongDau() {
        seed();
        assertThat(hanzi(catalog.searchPublishedDictionaryHanzi("好", null, null, null, null, 0, 20).getItems())).containsExactly("好", "好人");
        // "ren" khớp phiên âm hǎorén và rén.
        assertThat(hanzi(catalog.searchPublishedDictionaryHanzi("ren", null, null, null, null, 0, 20).getItems())).containsExactly("好人", "人");
        assertThat(hanzi(catalog.searchPublishedDictionaryHanzi("rén", null, null, null, null, 0, 20).getItems())).containsExactly("好人", "人");
        assertThat(hanzi(catalog.searchPublishedDictionaryHanzi("xuexiao", null, null, null, null, 0, 20).getItems())).containsExactly("学校");
        assertThat(catalog.searchPublishedDictionaryHanzi("Trường Học", null, null, null, null, 0, 20).getItems()).isEmpty();
        // từ loại không còn nằm trong cột tìm kiếm (lọc riêng): gõ "danh tu" không ra cả từ điển
        assertThat(catalog.searchPublishedDictionaryHanzi("danh tu", null, null, null, null, 0, 20).getItems()).isEmpty();
        // ký tự đặc biệt của LIKE được thoát
        assertThat(catalog.searchPublishedDictionaryHanzi("%", null, null, null, null, 0, 20).getItems()).isEmpty();
    }

    @Test
    void reindexRemovesOldMeaningMatchesAndKeepsPinyin() {
        seed();
        var entries = catalog.searchDictionaryHanzi("好", 1, null, null, null, 0, 20).getItems();
        String id = entries.getFirst().id();
        transaction.executeWithoutResult(status -> {
            var existing = resources.findById(id).orElseThrow();
            existing.setSearchText("hao 口语 legacymeaning");
            resources.save(existing);
        });
        assertThat(catalog.searchDictionaryHanzi("口", null, null, null, null, 0, 20).getItems()).isEmpty();
        assertThat(hanzi(catalog.searchDictionaryHanzi("legacymeaning", null, null, null, null, 0, 20).getItems()))
                .containsExactly("好");

        new HanziSearchReindex(resources, catalog, transaction).run();

        assertThat(catalog.searchDictionaryHanzi("legacymeaning", null, null, null, null, 0, 20).getItems()).isEmpty();
        assertThat(catalog.searchDictionaryHanzi("口", null, null, null, null, 0, 20).getItems()).isEmpty();
        assertThat(hanzi(catalog.searchDictionaryHanzi("hao", 1, null, null, null, 0, 20).getItems()))
                .containsExactly("好");
    }

    @Test
    void exactHanziRanksBeforeSubstringAcrossPages() {
        seed();
        var firstPage = catalog.searchDictionaryHanzi("人", null, null, null, null, 0, 1);
        assertThat(hanzi(firstPage.getItems())).containsExactly("人");
        assertThat(firstPage.getTotalElements()).isEqualTo(2);
        assertThat(hanzi(catalog.searchDictionaryHanzi("人", null, null, null, null, 1, 1).getItems()))
                .containsExactly("好人");
    }

    @Test
    void tuKhoaKhopBoThuVaNoiDungTrongCungTrangKetQua() {
        seed();
        var firstPage = catalog.searchPublishedDictionaryHanzi("一", null, null, null, null, 0, 1);
        assertThat(hanzi(firstPage.getItems())).containsExactly("一");
        assertThat(firstPage.getTotalElements()).isEqualTo(2);
        assertThat(firstPage.getTotalPages()).isEqualTo(2);
        assertThat(hanzi(catalog.searchPublishedDictionaryHanzi("一", null, null, null, null, 1, 1).getItems()))
                .containsExactly("上");
        assertThat(hanzi(catalog.searchDictionaryHanzi("女", 1, null, null, null, 0, 20).getItems()))
                .containsExactly("好");
    }

    @Test
    void locCapHskBoThuTuLoaiTuDon() {
        seed();
        assertThat(hanzi(catalog.searchPublishedDictionaryHanzi(null, 2, null, null, null, 0, 20).getItems())).containsExactly("学校");
        // bộ thủ: nhận ký tự hoặc định dạng DB cũ "NHẤT 一"
        assertThat(hanzi(catalog.searchPublishedDictionaryHanzi(null, null, null, null, "一", 0, 20).getItems())).containsExactly("一", "上");
        assertThat(hanzi(catalog.searchPublishedDictionaryHanzi(null, null, null, null, "NHẤT 一", 0, 20).getItems())).containsExactly("一", "上");
        // từ loại: so trọn mục ở mọi phiên âm (好 có "Động từ" ở phiên âm phụ)
        assertThat(hanzi(catalog.searchPublishedDictionaryHanzi(null, null, null, "Động từ", null, 0, 20).getItems())).containsExactly("好");
        assertThat(hanzi(catalog.searchPublishedDictionaryHanzi(null, null, null, "Phó từ", null, 0, 20).getItems())).containsExactly("一");
        assertThat(hanzi(catalog.searchPublishedDictionaryHanzi(null, null, false, null, null, 0, 20).getItems())).containsExactly("好人", "学校");
        assertThat(hanzi(catalog.searchPublishedDictionaryHanzi("hao", 1, true, null, null, 0, 20).getItems())).containsExactly("好");
    }

    @Test
    void hocVienChiThayTuDaXuatBanAdminThayCaBanNhap() {
        seed();
        var draft = bulk(false, ExistingPolicy.SKIP, List.of(item(word("书", 1, "QUYẾT 亅", "shū", "Danh từ", "sách"))));
        assertThat(draft.created()).isEqualTo(1);
        assertThat(hanzi(catalog.searchPublishedDictionaryHanzi("shu", null, null, null, null, 0, 20).getItems())).isEmpty();
        var admin = catalog.searchDictionaryHanzi("shu", null, null, null, null, 0, 20);
        assertThat(hanzi(admin.getItems())).containsExactly("书");
        assertThat(admin.getItems().get(0).status()).isEqualTo("draft");
        String id = admin.getItems().get(0).id();
        assertThatThrownBy(() -> catalog.getPublishedDictionaryHanzi(id)).isInstanceOf(ApiException.class);
    }

    // ---- chi tiết ----

    @Test
    void chiTietCoChuThanhPhanTraTheoTuDon() {
        seed();
        String id = catalog.searchPublishedDictionaryHanzi("好人", null, null, null, null, 0, 1).getItems().get(0).id();
        var detail = catalog.getPublishedDictionaryHanzi(id);
        assertThat(detail.hanzi()).isEqualTo("好人");
        assertThat(detail.components()).extracting(c -> c.hanzi() + "|" + c.pinyin() + "|" + c.meaning())
                .containsExactly("好|hǎo|tốt; hay", "人|rén|người");
        assertThat(detail.components()).allSatisfy(c -> assertThat(c.id()).isNotNull());
        // chữ chưa có trong từ điển vẫn được trả, không có id
        String school = catalog.searchPublishedDictionaryHanzi("学校", null, null, null, null, 0, 1).getItems().get(0).id();
        assertThat(catalog.getPublishedDictionaryHanzi(school).components()).extracting(c -> c.hanzi() + ":" + c.id())
                .containsExactly("学:null", "校:null");
        // từ đơn: không có thành phần (màn hình hiện bộ thủ)
        String one = catalog.searchPublishedDictionaryHanzi("一", null, null, null, null, 0, 1).getItems().get(0).id();
        assertThat(catalog.getPublishedDictionaryHanzi(one).components()).isEmpty();
        assertThatThrownBy(() -> catalog.getPublishedDictionaryHanzi("khong-co")).isInstanceOf(ApiException.class);
    }

    // ---- nhập từ hệ cũ qua POST /learning-resources/bulk ----

    @Test
    void nhapLaiSauKhiSuaVaXuatBanKhongTaoTrung() {
        seed();
        String id = catalog.searchPublishedDictionaryHanzi("一", null, null, null, null, 0, 10).getItems().get(0).id();
        var edited = word("一", 1, "NHẤT 一", "yī", "Số từ", "số một");
        edited.setEtymologyStory("Gốc chữ");
        edited.setEtymologyStoryHtml("<p><strong>Gốc chữ</strong></p>");
        edited.setNotes("Ghi chú");
        edited.setNotesHtml("<p><em>Ghi chú</em></p>");
        edited.getPinyins().get(0).setAudioUrl("/api/storage/file/yi");
        var meaning = edited.getPinyins().get(0).getMeanings().get(0);
        meaning.setMeaningEn("one");
        meaning.setMeaningZh("最小的正整数");
        meaning.setMeaningViHtml("<p><strong>số một</strong></p>");
        meaning.setExamples(List.of(VocabularyZhContent.DictionaryExampleItem.builder().zh("一个").zhHtml("<p><em>一个</em></p>").build()));
        var version = catalog.createDraftVersion(id, edited);
        catalog.publishVersion(id, version.getId());
        var detail = catalog.getPublishedDictionaryHanzi(id);
        assertThat(detail.etymologyStoryHtml()).isEqualTo("<p><strong>Gốc chữ</strong></p>");
        assertThat(detail.notesHtml()).isEqualTo("<p><em>Ghi chú</em></p>");
        var reading = detail.pinyins().get(0);
        assertThat(reading.getAudioUrl()).isEqualTo("/api/storage/file/yi");
        var saved = reading.getMeanings().get(0);
        assertThat(saved).extracting("meaningEn", "meaningVi", "meaningZh").containsExactly("one", "số một", "最小的正整数");
        assertThat(saved.getMeaningViHtml()).isEqualTo("<p><strong>số một</strong></p>");
        assertThat(saved.getExamples().get(0).getZhHtml()).isEqualTo("<p><em>一个</em></p>");

        var again = bulk(true, ExistingPolicy.SKIP, List.of(
                item(word("一", 1, "NHẤT 一", "yī", "Số từ,Phó từ", "một; số một")),
                item(word("上", 2, "NHẤT 一", "shàng", "Danh từ", "trên; phía trên"))));
        assertThat(again).extracting("created", "skipped").containsExactly(0, 2);
        assertThat(resources.count()).isEqualTo(6);

        var overwrite = bulk(true, ExistingPolicy.OVERWRITE, List.of(item(word("上", 2, "NHẤT 一", "shàng", "Danh từ", "trên; phía trên"))));
        assertThat(overwrite).extracting("created", "overwritten").containsExactly(0, 1);
        assertThat(resources.count()).isEqualTo(6);
        assertThat(hanzi(catalog.searchPublishedDictionaryHanzi(null, 2, null, null, null, 0, 20).getItems())).containsExactly("上", "学校");
    }

    @Test
    void cungHanTuTrongMotLoBiGopTheoChu() {
        var first = item(word("行", 2, null, "xíng", "Động từ", "đi"));
        var second = item(word("行", 2, null, "háng", "Danh từ", "hàng"));
        var res = bulk(true, ExistingPolicy.SKIP, List.of(first, second));
        assertThat(res.created()).isEqualTo(1);
        assertThat(res.skipped()).isEqualTo(1);
        assertThat(bulk(true, ExistingPolicy.SKIP, List.of(first, second)).skipped()).isEqualTo(2);
    }

    @Test
    void validateCoSanBaoLoiTungMucVaLapTrongLo() {
        VocabularyZhContent noPinyin = VocabularyZhContent.builder().word("良好").hskLevel(5).pinyins(new ArrayList<>()).build();
        var res = bulk(true, ExistingPolicy.SKIP, List.of(
                item(word("大", 1, "ĐẠI 大", "dà", "Tính từ", "to; lớn")),
                item(noPinyin),
                item(VocabularyZhContent.builder().word("  ").build()),
                item(word("大", 1, null, "dà", "Tính từ", "to")),
                new BulkCreateLearningResourcesRequest.Item(word("小", 1, null, "xiǎo", "Tính từ", "nhỏ"), null)));
        assertThat(res.results()).extracting(r -> r.index() + ":" + r.status()).containsExactly(
                "0:CREATED", "1:FAILED", "2:FAILED", "3:SKIPPED", "4:CREATED");
    }

    @Test
    void motNghiaCoNhieuViDuViDuRongVaKhoaViDuCuBiTuChoi() {
        VocabularyZhContent many = word("好", 1, "NỮ 女", "hǎo", "Tính từ", "tốt");
        many.getPinyins().get(0).getMeanings().get(0).setExamples(List.of(
                VocabularyZhContent.DictionaryExampleItem.builder().zh("很好。").pinyin("Hěn hǎo.").vi("Rất tốt.").build(),
                VocabularyZhContent.DictionaryExampleItem.builder().zh("好人").build()));
        VocabularyZhContent blankExample = word("坏", 1, null, "huài", "Tính từ", "xấu");
        blankExample.getPinyins().get(0).getMeanings().get(0).setExamples(List.of(new VocabularyZhContent.DictionaryExampleItem()));
        // Khóa ví dụ phẳng của cấu trúc cũ không còn là trường hợp lệ.
        var legacy = java.util.Map.of("word", "小", "pinyins", List.of(java.util.Map.of("pinyin", "xiǎo", "isPrimary", true,
                "meanings", List.of(java.util.Map.of("meaningVi", "nhỏ", "exampleSentenceZh", "很小")))));

        var res = bulk(true, ExistingPolicy.SKIP, List.of(item(many), item(blankExample), new BulkCreateLearningResourcesRequest.Item(legacy, null)));

        assertThat(res.results()).extracting(r -> r.index() + ":" + r.status()).containsExactly("0:CREATED", "1:FAILED", "2:FAILED");
        assertThat(res.results().get(2).message()).contains("exampleSentenceZh");
        var stored = catalog.searchPublishedDictionaryHanzi(null, null, null, null, null, 0, 20).getItems();
        assertThat(stored).hasSize(1);
        assertThat(stored.get(0).pinyins().get(0).getMeanings().get(0).getExamples()).extracting(e -> e.getZh()).containsExactly("很好。", "好人");
    }

    @Test
    void tuTaoTuManQuanLyVanLocDuocVaXepSauTheoId() {
        seed();
        catalog.createResourceWithContent(new CreateLearningResourceRequest(LearningResourceType.VOCABULARY,
                word("水", 1, "THỦY 水", "shuǐ", "Danh từ", "nước"), true, true));
        assertThat(hanzi(catalog.searchPublishedDictionaryHanzi(null, 1, null, "Danh từ", "水", 0, 20).getItems())).containsExactly("水");
        assertThat(hanzi(catalog.searchPublishedDictionaryHanzi(null, null, null, null, null, 0, 20).getItems()))
                .containsExactly("一", "上", "好", "好人", "人", "学校", "水");
    }
}
