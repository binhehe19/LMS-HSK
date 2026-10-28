// Từ điển GIẢ LẬP (/api/hsk/dictionary/vocabularies/*) theo HỢP ĐỒNG ĐỀ XUẤT kế thừa core/services/vocabulary.service.ts của HSK cũ:
//   GET /search?keySearch&hskLevel&isSingleVocab&wordType&radical&page&size → trang {items,totalElements,totalPages,page,size} (page từ 0)
//   GET /{id} · POST · PUT /{id} · DELETE /{id}; /import* trả 501 (import Excel bất đồng bộ CHƯA chuyển ở M5). Tài liệu: docs/api-requirements/dictionary.md.
// Quyền (mock KHÔNG kiểm ticket): đọc = đã đăng nhập; ghi = ADMIN | TEACHER | MENTOR. 401 chưa đăng nhập, 403 sai role, 404 không có, 400 body sai,
// 409 trùng Hán tự. Dữ liệu trong bộ nhớ, seed theo hồ sơ (`demo`: ~60 từ HSK 1–6 thật; `e2e`: 3 từ cố định id 1..3); thao tác ghi THAY ĐỔI dữ liệu;
// /mock-reset về seed. Tôn trọng state.controls.api cho đọc chính (search).
import { PROFILE, count, fail, ok, paginate, readBody, registerResettable, respondWithApiState, send, state } from "../core.mjs";

const PREFIX = "/api/hsk/dictionary/vocabularies";
const WRITE_ROLES = ["ROLE_ADMIN", "ROLE_TEACHER", "ROLE_MENTOR"];
const HSK_LEVELS = [1, 2, 3, 4, 5, 6];

// ---------- seed ----------
const js = (list) => JSON.stringify(list);
const M = (meaning, exampleSentenceCn, exampleSentencePinyin, exampleSentenceVi, exampleWordType) => ({ meaning, exampleSentenceCn, exampleSentencePinyin, exampleSentenceVi, exampleWordType });
const P = (pinyin, sinoVietnamese, wordTypes, meanings, extra = {}) => ({ pinyin, sinoVietnamese, wordTypes, isPrimary: false, meanings, ...extra });
const V = (hanzi, hskLevel, pinyins, extra = {}) => ({ hanzi, hskLevel, isSingleVocab: [...hanzi].length === 1, status: "published", pinyins, ...extra });

