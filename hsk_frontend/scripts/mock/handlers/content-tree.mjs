// Kho nội dung HSK GIẢ LẬP dạng cây (Package → Folder → Study set → mục) cho MỌI module dùng nền content-tree: /api/hsk/{flashcard,writing,quiz,grammar,
// pronunciation}. Hợp đồng ĐỀ XUẤT: docs/api-requirements/content-tree.md (client: src/lib/api/content-tree-client.ts). Bảng ánh xạ tiền tố → tên tài
// nguyên mục (`cards`, `words`, `quizzes` (+ `questions`), `grammar-points`, `pronunciation-items`).
// Quyền (mock KHÔNG kiểm ticket): đọc = đã đăng nhập; ghi = ADMIN | TEACHER | MENTOR; publish/unpublish = ADMIN | TEACHER_MANAGER (canPublishContent).
// Dữ liệu trong bộ nhớ, seed theo hồ sơ (`demo`: 2–3 gói/module với nội dung HSK thật; `e2e`: nhỏ, cố định); thao tác ghi THAY ĐỔI dữ liệu; /mock-reset về seed.
import { PROFILE, count, fail, ok, readBody, registerResettable, send, state } from "../core.mjs";

const PREFIX_RE = /^\/api\/hsk\/(flashcard|writing|quiz|grammar|pronunciation)(\/.*)?$/;
const MODULES = {
  flashcard: { itemsPath: "cards", legacyKey: "cards", required: ["term", "meaning"] },
  writing: { itemsPath: "words", legacyKey: "words", required: ["hanzi"] },
  quiz: { itemsPath: "quizzes", legacyKey: "quizzes", required: ["title"], questions: true },
  grammar: { itemsPath: "grammar-points", legacyKey: "grammarPoints", required: ["title"] },
  pronunciation: { itemsPath: "pronunciation-items", legacyKey: "items", required: ["text"] },
};
const WRITE_ROLES = ["ROLE_ADMIN", "ROLE_TEACHER", "ROLE_MENTOR"];
const PUBLISH_ROLES = ["ROLE_ADMIN", "ROLE_TEACHER_MANAGER"];
const DAY = 86_400_000;