const DEMO_WORDS = [
  // ---- HSK 1 ----
  V("你", 1, [P("nǐ", "nhĩ", "Đại từ", [M("bạn, anh, chị (ngôi thứ hai)", "你好吗？", "Nǐ hǎo ma?", "Bạn khỏe không?", "Đại từ")], { compounds: js([{ hanzi: "你们", sinoVietnamese: "nhĩ môn" }, { hanzi: "你好", sinoVietnamese: "nhĩ hảo" }]) })], { radical: "亻", strokeCount: 7, strokes: "撇、竖、撇、横钩、竖钩、撇、点" }),
  V("好", 1, [
    P("hǎo", "hảo", "Tính từ", [M("tốt, đẹp, ngon", "今天天气很好。", "Jīntiān tiānqì hěn hǎo.", "Hôm nay trời rất đẹp.", "Tính từ"), M("khỏe", "你身体好吗？", "Nǐ shēntǐ hǎo ma?", "Bạn có khỏe không?", "Tính từ")], { compounds: js([{ hanzi: "好吃", sinoVietnamese: "hảo cật" }, { hanzi: "好看", sinoVietnamese: "hảo khán" }, { hanzi: "好人", sinoVietnamese: "hảo nhân" }]), synonyms: js([{ hanzi: "棒", pinyin: "bàng" }]), antonyms: js([{ hanzi: "坏", pinyin: "huài" }]) }),
    P("hào", "hiếu", "Động từ", [M("thích, ưa, ham", "他好学。", "Tā hào xué.", "Anh ấy ham học.", "Động từ")], { notes: "Đọc hào (thanh 4) khi mang nghĩa 'thích': 好学, 好客." }),
  ], { radical: "女", strokeCount: 6, strokes: "撇点、撇、横、横撇、竖钩、横", etymologyStory: "Chữ 女 (phụ nữ) bên 子 (con): người mẹ bên con — hình ảnh của điều tốt đẹp." }),
  V("我", 1, [P("wǒ", "ngã", "Đại từ", [M("tôi, ta", "我是学生。", "Wǒ shì xuésheng.", "Tôi là học sinh.", "Đại từ")], { compounds: js([{ hanzi: "我们", sinoVietnamese: "ngã môn" }]) })], { radical: "戈", strokeCount: 7 }),
  V("是", 1, [P("shì", "thị", "Động từ", [M("là", "他是老师。", "Tā shì lǎoshī.", "Anh ấy là giáo viên.", "Động từ"), M("đúng, phải", "是的，我知道。", "Shì de, wǒ zhīdào.", "Đúng, tôi biết.", "Động từ")])], { radical: "日", strokeCount: 9 }),
  V("人", 1, [P("rén", "nhân", "Danh từ", [M("người", "教室里有十个人。", "Jiàoshì lǐ yǒu shí ge rén.", "Trong lớp có mười người.", "Danh từ")], { measureWord: "个 [gè]", compounds: js([{ hanzi: "中国人", sinoVietnamese: "Trung Quốc nhân" }, { hanzi: "大人", sinoVietnamese: "đại nhân" }]) })], { radical: "人", strokeCount: 2, strokes: "撇、捺", etymologyStory: "Hình người đứng nghiêng, hai nét là thân và chân." }),
  V("学生", 1, [P("xuésheng", "học sinh", "Danh từ", [M("học sinh, sinh viên", "我是一个学生。", "Wǒ shì yí ge xuésheng.", "Tôi là một học sinh.", "Danh từ")], { measureWord: "个 [gè], 名 [míng]" })]),
  V("老师", 1, [P("lǎoshī", "lão sư", "Danh từ", [M("giáo viên, thầy/cô giáo", "王老师教我们汉语。", "Wáng lǎoshī jiāo wǒmen Hànyǔ.", "Thầy Vương dạy chúng tôi tiếng Trung.", "Danh từ")], { measureWord: "位 [wèi], 个 [gè]" })]),
  V("中国", 1, [P("Zhōngguó", "Trung Quốc", "Danh từ", [M("Trung Quốc", "我想去中国。", "Wǒ xiǎng qù Zhōngguó.", "Tôi muốn đi Trung Quốc.", "Danh từ")])]),
  V("吃", 1, [P("chī", "cật", "Động từ", [M("ăn", "我喜欢吃米饭。", "Wǒ xǐhuan chī mǐfàn.", "Tôi thích ăn cơm.", "Động từ")], { compounds: js([{ hanzi: "吃饭", sinoVietnamese: "cật phạn" }, { hanzi: "好吃", sinoVietnamese: "hảo cật" }]) })], { radical: "口", strokeCount: 6 }),
  V("喝", 1, [P("hē", "hát", "Động từ", [M("uống", "请喝茶。", "Qǐng hē chá.", "Mời uống trà.", "Động từ")])], { radical: "口", strokeCount: 12 }),
  V("水", 1, [P("shuǐ", "thủy", "Danh từ", [M("nước", "我要喝水。", "Wǒ yào hē shuǐ.", "Tôi muốn uống nước.", "Danh từ")], { measureWord: "杯 [bēi], 瓶 [píng]", compounds: js([{ hanzi: "水果", sinoVietnamese: "thủy quả" }, { hanzi: "热水", sinoVietnamese: "nhiệt thủy" }]) })], { radical: "水", strokeCount: 4, strokes: "竖钩、横撇、撇、捺" }),
  V("谢谢", 1, [P("xièxie", "tạ tạ", "Động từ", [M("cảm ơn", "谢谢你的帮助。", "Xièxie nǐ de bāngzhù.", "Cảm ơn sự giúp đỡ của bạn.", "Động từ")])]),
  V("不", 1, [P("bù", "bất", "Phó từ", [M("không (phủ định)", "我不喝咖啡。", "Wǒ bù hē kāfēi.", "Tôi không uống cà phê.", "Phó từ")], { notes: "Đọc bú (thanh 2) khi đứng trước âm tiết thanh 4: 不是 (bú shì)." })], { radical: "一", strokeCount: 4, strokes: "横、撇、竖、点" }),
  V("大", 1, [P("dà", "đại", "Tính từ", [M("to, lớn", "这个苹果很大。", "Zhè ge píngguǒ hěn dà.", "Quả táo này rất to.", "Tính từ")], { antonyms: js([{ hanzi: "小", pinyin: "xiǎo" }]), compounds: js([{ hanzi: "大学", sinoVietnamese: "đại học" }, { hanzi: "大家", sinoVietnamese: "đại gia" }]) })], { radical: "大", strokeCount: 3, strokes: "横、撇、捺", etymologyStory: "Hình người dang hai tay hai chân: to lớn." }),
  V("小", 1, [P("xiǎo", "tiểu", "Tính từ", [M("nhỏ, bé", "我家的狗很小。", "Wǒ jiā de gǒu hěn xiǎo.", "Con chó nhà tôi rất nhỏ.", "Tính từ")], { antonyms: js([{ hanzi: "大", pinyin: "dà" }]), compounds: js([{ hanzi: "小姐", sinoVietnamese: "tiểu thư" }, { hanzi: "小学", sinoVietnamese: "tiểu học" }]) })], { radical: "小", strokeCount: 3, strokes: "竖钩、点、点" }),
  V("书", 1, [P("shū", "thư", "Danh từ", [M("sách", "这是我的书。", "Zhè shì wǒ de shū.", "Đây là sách của tôi.", "Danh từ")], { measureWord: "本 [běn]", compounds: js([{ hanzi: "书店", sinoVietnamese: "thư điếm" }, { hanzi: "读书", sinoVietnamese: "độc thư" }]) })], { radical: "乙", strokeCount: 4, strokes: "横折、横折钩、竖、点" }),
  // ---- HSK 2 ----
  V("时间", 2, [P("shíjiān", "thời gian", "Danh từ", [M("thời gian", "你有时间吗？", "Nǐ yǒu shíjiān ma?", "Bạn có thời gian không?", "Danh từ")], { measureWord: "段 [duàn]" })]),
  V("因为", 2, [P("yīnwèi", "nhân vị", "Liên từ", [M("bởi vì", "因为下雨，所以我没去。", "Yīnwèi xià yǔ, suǒyǐ wǒ méi qù.", "Vì mưa nên tôi không đi.", "Liên từ")], { notes: "Thường đi với 所以 (suǒyǐ) tạo cặp nguyên nhân – kết quả." })]),
  V("便宜", 2, [P("piányi", "tiện nghi", "Tính từ", [M("rẻ", "这件衣服很便宜。", "Zhè jiàn yīfu hěn piányi.", "Chiếc áo này rất rẻ.", "Tính từ")], { antonyms: js([{ hanzi: "贵", pinyin: "guì" }]) })]),
  V("贵", 2, [P("guì", "quý", "Tính từ", [M("đắt", "太贵了！", "Tài guì le!", "Đắt quá!", "Tính từ"), M("quý (kính ngữ)", "您贵姓？", "Nín guì xìng?", "Ngài họ gì?", "Tính từ")], { antonyms: js([{ hanzi: "便宜", pinyin: "piányi" }]) })], { radical: "贝", strokeCount: 9 }),
  V("开始", 2, [P("kāishǐ", "khai thủy", "Động từ", [M("bắt đầu", "我们开始上课吧。", "Wǒmen kāishǐ shàngkè ba.", "Chúng ta bắt đầu học nhé.", "Động từ")], { antonyms: js([{ hanzi: "结束", pinyin: "jiéshù" }]) })]),
  V("旅游", 2, [P("lǚyóu", "lữ du", "Động từ", [M("du lịch", "我想去中国旅游。", "Wǒ xiǎng qù Zhōngguó lǚyóu.", "Tôi muốn đi du lịch Trung Quốc.", "Động từ")])]),
  V("希望", 2, [P("xīwàng", "hy vọng", "Động từ,Danh từ", [M("hy vọng, mong", "我希望你明天来。", "Wǒ xīwàng nǐ míngtiān lái.", "Tôi mong mai bạn đến.", "Động từ"), M("niềm hy vọng", "孩子是我们的希望。", "Háizi shì wǒmen de xīwàng.", "Con trẻ là hy vọng của chúng ta.", "Danh từ")])]),
  V("身体", 2, [P("shēntǐ", "thân thể", "Danh từ", [M("thân thể; sức khỏe", "他身体很好。", "Tā shēntǐ hěn hǎo.", "Sức khỏe anh ấy rất tốt.", "Danh từ")])]),
  V("牛奶", 2, [P("niúnǎi", "ngưu nãi", "Danh từ", [M("sữa bò", "我每天早上喝牛奶。", "Wǒ měitiān zǎoshang hē niúnǎi.", "Mỗi sáng tôi uống sữa.", "Danh từ")], { measureWord: "杯 [bēi], 瓶 [píng]" })]),
  V("长", 2, [
    P("cháng", "trường", "Tính từ", [M("dài", "这条路很长。", "Zhè tiáo lù hěn cháng.", "Con đường này rất dài.", "Tính từ")], { antonyms: js([{ hanzi: "短", pinyin: "duǎn" }]), compounds: js([{ hanzi: "长城", sinoVietnamese: "Trường Thành" }]) }),
    P("zhǎng", "trưởng", "Động từ", [M("lớn lên, mọc", "孩子长得很快。", "Háizi zhǎng de hěn kuài.", "Trẻ con lớn rất nhanh.", "Động từ")], { compounds: js([{ hanzi: "校长", sinoVietnamese: "hiệu trưởng" }]), notes: "Đa âm: cháng (dài) / zhǎng (lớn lên, người đứng đầu)." }),
  ], { radical: "长", strokeCount: 4, strokes: "撇、横、竖提、捺" }),
  V("慢", 2, [P("màn", "mạn", "Tính từ", [M("chậm", "请说慢一点。", "Qǐng shuō màn yìdiǎn.", "Xin nói chậm một chút.", "Tính từ")], { antonyms: js([{ hanzi: "快", pinyin: "kuài" }]) })], { radical: "忄", strokeCount: 14 }),
  V("快", 2, [P("kuài", "khoái", "Tính từ,Phó từ", [M("nhanh", "他跑得很快。", "Tā pǎo de hěn kuài.", "Anh ấy chạy rất nhanh.", "Tính từ"), M("sắp, mau", "快下雨了。", "Kuài xià yǔ le.", "Sắp mưa rồi.", "Phó từ")], { antonyms: js([{ hanzi: "慢", pinyin: "màn" }]) })], { radical: "忄", strokeCount: 7 }),
  // ---- HSK 3 ----
  V("环境", 3, [P("huánjìng", "hoàn cảnh", "Danh từ", [M("môi trường", "我们要保护环境。", "Wǒmen yào bǎohù huánjìng.", "Chúng ta phải bảo vệ môi trường.", "Danh từ")])]),
  V("文化", 3, [P("wénhuà", "văn hóa", "Danh từ", [M("văn hóa", "我对中国文化很感兴趣。", "Wǒ duì Zhōngguó wénhuà hěn gǎn xìngqù.", "Tôi rất hứng thú với văn hóa Trung Quốc.", "Danh từ")])]),
  V("历史", 3, [P("lìshǐ", "lịch sử", "Danh từ", [M("lịch sử", "北京是一座有历史的城市。", "Běijīng shì yí zuò yǒu lìshǐ de chéngshì.", "Bắc Kinh là thành phố có lịch sử.", "Danh từ")])]),
  V("节日", 3, [P("jiérì", "tiết nhật", "Danh từ", [M("ngày lễ", "春节是中国最重要的节日。", "Chūnjié shì Zhōngguó zuì zhòngyào de jiérì.", "Tết Nguyên đán là ngày lễ quan trọng nhất của Trung Quốc.", "Danh từ")], { measureWord: "个 [gè]" })]),
  V("习惯", 3, [P("xíguàn", "tập quán", "Danh từ,Động từ", [M("thói quen", "早起是一个好习惯。", "Zǎo qǐ shì yí ge hǎo xíguàn.", "Dậy sớm là một thói quen tốt.", "Danh từ"), M("quen với", "我已经习惯这里的生活了。", "Wǒ yǐjīng xíguàn zhèlǐ de shēnghuó le.", "Tôi đã quen với cuộc sống ở đây.", "Động từ")])]),
  V("影响", 3, [P("yǐngxiǎng", "ảnh hưởng", "Động từ,Danh từ", [M("ảnh hưởng", "天气影响了我的心情。", "Tiānqì yǐngxiǎng le wǒ de xīnqíng.", "Thời tiết ảnh hưởng tâm trạng của tôi.", "Động từ")])]),
  V("行", 3, [
    P("xíng", "hành", "Động từ", [M("đi; được, ổn", "行，我们走吧。", "Xíng, wǒmen zǒu ba.", "Được, chúng ta đi thôi.", "Động từ")], { compounds: js([{ hanzi: "旅行", sinoVietnamese: "lữ hành" }]) }),
    P("háng", "hàng", "Danh từ", [M("hàng, dòng; ngành nghề", "这一行有十个字。", "Zhè yì háng yǒu shí ge zì.", "Dòng này có mười chữ.", "Danh từ")], { compounds: js([{ hanzi: "银行", sinoVietnamese: "ngân hàng" }]), notes: "Đa âm: xíng (đi, được) / háng (hàng, ngành)." }),
  ], { radical: "行", strokeCount: 6 }),
  V("教", 3, [
    P("jiāo", "giao", "Động từ", [M("dạy", "王老师教我们汉语。", "Wáng lǎoshī jiāo wǒmen Hànyǔ.", "Thầy Vương dạy chúng tôi tiếng Trung.", "Động từ")]),
    P("jiào", "giáo", "Danh từ", [M("giáo dục; tôn giáo", "教育很重要。", "Jiàoyù hěn zhòngyào.", "Giáo dục rất quan trọng.", "Danh từ")], { compounds: js([{ hanzi: "教育", sinoVietnamese: "giáo dục" }, { hanzi: "教室", sinoVietnamese: "giáo thất" }]) }),
  ], { radical: "攵", strokeCount: 11 }),
  V("简单", 3, [P("jiǎndān", "giản đơn", "Tính từ", [M("đơn giản", "这个问题很简单。", "Zhè ge wèntí hěn jiǎndān.", "Vấn đề này rất đơn giản.", "Tính từ")], { antonyms: js([{ hanzi: "复杂", pinyin: "fùzá" }]) })]),
  V("努力", 3, [P("nǔlì", "nỗ lực", "Động từ,Tính từ", [M("nỗ lực, cố gắng", "他学习很努力。", "Tā xuéxí hěn nǔlì.", "Anh ấy học rất chăm chỉ.", "Tính từ")])]),
  V("突然", 3, [P("tūrán", "đột nhiên", "Phó từ", [M("đột nhiên, bỗng", "天突然下起雨来。", "Tiān tūrán xià qǐ yǔ lái.", "Trời đột nhiên đổ mưa.", "Phó từ")])]),
  V("安静", 3, [P("ānjìng", "an tĩnh", "Tính từ", [M("yên tĩnh", "图书馆里很安静。", "Túshūguǎn lǐ hěn ānjìng.", "Trong thư viện rất yên tĩnh.", "Tính từ")], { antonyms: js([{ hanzi: "热闹", pinyin: "rènao" }]) })]),
  // ---- HSK 4 ----
  V("经济", 4, [P("jīngjì", "kinh tế", "Danh từ", [M("kinh tế", "中国的经济发展很快。", "Zhōngguó de jīngjì fāzhǎn hěn kuài.", "Kinh tế Trung Quốc phát triển rất nhanh.", "Danh từ")])]),
  V("态度", 4, [P("tàidu", "thái độ", "Danh từ", [M("thái độ", "他的工作态度很认真。", "Tā de gōngzuò tàidu hěn rènzhēn.", "Thái độ làm việc của anh ấy rất nghiêm túc.", "Danh từ")])]),
  V("丰富", 4, [P("fēngfù", "phong phú", "Tính từ", [M("phong phú, dồi dào", "他的经验很丰富。", "Tā de jīngyàn hěn fēngfù.", "Kinh nghiệm của anh ấy rất phong phú.", "Tính từ")])]),
  V("解释", 4, [P("jiěshì", "giải thích", "Động từ", [M("giải thích", "请你解释一下这个词。", "Qǐng nǐ jiěshì yíxià zhè ge cí.", "Bạn giải thích từ này một chút.", "Động từ")])]),
  V("竞争", 4, [P("jìngzhēng", "cạnh tranh", "Động từ,Danh từ", [M("cạnh tranh", "市场竞争很激烈。", "Shìchǎng jìngzhēng hěn jīliè.", "Cạnh tranh thị trường rất gay gắt.", "Danh từ")])]),
  V("保护", 4, [P("bǎohù", "bảo hộ", "Động từ", [M("bảo vệ", "我们应该保护环境。", "Wǒmen yīnggāi bǎohù huánjìng.", "Chúng ta nên bảo vệ môi trường.", "Động từ")])]),
  V("诚实", 4, [P("chéngshí", "thành thực", "Tính từ", [M("thành thật", "他是一个诚实的人。", "Tā shì yí ge chéngshí de rén.", "Anh ấy là một người thành thật.", "Tính từ")])]),
  V("乐", 4, [
    P("lè", "lạc", "Tính từ", [M("vui, vui vẻ", "他乐得跳了起来。", "Tā lè de tiào le qǐlái.", "Anh ấy vui đến nhảy cẫng lên.", "Tính từ")], { compounds: js([{ hanzi: "快乐", sinoVietnamese: "khoái lạc" }]) }),
    P("yuè", "nhạc", "Danh từ", [M("âm nhạc", "我喜欢听音乐。", "Wǒ xǐhuan tīng yīnyuè.", "Tôi thích nghe nhạc.", "Danh từ")], { compounds: js([{ hanzi: "音乐", sinoVietnamese: "âm nhạc" }]) }),
  ], { radical: "丿", strokeCount: 5, status: "draft" }),
  V("距离", 4, [P("jùlí", "cự ly", "Danh từ", [M("khoảng cách", "学校和我家的距离很近。", "Xuéxiào hé wǒ jiā de jùlí hěn jìn.", "Khoảng cách từ trường đến nhà tôi rất gần.", "Danh từ")])]),
  // ---- HSK 5 ----
  V("承认", 5, [P("chéngrèn", "thừa nhận", "Động từ", [M("thừa nhận", "他承认自己错了。", "Tā chéngrèn zìjǐ cuò le.", "Anh ấy thừa nhận mình sai.", "Động từ")])]),
  V("促进", 5, [P("cùjìn", "xúc tiến", "Động từ", [M("thúc đẩy", "贸易促进了经济发展。", "Màoyì cùjìn le jīngjì fāzhǎn.", "Thương mại thúc đẩy phát triển kinh tế.", "Động từ")])]),
  V("培养", 5, [P("péiyǎng", "bồi dưỡng", "Động từ", [M("bồi dưỡng, nuôi dưỡng", "学校注重培养学生的能力。", "Xuéxiào zhùzhòng péiyǎng xuésheng de nénglì.", "Nhà trường chú trọng bồi dưỡng năng lực học sinh.", "Động từ")])]),
  V("观念", 5, [P("guānniàn", "quan niệm", "Danh từ", [M("quan niệm", "年轻人的观念变了。", "Niánqīngrén de guānniàn biàn le.", "Quan niệm của người trẻ đã thay đổi.", "Danh từ")])]),
  V("谨慎", 5, [P("jǐnshèn", "cẩn thận", "Tính từ", [M("thận trọng", "做决定要谨慎。", "Zuò juédìng yào jǐnshèn.", "Ra quyết định phải thận trọng.", "Tính từ")])]),
  V("矛盾", 5, [P("máodùn", "mâu thuẫn", "Danh từ,Tính từ", [M("mâu thuẫn", "他们之间有矛盾。", "Tāmen zhī jiān yǒu máodùn.", "Giữa họ có mâu thuẫn.", "Danh từ")])]),
  // ---- HSK 6 ----
  V("氛围", 6, [P("fēnwéi", "phân vi", "Danh từ", [M("bầu không khí", "会场的氛围很热烈。", "Huìchǎng de fēnwéi hěn rèliè.", "Bầu không khí hội trường rất sôi nổi.", "Danh từ")])], { status: "draft" }),
  V("逐步", 6, [P("zhúbù", "trục bộ", "Phó từ", [M("từng bước, dần dần", "情况逐步好转。", "Qíngkuàng zhúbù hǎozhuǎn.", "Tình hình dần chuyển biến tốt.", "Phó từ")])]),
  V("弥补", 6, [P("míbǔ", "mi bổ", "Động từ", [M("bù đắp", "他努力弥补自己的过错。", "Tā nǔlì míbǔ zìjǐ de guòcuò.", "Anh ấy cố gắng bù đắp lỗi lầm của mình.", "Động từ")])]),
  V("卓越", 6, [P("zhuóyuè", "trác việt", "Tính từ", [M("xuất sắc, vượt trội", "她取得了卓越的成绩。", "Tā qǔdé le zhuóyuè de chéngjì.", "Cô ấy đạt thành tích xuất sắc.", "Tính từ")])]),
  V("融洽", 6, [P("róngqià", "dung hợp", "Tính từ", [M("hòa hợp, hòa thuận", "他们关系很融洽。", "Tāmen guānxi hěn róngqià.", "Quan hệ của họ rất hòa hợp.", "Tính từ")])]),
  V("障碍", 6, [P("zhàng'ài", "chướng ngại", "Danh từ", [M("chướng ngại, trở ngại", "语言是交流的障碍。", "Yǔyán shì jiāoliú de zhàng'ài.", "Ngôn ngữ là trở ngại của giao tiếp.", "Danh từ")])], { status: "draft" }),
];

const E2E_WORDS = [
  V("你好", 1, [P("nǐ hǎo", "nhĩ hảo", "Thán từ", [M("xin chào", "你好！", "Nǐ hǎo!", "Xin chào!", "Thán từ")])]),
  V("谢谢", 1, [P("xièxie", "tạ tạ", "Động từ", [M("cảm ơn", "谢谢你。", "Xièxie nǐ.", "Cảm ơn bạn.", "Động từ")])]),
  V("人", 1, [P("rén", "nhân", "Danh từ", [M("người", "三个人", "sān ge rén", "ba người", "Danh từ")], { measureWord: "个 [gè]" })], { radical: "人", strokeCount: 2 }),
];

let db = null;
let seq = 0;

const profile = () => state.data?.profile ?? PROFILE;
const now = () => new Date().toISOString();

/** Gán id số cho từ/pinyin/nghĩa, bảo đảm đúng một pinyin chính (như backend cũ). */
function materialize(raw, id, createdAt) {
  let pinyinSeq = 0;
  let meaningSeq = 0;
  const pinyins = (raw.pinyins ?? []).map((p) => ({ ...p, id: id * 100 + ++pinyinSeq, meanings: (p.meanings ?? []).map((m) => ({ ...m, id: id * 1000 + ++meaningSeq })) }));
  if (pinyins.length > 0 && !pinyins.some((p) => p.isPrimary === true)) pinyins[0].isPrimary = true;
  return { ...raw, id, pinyins, createdAt, updatedAt: createdAt };
}