// ---------- dữ liệu seed ----------
// Mỗi gói: [name, type, publishStatus, description, folders]; mỗi thư mục: [name, description, sets]; mỗi bộ: [title, description, items, skill?]
const FC = (term, pinyin, meaning, wordType, example, exampleMeaning) => ({ term, pinyin, meaning, wordType, example, exampleMeaning });
const FLASHCARD_DEMO = [
  ["Flashcard HSK 1", "LEARNING_PATH", "PUBLISHED", "Từ vựng HSK 1 theo bài học của giáo trình chuẩn", [
    ["Bài 1–5: Chào hỏi & gia đình", "Từ vựng nhập môn: chào hỏi, giới thiệu, thành viên gia đình", [
      ["Chào hỏi cơ bản", "10 từ vựng chào hỏi đầu tiên", [
        FC("你好", "nǐ hǎo", "xin chào", "thán từ", "你好！我叫李明。", "Xin chào! Tôi tên là Lý Minh."),
        FC("谢谢", "xièxie", "cảm ơn", "động từ", "谢谢你的帮助。", "Cảm ơn sự giúp đỡ của bạn."),
        FC("再见", "zàijiàn", "tạm biệt", "động từ", "明天见，再见！", "Mai gặp, tạm biệt!"),
        FC("不客气", "bú kèqi", "không có gì", "cụm từ", "A：谢谢！B：不客气。", "A: Cảm ơn! B: Không có gì."),
        FC("对不起", "duìbuqǐ", "xin lỗi", "động từ", "对不起，我来晚了。", "Xin lỗi, tôi đến muộn."),
        FC("请", "qǐng", "mời, xin", "động từ", "请坐。", "Mời ngồi."),
        FC("老师", "lǎoshī", "giáo viên", "danh từ", "王老师教我们汉语。", "Thầy Vương dạy chúng tôi tiếng Trung."),
        FC("学生", "xuésheng", "học sinh", "danh từ", "我是学生。", "Tôi là học sinh."),
        FC("朋友", "péngyou", "bạn", "danh từ", "他是我的好朋友。", "Anh ấy là bạn tốt của tôi."),
        FC("名字", "míngzi", "tên", "danh từ", "你叫什么名字？", "Bạn tên là gì?"),
      ]],
      ["Gia đình", "Thành viên trong gia đình", [
        FC("爸爸", "bàba", "bố", "danh từ", "我爸爸是医生。", "Bố tôi là bác sĩ."),
        FC("妈妈", "māma", "mẹ", "danh từ", "妈妈在做饭。", "Mẹ đang nấu cơm."),
        FC("家", "jiā", "nhà, gia đình", "danh từ", "我家有四个人。", "Nhà tôi có bốn người."),
        FC("女儿", "nǚ'ér", "con gái", "danh từ", "她的女儿今年五岁。", "Con gái cô ấy năm nay năm tuổi."),
        FC("儿子", "érzi", "con trai", "danh từ", "我儿子喜欢踢足球。", "Con trai tôi thích đá bóng."),
        FC("哥哥", "gēge", "anh trai", "danh từ", "我哥哥在北京工作。", "Anh tôi làm việc ở Bắc Kinh."),
        FC("姐姐", "jiějie", "chị gái", "danh từ", "姐姐很漂亮。", "Chị gái rất đẹp."),
        FC("人", "rén", "người", "danh từ", "教室里有二十个人。", "Trong lớp có hai mươi người."),
      ]],
      ["Số đếm & thời gian", "Số, giờ, ngày tháng", [
        FC("一", "yī", "một", "số từ", "我有一个妹妹。", "Tôi có một em gái."),
        FC("二", "èr", "hai", "số từ", "二加二等于四。", "Hai cộng hai bằng bốn."),
        FC("三", "sān", "ba", "số từ", "三个人", "Ba người."),
        FC("今天", "jīntiān", "hôm nay", "danh từ", "今天是星期一。", "Hôm nay là thứ hai."),
        FC("明天", "míngtiān", "ngày mai", "danh từ", "明天我们去学校。", "Mai chúng tôi đến trường."),
        FC("昨天", "zuótiān", "hôm qua", "danh từ", "昨天下雨了。", "Hôm qua trời mưa."),
        FC("现在", "xiànzài", "bây giờ", "danh từ", "现在几点？", "Bây giờ mấy giờ?"),
        FC("点", "diǎn", "giờ", "lượng từ", "现在三点。", "Bây giờ ba giờ."),
        FC("星期", "xīngqī", "tuần, thứ", "danh từ", "星期天我不上班。", "Chủ nhật tôi không đi làm."),
        FC("月", "yuè", "tháng", "danh từ", "十月一日", "Ngày 1 tháng 10."),
      ]],
    ]],
    ["Bài 6–10: Trường học & công việc", "Từ vựng về học tập và nghề nghiệp", [
      ["Học tập", "Từ vựng lớp học", [
        FC("学校", "xuéxiào", "trường học", "danh từ", "我们的学校很大。", "Trường chúng tôi rất lớn."),
        FC("汉语", "Hànyǔ", "tiếng Trung", "danh từ", "我学习汉语。", "Tôi học tiếng Trung."),
        FC("书", "shū", "sách", "danh từ", "这是我的书。", "Đây là sách của tôi."),
        FC("读", "dú", "đọc", "động từ", "请读课文。", "Mời đọc bài khoá."),
        FC("写", "xiě", "viết", "động từ", "我会写汉字。", "Tôi biết viết chữ Hán."),
        FC("听", "tīng", "nghe", "động từ", "听老师说。", "Nghe thầy nói."),
        FC("说", "shuō", "nói", "động từ", "他说汉语说得很好。", "Anh ấy nói tiếng Trung rất tốt."),
        FC("学习", "xuéxí", "học", "động từ", "我每天学习两个小时。", "Mỗi ngày tôi học hai tiếng."),
        FC("字", "zì", "chữ", "danh từ", "这个字怎么读？", "Chữ này đọc thế nào?"),
      ]],
      ["Công việc & nghề nghiệp", "Nghề nghiệp, nơi làm việc", [
        FC("医生", "yīshēng", "bác sĩ", "danh từ", "他是医生。", "Anh ấy là bác sĩ."),
        FC("工作", "gōngzuò", "công việc; làm việc", "danh từ/động từ", "你在哪儿工作？", "Bạn làm việc ở đâu?"),
        FC("医院", "yīyuàn", "bệnh viện", "danh từ", "医院在学校旁边。", "Bệnh viện ở cạnh trường."),
        FC("商店", "shāngdiàn", "cửa hàng", "danh từ", "商店几点开门？", "Cửa hàng mấy giờ mở cửa?"),
        FC("钱", "qián", "tiền", "danh từ", "这个多少钱？", "Cái này bao nhiêu tiền?"),
        FC("买", "mǎi", "mua", "động từ", "我想买一本书。", "Tôi muốn mua một quyển sách."),
        FC("电脑", "diànnǎo", "máy tính", "danh từ", "我用电脑工作。", "Tôi dùng máy tính để làm việc."),
        FC("做", "zuò", "làm", "động từ", "你在做什么？", "Bạn đang làm gì?"),
      ]],
    ]],
  ]],
  ["Từ vựng HSK 2 theo chủ đề", "FREE", "PUBLISHED", "Bộ từ vựng miễn phí HSK 2 chia theo chủ đề sinh hoạt", [
    ["Thời gian & sinh hoạt", "Hoạt động hằng ngày", [
      ["Sinh hoạt hằng ngày", "Động từ sinh hoạt", [
        FC("起床", "qǐchuáng", "thức dậy", "động từ", "我每天六点起床。", "Mỗi ngày tôi thức dậy lúc sáu giờ."),
        FC("洗", "xǐ", "rửa, giặt", "động từ", "我在洗衣服。", "Tôi đang giặt quần áo."),
        FC("穿", "chuān", "mặc, đi (giày)", "động từ", "今天很冷，多穿衣服。", "Hôm nay lạnh, mặc thêm áo."),
        FC("跑步", "pǎobù", "chạy bộ", "động từ", "他喜欢早上跑步。", "Anh ấy thích chạy bộ buổi sáng."),
        FC("休息", "xiūxi", "nghỉ ngơi", "động từ", "我们休息一下吧。", "Chúng ta nghỉ một chút nhé."),
        FC("睡觉", "shuìjiào", "ngủ", "động từ", "我十一点睡觉。", "Tôi ngủ lúc mười một giờ."),
        FC("早上", "zǎoshang", "buổi sáng", "danh từ", "早上好！", "Chào buổi sáng!"),
        FC("晚上", "wǎnshang", "buổi tối", "danh từ", "晚上我在家看书。", "Buổi tối tôi ở nhà đọc sách."),
        FC("每天", "měitiān", "mỗi ngày", "đại từ", "我每天都学汉语。", "Mỗi ngày tôi đều học tiếng Trung."),
        FC("已经", "yǐjīng", "đã", "phó từ", "他已经走了。", "Anh ấy đã đi rồi."),
      ]],
    ]],
    ["Du lịch & mua sắm", "Đi lại và mua bán", [
      ["Du lịch", "Phương tiện, địa điểm", [
        FC("旅游", "lǚyóu", "du lịch", "động từ", "我想去中国旅游。", "Tôi muốn đi du lịch Trung Quốc."),
        FC("火车站", "huǒchēzhàn", "ga tàu", "danh từ", "火车站离这儿远吗？", "Ga tàu cách đây xa không?"),
        FC("机场", "jīchǎng", "sân bay", "danh từ", "我们去机场接朋友。", "Chúng tôi ra sân bay đón bạn."),
        FC("票", "piào", "vé", "danh từ", "我买了两张票。", "Tôi đã mua hai vé."),
        FC("宾馆", "bīnguǎn", "khách sạn", "danh từ", "宾馆的房间很干净。", "Phòng khách sạn rất sạch."),
        FC("左边", "zuǒbian", "bên trái", "danh từ", "商店在左边。", "Cửa hàng ở bên trái."),
        FC("右边", "yòubian", "bên phải", "danh từ", "往右边走。", "Đi về bên phải."),
        FC("远", "yuǎn", "xa", "hình dung từ", "学校离我家不远。", "Trường cách nhà tôi không xa."),
        FC("近", "jìn", "gần", "hình dung từ", "医院很近。", "Bệnh viện rất gần."),
      ]],
      ["Mua sắm", "Giá cả, màu sắc, quần áo", [
        FC("便宜", "piányi", "rẻ", "hình dung từ", "这件衣服很便宜。", "Chiếc áo này rất rẻ."),
        FC("贵", "guì", "đắt", "hình dung từ", "太贵了！", "Đắt quá!"),
        FC("颜色", "yánsè", "màu sắc", "danh từ", "你喜欢什么颜色？", "Bạn thích màu gì?"),
        FC("红", "hóng", "đỏ", "hình dung từ", "红色的苹果", "Quả táo màu đỏ."),
        FC("白", "bái", "trắng", "hình dung từ", "白色的衬衫", "Áo sơ mi trắng."),
        FC("黑", "hēi", "đen", "hình dung từ", "黑色的鞋", "Đôi giày đen."),
        FC("衣服", "yīfu", "quần áo", "danh từ", "我要买新衣服。", "Tôi muốn mua quần áo mới."),
        FC("卖", "mài", "bán", "động từ", "这儿卖水果。", "Ở đây bán trái cây."),
      ]],
    ]],
  ]],
  ["HSK 3 — Khóa học video", "VIDEO_COURSE", "DRAFT", "Từ vựng đi kèm khoá học video HSK 3 (đang biên soạn)", [
    ["Chủ đề xã hội", "Môi trường, văn hoá, lịch sử", [
      ["Môi trường & văn hoá", "Từ vựng HSK 3 chủ đề xã hội", [
        FC("环境", "huánjìng", "môi trường", "danh từ", "我们要保护环境。", "Chúng ta phải bảo vệ môi trường."),
        FC("文化", "wénhuà", "văn hoá", "danh từ", "我对中国文化很感兴趣。", "Tôi rất hứng thú với văn hoá Trung Quốc."),
        FC("历史", "lìshǐ", "lịch sử", "danh từ", "北京是一座有历史的城市。", "Bắc Kinh là thành phố có lịch sử."),
        FC("城市", "chéngshì", "thành phố", "danh từ", "这个城市很漂亮。", "Thành phố này rất đẹp."),
        FC("世界", "shìjiè", "thế giới", "danh từ", "世界上有很多国家。", "Trên thế giới có rất nhiều quốc gia."),
        FC("节日", "jiérì", "ngày lễ", "danh từ", "春节是中国最重要的节日。", "Tết Nguyên đán là ngày lễ quan trọng nhất của Trung Quốc."),
        FC("习惯", "xíguàn", "thói quen; quen", "danh từ/động từ", "我已经习惯这里的生活了。", "Tôi đã quen với cuộc sống ở đây."),
        FC("经常", "jīngcháng", "thường xuyên", "phó từ", "他经常去图书馆。", "Anh ấy thường xuyên đến thư viện."),
        FC("影响", "yǐngxiǎng", "ảnh hưởng", "động từ/danh từ", "天气影响了我的心情。", "Thời tiết ảnh hưởng tâm trạng của tôi."),
      ]],
    ]],
  ]],
];

// Chữ Hán HSK 1–3 thật (số nét/bộ thủ theo tự điển Tân Hoa; Hán Việt + ví dụ ngắn) — trường theo src/types/content-writing.ts (W2-E).
const HZ = (hanzi, pinyin, meaning, strokeCount, radical, sinoVn, example, exampleMeaning) => ({ hanzi, pinyin, meaning, strokeCount, radical, sinoVn, example, exampleMeaning });
const WRITING_DEMO = [
  ["Luyện viết Hán tự HSK 1", "LEARNING_PATH", "PUBLISHED", "Thứ tự nét và bộ thủ cho người mới", [
    ["Bộ thủ cơ bản", "Những bộ thủ xuất hiện nhiều nhất", [
      ["Bộ thủ 1–10", "Chữ đơn làm bộ thủ", [
        HZ("人", "rén", "người", 2, "人", "nhân", "三个人", "ba người"),
        HZ("口", "kǒu", "miệng; cửa", 3, "口", "khẩu", "一口水", "một ngụm nước"),
        HZ("日", "rì", "mặt trời, ngày", 4, "日", "nhật", "今日", "hôm nay"),
        HZ("月", "yuè", "mặt trăng, tháng", 4, "月", "nguyệt", "一个月", "một tháng"),
        HZ("山", "shān", "núi", 3, "山", "sơn", "上山", "lên núi"),
        HZ("水", "shuǐ", "nước", 4, "水", "thủy", "喝水", "uống nước"),
        HZ("火", "huǒ", "lửa", 4, "火", "hỏa", "火车", "xe lửa (tàu hoả)"),
        HZ("木", "mù", "cây, gỗ", 4, "木", "mộc", "木头", "gỗ"),
        HZ("大", "dà", "to, lớn", 3, "大", "đại", "大学", "đại học"),
        HZ("小", "xiǎo", "nhỏ", 3, "小", "tiểu", "小孩", "trẻ nhỏ"),
      ]],
      ["Chữ ghép thường gặp", "Chữ có bộ thủ đã học", [
        HZ("好", "hǎo", "tốt", 6, "女", "hảo", "你好", "xin chào"),
        HZ("妈", "mā", "mẹ", 6, "女", "ma", "妈妈", "mẹ"),
        HZ("们", "men", "(hậu tố số nhiều)", 5, "亻", "môn", "我们", "chúng tôi"),
        HZ("你", "nǐ", "bạn", 7, "亻", "nhĩ", "你好吗？", "Bạn khoẻ không?"),
        HZ("他", "tā", "anh ấy", 5, "亻", "tha", "他是老师。", "Anh ấy là giáo viên."),
        HZ("明", "míng", "sáng; rõ", 8, "日", "minh", "明天", "ngày mai"),
      ]],
    ]],
    ["Bài 1–5: Chào hỏi & giới thiệu", "Chữ xuất hiện trong các bài học đầu", [
      ["Chữ cơ bản bài 1–3", "Đại từ, quốc gia, học tập", [
        HZ("我", "wǒ", "tôi", 7, "戈", "ngã", "我是学生。", "Tôi là học sinh."),
        HZ("中", "zhōng", "giữa; Trung (Quốc)", 4, "丨", "trung", "中国", "Trung Quốc"),
        HZ("国", "guó", "nước, quốc gia", 8, "囗", "quốc", "国家", "quốc gia"),
        HZ("学", "xué", "học", 8, "子", "học", "学习", "học tập"),
        HZ("生", "shēng", "sinh; học sinh", 5, "生", "sinh", "学生", "học sinh"),
        HZ("爱", "ài", "yêu", 10, "爫", "ái", "我爱你。", "Tôi yêu bạn."),
      ]],
    ]],
  ]],
  ["Hán tự HSK 2", "FREE", "DRAFT", "Chữ Hán mới của HSK 2 (đang biên soạn)", [
    ["Chữ HSK 2", "Theo bài học", [
      ["Bài 1", "Chữ mới bài 1", [
        HZ("时", "shí", "thời gian; giờ", 7, "日", "thời", "时间", "thời gian"),
        HZ("间", "jiān", "khoảng, gian", 7, "门", "gian", "房间", "căn phòng"),
        HZ("事", "shì", "việc", 8, "亅", "sự", "事情", "sự việc"),
        HZ("走", "zǒu", "đi", 7, "走", "tẩu", "走路", "đi bộ"),
        HZ("到", "dào", "đến", 8, "刂", "đáo", "到了", "đến rồi"),
        HZ("票", "piào", "vé", 11, "示", "phiếu", "火车票", "vé tàu"),
        HZ("颜", "yán", "màu; vẻ mặt", 15, "页", "nhan", "颜色", "màu sắc"),
      ]],
    ]],
  ]],
  ["Hán tự HSK 3 — Khóa học", "LEARNING", "DRAFT", "Chữ HSK 3 theo chủ đề xã hội (đang biên soạn)", [
    ["Chủ đề xã hội", "Môi trường, văn hoá", [
      ["Môi trường & văn hoá", "Chữ ghép nhiều nét", [
        HZ("环", "huán", "vòng", 8, "王", "hoàn", "环境", "môi trường"),
        HZ("境", "jìng", "cảnh; biên giới", 14, "土", "cảnh", "环境", "môi trường"),
        HZ("节", "jié", "tiết; ngày lễ", 5, "艹", "tiết", "节日", "ngày lễ"),
        HZ("影", "yǐng", "bóng; ảnh", 15, "彡", "ảnh", "电影", "phim"),
        HZ("响", "xiǎng", "vang; ảnh hưởng", 9, "口", "hưởng", "影响", "ảnh hưởng"),
        HZ("习", "xí", "tập; thói quen", 3, "乙", "tập", "习惯", "thói quen"),
      ]],
    ]],
  ]],
];