function seed() {
  const base = Date.UTC(2026, 8, 1);
  const source = profile() === "demo" ? DEMO_WORDS : E2E_WORDS;
  seq = 0;
  db = source.map((raw, i) => materialize(raw, ++seq, new Date(base + i * 3_600_000).toISOString()));
}
const ensure = () => db ?? (seed(), db);
registerResettable(() => seed());

// ---------- helper ----------
const str = (v) => (typeof v === "string" ? v.trim() : "");
const lower = (v) => str(v).toLowerCase();
/** Bỏ dấu thanh/dấu tiếng Việt để "hao" khớp "hǎo", "hoc sinh" khớp "học sinh" (backend thật quyết định; mock cho dễ demo). */
const plain = (v) => lower(v).normalize("NFD").replace(/[̀-ͯ]/g, "");
const badRequest = (ctx, message) => send(ctx.req, ctx.res, 400, fail("VALIDATION_ERROR", `${message} (MOCK)`));
const notFound = (ctx) => send(ctx.req, ctx.res, 404, fail("404", "Không tìm thấy từ vựng (MOCK)"));

/** Lọc theo tham số tìm kiếm của bản cũ: keySearch khớp Hán tự/pinyin/Hán Việt/nghĩa; hskLevel; isSingleVocab; wordType (của bất kỳ pinyin); radical. */
function filterVocabs(list, q) {
  const key = plain(q.get("keySearch"));
  const level = Number(q.get("hskLevel"));
  const single = q.get("isSingleVocab");
  const wordType = str(q.get("wordType"));
  const radical = str(q.get("radical"));
  return list
    .filter((v) => !key || v.hanzi.includes(key) || (v.pinyins ?? []).some((p) => plain(p.pinyin).includes(key) || plain(p.sinoVietnamese).includes(key) || (p.meanings ?? []).some((m) => plain(m.meaning).includes(key))))
    .filter((v) => !HSK_LEVELS.includes(level) || v.hskLevel === level)
    .filter((v) => single === null || single === "" || v.isSingleVocab === (single === "true"))
    .filter((v) => !wordType || (v.pinyins ?? []).some((p) => str(p.wordTypes).split(",").map((t) => t.trim()).includes(wordType)))
    .filter((v) => !radical || (v.radical ?? "").includes(radical))
    .sort((a, b) => (a.hskLevel ?? 0) - (b.hskLevel ?? 0) || a.id - b.id);
}