// Điểm ngữ pháp theo DTO backend ngữ pháp HSK cũ (GrammarPointResponse: title, category, generalDefinition, structure, explanation, exampleSentenceZh/
// Pinyin/Vi, hskLevel chuỗi "1".."9") — gói W2-B, types/content-grammar.ts.
const GP = (title, category, structure, explanation, exampleZh, examplePinyin, exampleVi, hskLevel, generalDefinition) => ({ title, category, generalDefinition, structure, explanation, exampleSentenceZh: exampleZh, exampleSentencePinyin: examplePinyin, exampleSentenceVi: exampleVi, hskLevel });
const GRAMMAR_DEMO = [
  ["Ngữ pháp HSK 1–2", "LEARNING_PATH", "PUBLISHED", "Các điểm ngữ pháp nền tảng", [
    ["Câu cơ bản", "Cấu trúc câu đơn", [
      ["Cấu trúc câu HSK 1", "Câu khẳng định, nghi vấn, phủ định", [
        GP("Câu với 是", "Câu trần thuật", "A + 是 + B", "Khẳng định A là B; phủ định dùng 不是.", "我是学生。", "Wǒ shì xuésheng.", "Tôi là học sinh.", "1", "Động từ 是 nối chủ ngữ với danh từ."),
        GP("Câu hỏi với 吗", "Câu nghi vấn", "Câu trần thuật + 吗？", "Thêm 吗 cuối câu để hỏi có/không.", "你是老师吗？", "Nǐ shì lǎoshī ma?", "Bạn là giáo viên à?", "1", "Trợ từ nghi vấn 吗 đặt cuối câu."),
        GP("Phủ định với 不", "Phủ định", "不 + động từ/hình dung từ", "不 phủ định hiện tại/tương lai, thói quen.", "我不喝咖啡。", "Wǒ bù hē kāfēi.", "Tôi không uống cà phê.", "1", "Phó từ phủ định 不."),
        GP("Sở hữu với 有", "Động từ 有", "S + 有 + O", "Diễn tả sở hữu; phủ định là 没有.", "我有一个姐姐。", "Wǒ yǒu yí ge jiějie.", "Tôi có một chị gái.", "1", "Động từ 有 biểu thị sở hữu hoặc tồn tại."),
        GP("Vị trí với 在", "Động từ 在", "S + 在 + địa điểm", "Chỉ nơi chốn của chủ ngữ.", "他在学校。", "Tā zài xuéxiào.", "Anh ấy ở trường.", "1", "Động từ 在 chỉ vị trí."),
      ]],
      ["Ngữ pháp HSK 2", "Trợ từ động thái và so sánh", [
        GP("Hoàn thành với 了", "Trợ từ động thái", "Động từ + 了", "Hành động đã hoàn thành.", "我吃了饭。", "Wǒ chī le fàn.", "Tôi đã ăn cơm.", "2", "Trợ từ 了 biểu thị hoàn thành."),
        GP("Kinh nghiệm với 过", "Trợ từ động thái", "Động từ + 过", "Từng trải qua hành động.", "我去过北京。", "Wǒ qù guo Běijīng.", "Tôi đã từng đến Bắc Kinh.", "2", "Trợ từ 过 biểu thị kinh nghiệm đã trải qua."),
        GP("So sánh với 比", "Câu so sánh", "A + 比 + B + hình dung từ", "A hơn B ở tính chất nào đó.", "他比我高。", "Tā bǐ wǒ gāo.", "Anh ấy cao hơn tôi.", "2", "Giới từ 比 dùng để so sánh hai đối tượng."),
        GP("Tiếp diễn với 正在", "Phó từ thời gian", "正在 + động từ", "Hành động đang diễn ra.", "她正在看书。", "Tā zhèngzài kàn shū.", "Cô ấy đang đọc sách.", "2", "正在 biểu thị hành động đang tiếp diễn."),
        GP("因为…所以…", "Câu phức", "因为 A，所以 B", "Nguyên nhân – kết quả.", "因为下雨，所以我没去。", "Yīnwèi xià yǔ, suǒyǐ wǒ méi qù.", "Vì mưa nên tôi không đi.", "2", "Cặp liên từ nguyên nhân – kết quả."),
      ]],
    ]],
  ]],
  ["Ngữ pháp HSK 3", "FREE", "DRAFT", "Bổ ngữ và câu phức (đang biên soạn)", [
    ["Bổ ngữ", "Bổ ngữ kết quả, trạng thái, xu hướng", [["Bổ ngữ kết quả & trạng thái", "", [GP("Câu chữ 把", "Câu đặc biệt", "S + 把 + O + V + bổ ngữ", "Nhấn mạnh xử lý đối tượng.", "请把门关上。", "Qǐng bǎ mén guān shàng.", "Hãy đóng cửa lại.", "3", "Câu chữ 把 đưa tân ngữ lên trước động từ."), GP("Bổ ngữ trạng thái với 得", "Bổ ngữ", "V + 得 + hình dung từ", "Đánh giá mức độ của hành động.", "他说得很好。", "Tā shuō de hěn hǎo.", "Anh ấy nói rất tốt.", "3", "Trợ từ 得 nối động từ với bổ ngữ trạng thái."), GP("越来越", "Phó từ", "越来越 + hình dung từ", "Ngày càng…", "天气越来越冷。", "Tiānqì yuè lái yuè lěng.", "Trời ngày càng lạnh.", "3", "Cấu trúc biểu thị mức độ tăng dần.")]]]],
  ]],
];

// Mục phát âm — trường theo src/types/content-pronunciation.ts (W2-E): text, pinyin, tip, audioFileId/imageFileId (tệp repo-storage; seed không có tệp).
const PR = (text, pinyin, tip) => ({ text, pinyin, tip, audioFileId: null, imageFileId: null });
const PRONUNCIATION_DEMO = [
  ["Phát âm cơ bản", "LEARNING_PATH", "PUBLISHED", "Thanh điệu và phụ âm đầu", [
    ["Thanh điệu", "Bốn thanh + thanh nhẹ, biến điệu", [
      ["Bốn thanh điệu với 'ma'", "Cùng âm tiết, khác thanh", [PR("妈", "mā", "Thanh 1: cao, đều"), PR("麻", "má", "Thanh 2: đi lên"), PR("马", "mǎ", "Thanh 3: xuống rồi lên"), PR("骂", "mà", "Thanh 4: xuống nhanh, dứt khoát"), PR("吗", "ma", "Thanh nhẹ: ngắn, nhẹ")]],
      ["Biến điệu thường gặp", "Thanh 3 + thanh 3, 不 và 一", [PR("你好", "nǐ hǎo", "Hai thanh 3 liền nhau: âm đầu đọc thành thanh 2 (ní hǎo)"), PR("很好", "hěn hǎo", "Biến điệu thanh 3: hén hǎo"), PR("不是", "bú shì", "不 trước thanh 4 đọc thành thanh 2"), PR("一个", "yí gè", "一 trước thanh 4 đọc thành thanh 2")]],
    ]],
    ["Phụ âm đầu", "Nhóm âm khó với người Việt", [
      ["zh ch sh r", "Âm đầu lưỡi sau", [PR("知道", "zhīdào", "zh: đầu lưỡi cuộn, không bật hơi"), PR("吃", "chī", "ch: như zh nhưng bật hơi"), PR("是", "shì", "sh: xát, đầu lưỡi cuộn"), PR("日", "rì", "r: rung nhẹ, không bật hơi"), PR("中国", "Zhōngguó", "Ghép zh + ng"), PR("老师", "lǎoshī", "Chú ý thanh 3 + thanh 1")]],
      ["j q x", "Âm mặt lưỡi", [PR("几", "jǐ", "j: mặt lưỡi áp ngạc cứng, không bật hơi"), PR("七", "qī", "q: như j nhưng bật hơi mạnh"), PR("西", "xī", "x: xát, luồng hơi xì qua mặt lưỡi")]],
    ]],
  ]],
  ["Phát âm HSK 2 — ghép vần", "FREE", "DRAFT", "Vận mẫu khó (đang biên soạn)", [["Vận mẫu", "ü và u", [["ü và u", "Phân biệt ü/u", [PR("女", "nǚ", "ü: tròn môi như 'uy'"), PR("路", "lù", "u: tròn môi, lùi sâu"), PR("去", "qù", "q + ü viết thành qu"), PR("住", "zhù", "u sau zh"), PR("绿", "lǜ", "l + ü giữ dấu hai chấm")]]]]]],
];