/** Lỗi 400/409 đầu tiên của thân tạo/sửa, hoặc null. */
function validate(body, list, exceptId) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { status: 400, code: "VALIDATION_ERROR", message: "Thân yêu cầu không hợp lệ (MOCK)" };
  const hanzi = str(body.hanzi);
  if (!hanzi) return { status: 400, code: "VALIDATION_ERROR", message: "Hán tự là bắt buộc (MOCK)" };
  if (body.hskLevel !== undefined && body.hskLevel !== null && !HSK_LEVELS.includes(Number(body.hskLevel))) return { status: 400, code: "VALIDATION_ERROR", message: "hskLevel phải từ 1 đến 6 (MOCK)" };
  if (!Array.isArray(body.pinyins) || body.pinyins.length === 0) return { status: 400, code: "VALIDATION_ERROR", message: "Cần ít nhất một pinyin (MOCK)" };
  for (const p of body.pinyins) {
    if (!p || !str(p.pinyin)) return { status: 400, code: "VALIDATION_ERROR", message: "Mỗi pinyin phải có phiên âm (MOCK)" };
    if (!Array.isArray(p.meanings) || p.meanings.length === 0 || p.meanings.some((m) => !m || !str(m.meaning))) return { status: 400, code: "VALIDATION_ERROR", message: `Pinyin "${str(p.pinyin)}" cần ít nhất một nghĩa, nghĩa không được rỗng (MOCK)` };
  }
  if (body.strokeCount !== undefined && body.strokeCount !== null && !(Number.isInteger(Number(body.strokeCount)) && Number(body.strokeCount) > 0)) return { status: 400, code: "VALIDATION_ERROR", message: "Số nét phải là số nguyên dương (MOCK)" };
  if (list.some((v) => v.id !== exceptId && v.hanzi === hanzi)) return { status: 409, code: "DUPLICATE_HANZI", message: `Từ "${hanzi}" đã có trong từ điển (MOCK)` };
  return null;
}