// Quiz + câu hỏi theo hợp đồng đề xuất của gói W2-B (types/content-quiz.ts): câu hỏi gom options/blanks/pairs theo loại; durationMinutes 0 = không giới hạn.
const QZ = (title, skill, durationMinutes, questions, extra = {}) => ({ title, skill, difficulty: "MEDIUM", durationMinutes: durationMinutes || undefined, passingScore: 80, shuffleQuestions: false, ...extra, questions });
const MC = (prompt, texts, correct, explanation) => ({ type: "MULTIPLE_CHOICE", prompt, points: 10, difficulty: "MEDIUM", options: texts.map((text, i) => ({ text, isCorrect: i === correct })), explanation });
const TF = (prompt, correctAnswer, explanation) => ({ type: "TRUE_FALSE", prompt, points: 5, difficulty: "EASY", correctAnswer, explanation });
const FIB = (prompt, answers, explanation) => ({ type: "FILL_IN_BLANK", prompt, points: 10, difficulty: "MEDIUM", fillBlankMode: "TYPE", blanks: answers.map(([answer, ...acceptable], index) => ({ index, answer, acceptable })), explanation });
const MP = (prompt, pairs) => ({ type: "MATCHING_PAIRS", prompt, points: 10, difficulty: "MEDIUM", pairs: pairs.map(([left, right]) => ({ left, right })) });
const SA = (prompt, referenceAnswer) => ({ type: "SHORT_ANSWER", prompt, points: 20, difficulty: "HARD", gradingMode: "MANUAL", referenceAnswer });
const QUIZ_DEMO = [
  ["Bài tập HSK 1", "LEARNING_PATH", "PUBLISHED", "Bài tập theo bài học HSK 1", [
    ["Bài 1–3", "Chào hỏi, giới thiệu", [
      ["Bài 1: Chào hỏi", "Nghe và đọc hiểu bài 1", [
        QZ("Nghe và chọn đáp án — Bài 1", "LISTENING", 10, [
          MC("Nghe: 你好 — câu này có nghĩa là gì?", ["Xin chào", "Cảm ơn", "Tạm biệt", "Xin lỗi"], 0, "你好 (nǐ hǎo) là lời chào thông dụng nhất."),
          MC("Nghe: 谢谢 — chọn nghĩa đúng", ["Mời", "Cảm ơn", "Không có gì", "Tạm biệt"], 1),
          TF("再见 nghĩa là 'xin chào'.", false, "再见 (zàijiàn) nghĩa là tạm biệt."),
        ]),
        QZ("Đọc hiểu — Bài 1", "READING", 15, [
          MC("我是学生。 — Người nói là ai?", ["Giáo viên", "Học sinh", "Bác sĩ", "Bạn"], 1),
          FIB("你叫什么{blank}？", [["名字"]], "名字 (míngzi): tên."),
          MP("Nối từ với nghĩa tiếng Việt", [["老师", "giáo viên"], ["学生", "học sinh"], ["朋友", "bạn"]]),
        ], { difficulty: "EASY" }),
      ], "LISTENING"],
      ["Bài 2: Gia đình", "Từ vựng gia đình", [
        QZ("Từ vựng gia đình", "PRACTICE", 0, [MC("爸爸 nghĩa là gì?", ["Mẹ", "Bố", "Anh trai", "Chị gái"], 1), FIB("我{blank}有四个人。", [["家", "家里"]]), TF("妈妈 nghĩa là 'mẹ'.", true)]),
      ], "PRACTICE"],
    ]],
  ]],
  ["Luyện thi HSK 2", "FREE", "DRAFT", "Đề luyện (đang biên soạn)", [["Đề 1", "", [["Đề luyện số 1", "Đọc hiểu", [
    QZ("Đọc hiểu đề 1", "READING", 20, [MC("他比我高。 — Ai cao hơn?", ["Tôi", "Anh ấy", "Bằng nhau", "Không rõ"], 1)], { difficulty: "HARD", passingScore: 70 }),
    QZ("Viết đoạn ngắn — đề 1", "WRITING", 30, [SA("Viết 3–5 câu giới thiệu gia đình bạn bằng tiếng Trung.", "我家有四个人：爸爸、妈妈、哥哥和我。…")], { difficulty: "HARD" }),
  ], "READING"]]]]],
];

const E2E_ITEMS = {
  flashcard: [FC("你好", "nǐ hǎo", "xin chào", "thán từ", "你好！", "Xin chào!"), FC("谢谢", "xièxie", "cảm ơn", "động từ", "谢谢你。", "Cảm ơn bạn.")],
  writing: [HZ("人", "rén", "người", 2, "人"), HZ("口", "kǒu", "miệng", 3, "口")],
  grammar: [GP("Câu với 是", "Câu trần thuật", "A + 是 + B", "A là B", "我是学生。", "Wǒ shì xuésheng.", "Tôi là học sinh.", "1", "Động từ 是.")],
  pronunciation: [PR("妈", "mā", "Thanh 1")],
  quiz: [QZ("Quiz mẫu", "READING", 10, [MC("你好 nghĩa là?", ["Xin chào", "Cảm ơn"], 0)])],
};

/** Dữ liệu seed `demo` theo module; `e2e`: một gói/thư mục/bộ với 1–2 mục, id cố định (fc-pkg-1, fc-folder-1, fc-set-1, fc-item-1...). */
const DEMO_SEED = { flashcard: FLASHCARD_DEMO, writing: WRITING_DEMO, quiz: QUIZ_DEMO, grammar: GRAMMAR_DEMO, pronunciation: PRONUNCIATION_DEMO };
const E2E_SEED = (mod) => [["Gói mẫu (DỮ LIỆU GIẢ)", "FREE", "PUBLISHED", "Gói kiểm thử", [["Thư mục mẫu", "Thư mục kiểm thử", [["Bộ mẫu", "Bộ kiểm thử", E2E_ITEMS[mod], mod === "quiz" ? "READING" : undefined]]]]], ["Gói nháp", "LEARNING_PATH", "DRAFT", "Gói chưa publish", []]];
const ID_PREFIX = { flashcard: "fc", writing: "hz", quiz: "qz", grammar: "gr", pronunciation: "pr" };

let db = null;

function profile() {
  return state.data?.profile ?? PROFILE;
}

function seed() {
  const next = {};
  for (const [mod, meta] of Object.entries(MODULES)) {
    // Bộ đếm theo loại => id ổn định, đọc được (fc-pkg-1, fc-folder-1, fc-set-1, fc-item-1) cho kiểm thử trình duyệt.
    const store = { packages: [], folders: [], studySets: [], items: [], questions: [], seq: { pkg: 0, folder: 0, set: 0, item: 0, q: 0 } };
    const p = ID_PREFIX[mod];
    const nextId = (kind) => `${p}-${kind}-${++store.seq[kind]}`;
    const base = Date.UTC(2026, 8, 1);
    const sourceSeed = profile() === "demo" ? DEMO_SEED[mod] : E2E_SEED(mod);
    sourceSeed.forEach(([name, type, publishStatus, description, folders], pi) => {
      const pkg = { id: nextId("pkg"), name, type, publishStatus, description, createdAt: new Date(base + pi * 3 * DAY).toISOString(), updatedAt: new Date(base + pi * 3 * DAY + DAY).toISOString() };
      store.packages.push(pkg);
      folders.forEach(([fname, fdesc, sets], fi) => {
        const folder = { id: nextId("folder"), packageId: pkg.id, name: fname, description: fdesc, isPrivate: false, createdAt: new Date(base + (pi * 3 + fi) * DAY).toISOString(), updatedAt: new Date(base + (pi * 3 + fi) * DAY).toISOString() };
        store.folders.push(folder);
        sets.forEach(([title, sdesc, items, skill], si) => {
          const set = { id: nextId("set"), folderId: folder.id, title, description: sdesc, isPrivate: true, skill: meta.questions ? skill ?? "READING" : undefined, createdAt: new Date(base + (pi * 3 + fi) * DAY + si * 3_600_000).toISOString(), updatedAt: new Date(base + (pi * 3 + fi) * DAY + si * 3_600_000).toISOString() };
          store.studySets.push(set);
          items.forEach((fields, ii) => {
            const { questions, ...rest } = fields;
            const item = { id: nextId("item"), studySetId: set.id, index: ii, ...rest, createdAt: set.createdAt, updatedAt: set.createdAt };
            if (meta.questions) item.questionCount = (questions ?? []).length;
            store.items.push(item);
            (questions ?? []).forEach((q, qi) => store.questions.push({ id: nextId("q"), quizId: item.id, index: qi, ...q }));
          });
        });
      });
    });
    next[mod] = store;
  }
  db = next;
}

function ensure() {
  if (!db) seed();
  return db;
}
registerResettable(() => seed());

// ---------- helper ----------
const now = () => new Date().toISOString();
const str = (v) => (typeof v === "string" ? v.trim() : "");
const badRequest = (ctx, message) => send(ctx.req, ctx.res, 400, fail("VALIDATION_ERROR", `${message} (MOCK)`));
const notFound = (ctx, what) => send(ctx.req, ctx.res, 404, fail("404", `Không tìm thấy ${what} (MOCK)`));
const respond = (ctx, status, produce) => {
  const mode = state.controls.api;
  if (mode === "error") return send(ctx.req, ctx.res, 500, fail("500", "Lỗi máy chủ giả lập (MOCK)"));
  const go = () => send(ctx.req, ctx.res, status, ok(produce()));
  return mode === "slow" ? void setTimeout(go, 2500) : go();
};

const viewPackage = (store, pkg) => ({ ...pkg, folderCount: store.folders.filter((f) => f.packageId === pkg.id).length });
const viewFolder = (store, folder) => ({ ...folder, studySetCount: store.studySets.filter((s) => s.folderId === folder.id).length });
const viewSet = (store, set) => ({ ...set, itemCount: store.items.filter((i) => i.studySetId === set.id).length });
const viewItem = (store, meta, item) => (meta.questions ? { ...item, questionCount: store.questions.filter((q) => q.quizId === item.id).length } : item);

function removePackage(store, id) {
  const folders = store.folders.filter((f) => f.packageId === id);
  folders.forEach((f) => removeFolder(store, f.id));
  store.packages = store.packages.filter((p) => p.id !== id);
}
function removeFolder(store, id) {
  store.studySets.filter((s) => s.folderId === id).forEach((s) => removeSet(store, s.id));
  store.folders = store.folders.filter((f) => f.id !== id);
}
function removeSet(store, id) {
  store.items.filter((i) => i.studySetId === id).forEach((i) => removeItem(store, i.id));
  store.studySets = store.studySets.filter((s) => s.id !== id);
}
function removeItem(store, id) {
  store.questions = store.questions.filter((q) => q.quizId !== id);
  store.items = store.items.filter((i) => i.id !== id);
}

/** Thân mục: bỏ trường hệ thống, giữ trường còn lại của module. */
function itemFields(body) {
  const { id: _id, studySetId: _s, createdAt: _c, updatedAt: _u, questionCount: _qc, ...rest } = body ?? {};
  return rest;
}
function validItem(meta, fields) {
  return meta.required.every((k) => str(fields[k]));
}

function searchItems(store, meta, q, page, size) {
  const needle = q.trim().toLowerCase();
  const context = (item) => {
    const set = store.studySets.find((s) => s.id === item.studySetId);
    const folder = set ? store.folders.find((f) => f.id === set.folderId) : undefined;
    const pkg = folder ? store.packages.find((p) => p.id === folder.packageId) : undefined;
    return { ...viewItem(store, meta, item), studySetTitle: set?.title, folderId: folder?.id, folderName: folder?.name, packageId: pkg?.id, packageName: pkg?.name, packageType: pkg?.type };
  };
  const all = store.items
    .filter((item) => !needle || Object.values(item).some((v) => typeof v === "string" && v.toLowerCase().includes(needle)))
    .map(context)
    .sort((a, b) => (a.packageName ?? "").localeCompare(b.packageName ?? "", "vi") || (a.folderName ?? "").localeCompare(b.folderName ?? "", "vi") || (a.studySetTitle ?? "").localeCompare(b.studySetTitle ?? "", "vi") || (a.index ?? 0) - (b.index ?? 0));
  const start = page * size;
  return { items: all.slice(start, start + size), totalElements: all.length, totalPages: all.length ? Math.ceil(all.length / size) : 0, page, size };
}

// ---------- quiz: câu hỏi (gói W2-B) ----------
const QUESTION_TYPES = ["MULTIPLE_CHOICE", "TRUE_FALSE", "FILL_IN_BLANK", "MATCHING_PAIRS", "SHORT_ANSWER", "AUDIO_RESPONSE", "SENTENCE_BUILDER"];
const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"];
const GRADING_MODES = ["AUTO", "MANUAL", "AI_ASSIST"];

/** Kiểm tra câu hỏi THEO LOẠI và chỉ giữ trường của loại đó (hợp đồng types/content-quiz.ts); trả { fields } hoặc { error }. */
function normalizeQuestion(body) {
  if (!body || typeof body !== "object") return { error: "Thân yêu cầu không hợp lệ" };
  const type = str(body.type);
  if (!QUESTION_TYPES.includes(type)) return { error: `Loại câu hỏi không hợp lệ (${QUESTION_TYPES.join(", ")})` };
  const prompt = str(body.prompt);
  if (!prompt) return { error: type === "FILL_IN_BLANK" ? "Thiếu câu mẫu (prompt)" : "Thiếu nội dung câu hỏi (prompt)" };
  const points = Number(body.points);
  if (!(Number.isFinite(points) && points > 0)) return { error: "Điểm (points) phải lớn hơn 0" };
  const fields = { type, prompt, points, difficulty: DIFFICULTIES.includes(body.difficulty) ? body.difficulty : "MEDIUM", explanation: str(body.explanation) || undefined, imageFileId: str(body.imageFileId) || undefined, audioFileId: str(body.audioFileId) || undefined };
  switch (type) {
    case "MULTIPLE_CHOICE": {
      const options = Array.isArray(body.options) ? body.options.filter((o) => o && str(o.text)).map((o) => ({ text: str(o.text), isCorrect: o.isCorrect === true })) : [];
      if (options.length < 2) return { error: "Trắc nghiệm cần ít nhất 2 lựa chọn" };
      if (options.filter((o) => o.isCorrect).length !== 1) return { error: "Trắc nghiệm phải có đúng 1 đáp án đúng" };
      fields.options = options;
      break;
    }
    case "TRUE_FALSE":
      if (typeof body.correctAnswer !== "boolean") return { error: "Thiếu đáp án Đúng/Sai (correctAnswer: boolean)" };
      fields.correctAnswer = body.correctAnswer;
      break;
    case "FILL_IN_BLANK": {
      const blankCount = (prompt.match(/\{blank\}/g) ?? []).length;
      const blanks = Array.isArray(body.blanks) ? body.blanks.filter((b) => b && str(b.answer)).map((b, i) => ({ index: typeof b.index === "number" ? b.index : i, answer: str(b.answer), acceptable: Array.isArray(b.acceptable) ? b.acceptable.map(str).filter(Boolean) : [] })) : [];
      if (blankCount === 0) return { error: "Câu mẫu phải có ít nhất 1 chỗ trống {blank}" };
      if (blanks.length !== blankCount) return { error: `Số chỗ trống trong câu mẫu (${blankCount}) không khớp số đáp án (${blanks.length})` };
      fields.fillBlankMode = body.fillBlankMode === "SELECT" ? "SELECT" : "TYPE";
      fields.blanks = blanks;
      if (fields.fillBlankMode === "SELECT") {
        const choices = Array.isArray(body.choices) ? body.choices.map(str).filter(Boolean) : [];
        if (choices.length < 2) return { error: "Chế độ chọn đáp án cần ít nhất 2 lựa chọn (choices)" };
        fields.choices = choices;
      }
      break;
    }
    case "MATCHING_PAIRS": {
      const pairs = Array.isArray(body.pairs) ? body.pairs.filter((p) => p && str(p.left) && str(p.right)).map((p) => ({ left: str(p.left), right: str(p.right) })) : [];
      if (pairs.length < 2) return { error: "Nối cặp cần ít nhất 2 cặp (pairs)" };
      fields.pairs = pairs;
      break;
    }
    case "SHORT_ANSWER":
      fields.gradingMode = GRADING_MODES.includes(body.gradingMode) ? body.gradingMode : "MANUAL";
      fields.referenceAnswer = str(body.referenceAnswer) || undefined;
      break;
    case "AUDIO_RESPONSE":
      fields.gradingMode = GRADING_MODES.includes(body.gradingMode) ? body.gradingMode : "MANUAL";
      break;
    case "SENTENCE_BUILDER": {
      const chunks = Array.isArray(body.chunks) ? body.chunks.map(str).filter(Boolean) : [];
      if (chunks.length < 2 || !str(body.correctSentence)) return { error: "Xây dựng câu cần ít nhất 2 mảnh ghép (chunks) và câu đúng (correctSentence)" };
      fields.chunks = chunks;
      fields.correctSentence = str(body.correctSentence);
      break;
    }
    default:
      break;
  }
  return { fields };
}