/** Thân đã kiểm tra → bản ghi (bỏ trường hệ thống do client gửi nhầm). */
function fromBody(body) {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = body;
  return {
    ...rest,
    hanzi: str(body.hanzi),
    hskLevel: body.hskLevel === undefined || body.hskLevel === null ? undefined : Number(body.hskLevel),
    isSingleVocab: body.isSingleVocab === undefined ? [...str(body.hanzi)].length === 1 : Boolean(body.isSingleVocab),
    status: lower(body.status) === "published" ? "published" : "draft",
    pinyins: body.pinyins.map((p) => ({ ...p, pinyin: str(p.pinyin), isPrimary: p.isPrimary === true, meanings: p.meanings.map((m) => ({ ...m, meaning: str(m.meaning) })) })),
  };
}

// ---------- handler ----------
export async function handle(ctx) {
  const { req, res, url, method } = ctx;
  if (url.pathname !== PREFIX && !url.pathname.startsWith(`${PREFIX}/`)) return false;
  const sub = url.pathname.slice(PREFIX.length).replace(/\/+$/, "");
  const q = url.searchParams;
  const s = ctx.session();
  if (!s) return send(req, res, 401, fail("UNAUTHORIZED", "Chưa đăng nhập (MOCK)")), true;
  const canWrite = s.roles.some((r) => WRITE_ROLES.includes(r));
  const forbid = () => (send(req, res, 403, fail("FORBIDDEN", "Không có quyền ghi từ điển (MOCK)")), true);
  const list = ensure();
  count("dictionary");

  if (sub === "/search" && method === "GET") return respondWithApiState(ctx, () => paginate(filterVocabs(list, q), q, 10)), true;

  if (sub === "/import" || sub.startsWith("/import/")) return send(req, res, 501, fail("NOT_IMPLEMENTED", "Import Excel từ điển chưa chuyển sang bản mới (MOCK)")), true;

  if (sub === "" && method === "POST") {
    if (!canWrite) return forbid();
    const body = await readBody(req);
    const error = validate(body, list, null);
    if (error) return send(req, res, error.status, fail(error.code, error.message)), true;
    const vocab = materialize(fromBody(body), ++seq, now());
    db.push(vocab);
    return send(req, res, 201, ok(vocab)), true;
  }

  const m = sub.match(/^\/([^/]+)$/);
  if (!m) return send(req, res, 404, fail("404", `MOCK dictionary: không có endpoint ${method} ${url.pathname}`)), true;
  const id = Number(decodeURIComponent(m[1]));
  const vocab = Number.isInteger(id) ? list.find((v) => v.id === id) : undefined;

  if (method === "GET") return vocab ? (send(req, res, 200, ok(vocab)), true) : (notFound(ctx), true);
  if (method === "PUT") {
    if (!canWrite) return forbid();
    if (!vocab) return notFound(ctx), true;
    const body = await readBody(req);
    const error = validate(body, list, vocab.id);
    if (error) return send(req, res, error.status, fail(error.code, error.message)), true;
    const next = materialize(fromBody(body), vocab.id, vocab.createdAt);
    next.updatedAt = now();
    db[db.indexOf(vocab)] = next;
    return send(req, res, 200, ok(next)), true;
  }
  if (method === "DELETE") {
    if (!canWrite) return forbid();
    if (!vocab) return notFound(ctx), true;
    db = db.filter((v) => v.id !== vocab.id);
    return send(req, res, 200, ok({ deleted: vocab.id })), true;
  }
  return badRequest(ctx, `Phương thức ${method} không hỗ trợ`), true;
}