// ---------- handler ----------
export async function handle(ctx) {
  const { req, res, url, method } = ctx;
  const m = url.pathname.match(PREFIX_RE);
  if (!m) return false;
  const mod = m[1];
  const meta = MODULES[mod];
  const sub = (m[2] || "").replace(/\/+$/, "");
  const q = url.searchParams;
  const store = ensure()[mod];
  const seqId = (kind) => `${ID_PREFIX[mod]}-${kind}-${++store.seq[kind]}`;

  const s = ctx.session();
  if (!s) return send(req, res, 401, fail("UNAUTHORIZED", "Chưa đăng nhập (MOCK)")), true;
  const canWrite = s.roles.some((r) => WRITE_ROLES.includes(r));
  const canPublish = s.roles.some((r) => PUBLISH_ROLES.includes(r));
  const forbid = () => (send(req, res, 403, fail("FORBIDDEN", "Không có quyền ghi nội dung (MOCK)")), true);
  const path = (re) => sub.match(re);
  count(`content:${mod}`);

  // ---- packages ----
  if (sub === "/packages") {
    if (method === "GET") {
      const type = q.get("type");
      return respond(ctx, 200, () => store.packages.filter((p) => !type || p.type === type).map((p) => viewPackage(store, p))), true;
    }
    if (method === "POST") {
      if (!canWrite) return forbid();
      const body = await readBody(req);
      if (!str(body?.name) || !str(body?.type)) return badRequest(ctx, "Thiếu tên hoặc loại gói"), true;
      const pkg = { id: seqId("pkg"), name: str(body.name), type: str(body.type), description: str(body.description) || undefined, publishStatus: "DRAFT", createdAt: now(), updatedAt: now() };
      store.packages.push(pkg);
      return respond(ctx, 201, () => viewPackage(store, pkg)), true;
    }
  }
  let pm = path(/^\/packages\/([^/]+)$/);
  if (pm) {
    const pkg = store.packages.find((p) => p.id === decodeURIComponent(pm[1]));
    if (method === "GET") return pkg ? respond(ctx, 200, () => viewPackage(store, pkg)) : notFound(ctx, "gói"), true;
    if (method === "PUT") {
      if (!canWrite) return forbid();
      if (!pkg) return notFound(ctx, "gói"), true;
      const body = await readBody(req);
      if (!str(body?.name)) return badRequest(ctx, "Thiếu tên gói"), true;
      Object.assign(pkg, { name: str(body.name), type: str(body.type) || pkg.type, description: str(body.description) || undefined, updatedAt: now() });
      return respond(ctx, 200, () => viewPackage(store, pkg)), true;
    }
    if (method === "DELETE") {
      if (!canWrite) return forbid();
      if (!pkg) return notFound(ctx, "gói"), true;
      removePackage(store, pkg.id);
      return respond(ctx, 200, () => ({ deleted: pkg.id })), true;
    }
  }
  pm = path(/^\/packages\/([^/]+)\/(publish|unpublish)$/);
  if (pm && method === "POST") {
    if (!canPublish) return send(req, res, 403, fail("FORBIDDEN", "Chỉ Admin/Teacher-manager được publish (MOCK)")), true;
    const pkg = store.packages.find((p) => p.id === decodeURIComponent(pm[1]));
    if (!pkg) return notFound(ctx, "gói"), true;
    const target = pm[2] === "publish" ? "PUBLISHED" : "DRAFT";
    if (pkg.publishStatus === target) return send(req, res, 409, fail("CONFLICT", `Gói đã ở trạng thái ${target} (MOCK)`)), true;
    pkg.publishStatus = target;
    pkg.updatedAt = now();
    return respond(ctx, 200, () => viewPackage(store, pkg)), true;
  }

  // ---- folders ----
  if (sub === "/folders") {
    if (method === "GET") {
      const packageId = q.get("packageId");
      if (!packageId) return badRequest(ctx, "Thiếu packageId"), true;
      if (!store.packages.some((p) => p.id === packageId)) return notFound(ctx, "gói"), true;
      return respond(ctx, 200, () => store.folders.filter((f) => f.packageId === packageId).map((f) => viewFolder(store, f))), true;
    }
    if (method === "POST") {
      if (!canWrite) return forbid();
      const body = await readBody(req);
      if (!str(body?.name) || !str(body?.packageId)) return badRequest(ctx, "Thiếu tên thư mục hoặc packageId"), true;
      if (!store.packages.some((p) => p.id === body.packageId)) return notFound(ctx, "gói"), true;
      const folder = { id: seqId("folder"), packageId: body.packageId, name: str(body.name), description: str(body.description) || undefined, isPrivate: Boolean(body.isPrivate), createdAt: now(), updatedAt: now() };
      store.folders.push(folder);
      return respond(ctx, 201, () => viewFolder(store, folder)), true;
    }
  }
  let fm = path(/^\/folders\/([^/]+)$/);
  if (fm) {
    const folder = store.folders.find((f) => f.id === decodeURIComponent(fm[1]));
    if (method === "GET") return folder ? respond(ctx, 200, () => viewFolder(store, folder)) : notFound(ctx, "thư mục"), true;
    if (method === "PUT") {
      if (!canWrite) return forbid();
      if (!folder) return notFound(ctx, "thư mục"), true;
      const body = await readBody(req);
      if (!str(body?.name)) return badRequest(ctx, "Thiếu tên thư mục"), true;
      Object.assign(folder, { name: str(body.name), description: str(body.description) || undefined, isPrivate: Boolean(body.isPrivate), updatedAt: now() });
      return respond(ctx, 200, () => viewFolder(store, folder)), true;
    }
    if (method === "DELETE") {
      if (!canWrite) return forbid();
      if (!folder) return notFound(ctx, "thư mục"), true;
      removeFolder(store, folder.id);
      return respond(ctx, 200, () => ({ deleted: folder.id })), true;
    }
  }

  // ---- study sets ----
  if (sub === "/study-sets") {
    if (method === "GET") {
      const folderId = q.get("folderId");
      if (!folderId) return badRequest(ctx, "Thiếu folderId"), true;
      if (!store.folders.some((f) => f.id === folderId)) return notFound(ctx, "thư mục"), true;
      return respond(ctx, 200, () => store.studySets.filter((x) => x.folderId === folderId).map((x) => viewSet(store, x))), true;
    }
    if (method === "POST") {
      if (!canWrite) return forbid();
      const body = await readBody(req);
      if (!str(body?.title) || !str(body?.folderId)) return badRequest(ctx, "Thiếu tên bộ hoặc folderId"), true;
      if (!store.folders.some((f) => f.id === body.folderId)) return notFound(ctx, "thư mục"), true;
      if (meta.questions && !str(body.skill)) return badRequest(ctx, "Thiếu kỹ năng (skill)"), true;
      const set = { id: seqId("set"), folderId: body.folderId, title: str(body.title), description: str(body.description) || undefined, isPrivate: body.isPrivate !== false, skill: str(body.skill) || undefined, createdAt: now(), updatedAt: now() };
      store.studySets.push(set);
      return respond(ctx, 201, () => viewSet(store, set)), true;
    }
  }
  let sm = path(/^\/study-sets\/([^/]+)$/);
  if (sm) {
    const set = store.studySets.find((x) => x.id === decodeURIComponent(sm[1]));
    if (method === "GET") return set ? respond(ctx, 200, () => viewSet(store, set)) : notFound(ctx, "bộ"), true;
    if (method === "PUT") {
      if (!canWrite) return forbid();
      if (!set) return notFound(ctx, "bộ"), true;
      const body = await readBody(req);
      if (!str(body?.title)) return badRequest(ctx, "Thiếu tên bộ"), true;
      if (body.folderId && !store.folders.some((f) => f.id === body.folderId)) return notFound(ctx, "thư mục"), true;
      Object.assign(set, { title: str(body.title), description: str(body.description) || undefined, isPrivate: body.isPrivate !== false, skill: str(body.skill) || set.skill, folderId: body.folderId || set.folderId, updatedAt: now() });
      return respond(ctx, 200, () => viewSet(store, set)), true;
    }
    if (method === "DELETE") {
      if (!canWrite) return forbid();
      if (!set) return notFound(ctx, "bộ"), true;
      removeSet(store, set.id);
      return respond(ctx, 200, () => ({ deleted: set.id })), true;
    }
  }

  // ---- items (cards/words/quizzes/grammar-points/pronunciation-items) ----
  const itemsBase = `/${meta.itemsPath}`;
  if (sub === `${itemsBase}/search` && method === "GET") {
    const size = Math.max(1, Math.min(100, Number(q.get("size")) || 20));
    const page = Math.max(0, Number(q.get("page")) || 0);
    return respond(ctx, 200, () => searchItems(store, meta, q.get("q") || "", page, size)), true;
  }
  if (sub === `${itemsBase}/bulk` && method === "POST") {
    if (!canWrite) return forbid();
    const body = await readBody(req);
    const list = Array.isArray(body?.items) ? body.items : Array.isArray(body?.[meta.legacyKey]) ? body[meta.legacyKey] : null;
    if (!str(body?.studySetId) || !list) return badRequest(ctx, "Thiếu studySetId hoặc danh sách mục"), true;
    if (!store.studySets.some((x) => x.id === body.studySetId)) return notFound(ctx, "bộ"), true;
    const fieldsList = list.map(itemFields);
    if (!fieldsList.every((f) => validItem(meta, f))) return badRequest(ctx, `Mục thiếu trường bắt buộc (${meta.required.join(", ")})`), true;
    const existing = store.items.filter((i) => i.studySetId === body.studySetId).length;
    const created = fieldsList.map((fields, k) => {
      const item = { id: seqId("item"), studySetId: body.studySetId, ...fields, index: typeof fields.index === "number" ? fields.index : existing + k, createdAt: now(), updatedAt: now() };
      store.items.push(item);
      return viewItem(store, meta, item);
    });
    return respond(ctx, 201, () => created), true;
  }
  if (sub === itemsBase) {
    if (method === "GET") {
      const studySetId = q.get("studySetId");
      if (!studySetId) return badRequest(ctx, "Thiếu studySetId"), true;
      if (!store.studySets.some((x) => x.id === studySetId)) return notFound(ctx, "bộ"), true;
      return respond(ctx, 200, () => store.items.filter((i) => i.studySetId === studySetId).sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).map((i) => viewItem(store, meta, i))), true;
    }
    if (method === "POST") {
      if (!canWrite) return forbid();
      const body = await readBody(req);
      if (!str(body?.studySetId)) return badRequest(ctx, "Thiếu studySetId"), true;
      if (!store.studySets.some((x) => x.id === body.studySetId)) return notFound(ctx, "bộ"), true;
      const fields = itemFields(body);
      if (!validItem(meta, fields)) return badRequest(ctx, `Mục thiếu trường bắt buộc (${meta.required.join(", ")})`), true;
      const existing = store.items.filter((i) => i.studySetId === body.studySetId).length;
      const item = { id: seqId("item"), studySetId: body.studySetId, ...fields, index: typeof fields.index === "number" ? fields.index : existing, createdAt: now(), updatedAt: now() };
      store.items.push(item);
      return respond(ctx, 201, () => viewItem(store, meta, item)), true;
    }
  }
  let im = path(new RegExp(`^${itemsBase.replace(/[-/]/g, "\\$&")}/([^/]+)$`));
  if (im) {
    const item = store.items.find((i) => i.id === decodeURIComponent(im[1]));
    if (method === "GET") return item ? respond(ctx, 200, () => viewItem(store, meta, item)) : notFound(ctx, "mục"), true;
    if (method === "PUT") {
      if (!canWrite) return forbid();
      if (!item) return notFound(ctx, "mục"), true;
      const body = await readBody(req);
      const fields = itemFields(body);
      if (!validItem(meta, { ...item, ...fields })) return badRequest(ctx, `Mục thiếu trường bắt buộc (${meta.required.join(", ")})`), true;
      // PUT thay toàn bộ trường nội dung (trường không gửi = bỏ), giữ hệ thống + index khi không gửi.
      const keep = { id: item.id, studySetId: item.studySetId, createdAt: item.createdAt, index: typeof fields.index === "number" ? fields.index : item.index };
      for (const k of Object.keys(item)) if (!(k in keep)) delete item[k];
      Object.assign(item, keep, fields, { updatedAt: now() });
      return respond(ctx, 200, () => viewItem(store, meta, item)), true;
    }
    if (method === "DELETE") {
      if (!canWrite) return forbid();
      if (!item) return notFound(ctx, "mục"), true;
      removeItem(store, item.id);
      return respond(ctx, 200, () => ({ deleted: item.id })), true;
    }
  }

  // ---- quiz: câu hỏi của một quiz — GET/POST /questions/{quizId}, PUT/DELETE /questions/{id} (hợp đồng gói W2-B, kiểm tra theo loại) ----
  if (meta.questions) {
    const qm = path(/^\/questions\/([^/]+)$/);
    if (qm) {
      const id = decodeURIComponent(qm[1]);
      if (method === "GET") {
        if (!store.items.some((i) => i.id === id)) return notFound(ctx, "quiz"), true;
        return respond(ctx, 200, () => store.questions.filter((x) => x.quizId === id).sort((a, b) => a.index - b.index)), true;
      }
      if (method === "POST") {
        if (!canWrite) return forbid();
        if (!store.items.some((i) => i.id === id)) return notFound(ctx, "quiz"), true;
        const body = await readBody(req);
        const checked = normalizeQuestion(body);
        if (checked.error) return badRequest(ctx, checked.error), true;
        const existing = store.questions.filter((x) => x.quizId === id).length;
        const question = { id: seqId("q"), quizId: id, index: typeof body.index === "number" ? body.index : existing, ...checked.fields, createdAt: now(), updatedAt: now() };
        store.questions.push(question);
        return respond(ctx, 201, () => question), true;
      }
      if (method === "PUT") {
        if (!canWrite) return forbid();
        const question = store.questions.find((x) => x.id === id);
        if (!question) return notFound(ctx, "câu hỏi"), true;
        const body = await readBody(req);
        const checked = normalizeQuestion(body);
        if (checked.error) return badRequest(ctx, checked.error), true;
        // PUT thay toàn bộ trường nội dung (trường của loại khác bị bỏ); giữ id/quizId/createdAt và index khi không gửi.
        const keep = { id: question.id, quizId: question.quizId, index: typeof body.index === "number" ? body.index : question.index, createdAt: question.createdAt };
        for (const k of Object.keys(question)) delete question[k];
        Object.assign(question, keep, checked.fields, { updatedAt: now() });
        return respond(ctx, 200, () => question), true;
      }
      if (method === "DELETE") {
        if (!canWrite) return forbid();
        if (!store.questions.some((x) => x.id === id)) return notFound(ctx, "câu hỏi"), true;
        store.questions = store.questions.filter((x) => x.id !== id);
        return respond(ctx, 200, () => ({ deleted: id })), true;
      }
    }
  }

  return send(req, res, 404, fail("404", `MOCK content-tree: không có endpoint ${method} ${url.pathname}`)), true;
}
