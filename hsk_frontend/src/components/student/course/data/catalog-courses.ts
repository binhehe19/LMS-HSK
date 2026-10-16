/**
 * Dữ liệu bổ trợ cho trang "Khoá học" (Figma node 3362:9518 / 3484:13127).
 *
 * NGUỒN CHÍNH là API `getCourses()` (danh sách khoá đã đồng bộ ở trang quản trị
 * /learning-path/online-course/manage): tên, mô tả, giá, level, số bài, thumbnail.
 *
 * File này CHỈ giữ những thứ API không có:
 *   - ảnh bìa theo thiết kế (tải sẵn về public/assets/hocba/courses)
 *   - danh mục để gom nhóm section
 *   - đối tượng học viên (nhãn biên tập, không có trong API)
 *
 * `CATALOG_COURSES` chỉ còn dùng làm dữ liệu dự phòng khi API chưa trả về khoá nào,
 * để trang không trống trơn — không phải nguồn hiển thị chính.
 */

export type CategoryId = 'hsk' | 'di-lam' | 'cong-xuong' | 'gia-su' | 'video-online' | 'b2b';
export type AudienceId = 'hoc-sinh' | 'tre-em' | 'nguoi-di-lam' | 'tu-do';
export type StudyFormId = 'online-tu-hoc' | 'online-ket-hop' | 'offline';

export interface CourseCategory {
    id: CategoryId;
    /** Nhãn trong sidebar "Danh mục" */
    filterLabel: string;
    /** Tiêu đề section trong lưới khoá học */
    sectionTitle: string;
    mobileTitle: string;
    /** Chữ trong pill trước tiêu đề section */
    badgeLabel: string;
    /** Biến thể màu pill + tiêu đề, xem student-course.scss */
    tone: 'hsk' | 'gt' | 'cx' | 'gs' | 'video';
}

export interface CatalogCourse {
    code: string;
    /** Dòng chữ đứng sau "KHOÁ" trên card */
    cardLabel: string;
    /** Tiêu đề trong modal chi tiết */
    title: string;
    category: CategoryId;
    audiences: AudienceId[];
    studyForm: StudyFormId;
    price: number;
    levelIn: string;
    levelOut: string;
    totalSessions: number;
    months: number;
    hoursPerSession: number;
    description: string;
    image: string;
    /** Thứ tự xuất hiện trong lưới, dùng cho sort "Mới nhất" */
    releasedAt: string;
    /**
     * Trạng thái minh hoạ khi chưa ghép được với API.
     * Khi khoá có trong danh sách đã đăng ký, progress thật sẽ ghi đè giá trị này.
     */
    demoOwned: boolean;
    demoProgress: number;
    demoDoneSessions: number;
}

export const COURSE_CATEGORIES: CourseCategory[] = [
    { id: 'hsk', filterLabel: 'HSK', sectionTitle: 'HSK 9 CẤP', mobileTitle: 'HSK 9 cấp', badgeLabel: 'HSK', tone: 'hsk' },
    { id: 'di-lam', filterLabel: 'Tiếng Trung cho người đi làm', sectionTitle: 'TIẾNG TRUNG CHO NGƯỜI ĐI LÀM', mobileTitle: 'Tiếng Trung Cho Người Đi Làm', badgeLabel: 'GT', tone: 'gt' },
    { id: 'cong-xuong', filterLabel: 'Tiếng Trung công xưởng', sectionTitle: 'TIẾNG TRUNG CÔNG XƯỞNG', mobileTitle: 'Tiếng Trung Công Xưởng', badgeLabel: 'CX', tone: 'cx' },
    { id: 'gia-su', filterLabel: 'Tiếng Trung Gia sư 1:1', sectionTitle: 'TIẾNG TRUNG GIA SƯ', mobileTitle: 'Tiếng Trung Gia Sư', badgeLabel: 'GS', tone: 'gs' },
    { id: 'video-online', filterLabel: 'Tiếng Trung Online', sectionTitle: 'VIDEO ONLINE CHỦ ĐỘNG', mobileTitle: 'Video Online Chủ Động', badgeLabel: 'VIDEO ON', tone: 'video' },
    { id: 'b2b', filterLabel: 'Tiếng Trung B2B', sectionTitle: 'TIẾNG TRUNG B2B', mobileTitle: 'Tiếng Trung B2B', badgeLabel: 'B2B', tone: 'gt' },
];

export const AUDIENCES: { id: AudienceId; label: string }[] = [
    { id: 'hoc-sinh', label: 'Học sinh - sinh viên' },
    { id: 'tre-em', label: 'Trẻ em' },
    { id: 'nguoi-di-lam', label: 'Người đi làm' },
    { id: 'tu-do', label: 'Tự do' },
];

export const STUDY_FORMS: { id: StudyFormId; label: string }[] = [
    { id: 'online-tu-hoc', label: 'Online tự học' },
    { id: 'online-ket-hop', label: 'Online kết hợp' },
    { id: 'offline', label: 'Offline' },
];

export const PRICE_MAX = 2_000_000;

const IMG = '/assets/hocba/courses';

/** Ảnh mặc định cho mỗi danh mục, dùng khi khoá từ API không khớp mã nào có sẵn. */
export const CATEGORY_FALLBACK_IMAGE: Record<CategoryId, string> = {
    hsk: `${IMG}/hsk-h20.jpg`,
    'di-lam': `${IMG}/gt-gt1.jpg`,
    'cong-xuong': `${IMG}/cx-cx11.jpg`,
    'gia-su': `${IMG}/gs-hsk.jpg`,
    'video-online': `${IMG}/video-hsk.jpg`,
    b2b: `${IMG}/gt-gt1.jpg`,
};

/**
 * Khoá đồng bộ từ CMS không có trường danh mục, nên gom nhóm dựa vào mã/tên khoá.
 * Thứ tự kiểm tra quan trọng: "GS"/"gia sư" phải đứng trước "GT" vì tên khoá gia sư
 * cũng có thể chứa chữ "giao tiếp".
 */
export const inferCategory = (code?: string, name?: string): CategoryId => {
    const text = `${code ?? ''} ${name ?? ''}`.toUpperCase();

    if (/\bB2B\b|DOANH\s*NGHIỆP|CORPORATE/.test(text)) return 'b2b';
    if (/\bGS\b|GIA\s*S/.test(text)) return 'gia-su';
    if (/\bON\b|VIDEO|ONLINE/.test(text)) return 'video-online';
    if (/\bCX\b|C[ÔO]NG\s*X/.test(text)) return 'cong-xuong';
    if (/\bGT\d|GIAO\s*TI|V[ĂA]N\s*PH[ÒO]NG|TH[ƯU]{0,1}[ƠO]NG\s*M|DOANH\s*NH/.test(text)) return 'di-lam';
    return 'hsk';
};

const HSK_DESC = (level: string, lessons: number) =>
    `Khóa ${level} gồm ${lessons} bài học được thiết kế bám sát khung năng lực Hán ngữ quốc tế, ` +
    `kết hợp từ vựng, ngữ pháp, luyện nghe – nói – đọc – viết và hệ thống bài tập thực hành theo từng buổi học.`;

export const CATALOG_COURSES: CatalogCourse[] = [
    // ── HSK 9 CẤP ────────────────────────────────────────────────────────────
    {
        code: 'H20', cardLabel: 'H20', title: 'KHOÁ HỌC 0 - HSK2',
        category: 'hsk', audiences: ['hoc-sinh', 'tu-do'], studyForm: 'online-ket-hop',
        price: 1_200_000, levelIn: '0', levelOut: 'HSK2',
        totalSessions: 48, months: 3, hoursPerSession: 2,
        description: 'Khóa học 0 – HSK2 gồm hơn 30 bài học cơ bản, giúp học viên làm quen với hệ thống chữ Hán và thực hành viết chữ Hán cơ bản, 50 bộ thủ thường gặp, học ngữ âm tiếng Trung (phiên âm, thanh mẫu, vận mẫu, thanh điệu, quy tắc biến điệu), ngữ pháp và mẫu câu nền tảng trong giao tiếp đời sống hàng ngày',
        image: `${IMG}/hsk-h20.jpg`, releasedAt: '2026-01-05',
        demoOwned: true, demoProgress: 100, demoDoneSessions: 12,
    },
    {
        code: 'H30', cardLabel: 'H30', title: 'KHOÁ HỌC HSK3',
        category: 'hsk', audiences: ['hoc-sinh', 'tu-do'], studyForm: 'online-ket-hop',
        price: 1_400_000, levelIn: 'HSK2', levelOut: 'HSK3',
        totalSessions: 48, months: 3, hoursPerSession: 2,
        description: HSK_DESC('HSK3', 36),
        image: `${IMG}/hsk-h30.png`, releasedAt: '2026-01-10',
        demoOwned: true, demoProgress: 65, demoDoneSessions: 12,
    },
    {
        code: 'H40', cardLabel: 'H40', title: 'KHOÁ HỌC HSK4',
        category: 'hsk', audiences: ['hoc-sinh', 'nguoi-di-lam'], studyForm: 'online-ket-hop',
        price: 1_600_000, levelIn: 'HSK3', levelOut: 'HSK4',
        totalSessions: 48, months: 3, hoursPerSession: 2,
        description: HSK_DESC('HSK4', 38),
        image: `${IMG}/hsk-h40.jpg`, releasedAt: '2026-01-15',
        demoOwned: true, demoProgress: 0, demoDoneSessions: 0,
    },
    {
        code: 'H50', cardLabel: 'H50', title: 'KHOÁ HỌC HSK5',
        category: 'hsk', audiences: ['hoc-sinh', 'nguoi-di-lam'], studyForm: 'online-ket-hop',
        price: 1_800_000, levelIn: 'HSK4', levelOut: 'HSK5',
        totalSessions: 48, months: 3, hoursPerSession: 2,
        description: HSK_DESC('HSK5', 40),
        image: `${IMG}/hsk-h50.jpg`, releasedAt: '2026-01-20',
        demoOwned: true, demoProgress: 0, demoDoneSessions: 0,
    },
    {
        code: 'H60', cardLabel: 'H60', title: 'KHOÁ HỌC HSK6',
        category: 'hsk', audiences: ['hoc-sinh', 'nguoi-di-lam'], studyForm: 'offline',
        price: 2_000_000, levelIn: 'HSK5', levelOut: 'HSK6',
        totalSessions: 48, months: 3, hoursPerSession: 2,
        description: 'Khóa HSK6 gồm 40 bài học chuyên sâu với hệ thống từ vựng, ngữ pháp và mẫu câu nâng cao nhất, giúp học viên rèn luyện năng lực sử dụng tiếng Trung thành thạo trong học tập, nghiên cứu và công việc chuyên nghiệp',
        image: `${IMG}/hsk-h60.jpg`, releasedAt: '2026-01-25',
        demoOwned: false, demoProgress: 0, demoDoneSessions: 0,
    },

    // ── TIẾNG TRUNG CHO NGƯỜI ĐI LÀM ─────────────────────────────────────────
    {
        code: 'GT1', cardLabel: 'GT1', title: 'TIẾNG TRUNG GIAO TIẾP CƠ BẢN',
        category: 'di-lam', audiences: ['nguoi-di-lam', 'tu-do'], studyForm: 'online-ket-hop',
        price: 1_000_000, levelIn: '0', levelOut: 'HSK2',
        totalSessions: 48, months: 3, hoursPerSession: 2,
        description: 'Khoá giao tiếp cơ bản tập trung vào mẫu câu và tình huống thường gặp trong đời sống, giúp người mới bắt đầu tự tin nghe – nói tiếng Trung sau khoá học.',
        image: `${IMG}/gt-gt1.jpg`, releasedAt: '2026-02-01',
        demoOwned: true, demoProgress: 0, demoDoneSessions: 0,
    },
    {
        code: 'GT2', cardLabel: 'GT2', title: 'TIẾNG TRUNG VĂN PHÒNG CÔNG SỞ',
        category: 'di-lam', audiences: ['nguoi-di-lam'], studyForm: 'online-ket-hop',
        price: 1_300_000, levelIn: 'HSK2', levelOut: 'HSK3',
        totalSessions: 48, months: 3, hoursPerSession: 2,
        description: 'Khoá tiếng Trung văn phòng cung cấp từ vựng và mẫu câu dùng trong email, họp hành, báo cáo và giao tiếp nội bộ tại môi trường công sở.',
        image: `${IMG}/gt-gt2.jpg`, releasedAt: '2026-02-05',
        demoOwned: true, demoProgress: 65, demoDoneSessions: 12,
    },
    {
        code: 'GT3', cardLabel: 'GT3', title: 'TIẾNG TRUNG THƯƠNG MẠI',
        category: 'di-lam', audiences: ['nguoi-di-lam'], studyForm: 'online-ket-hop',
        price: 1_500_000, levelIn: 'HSK3', levelOut: 'HSK4',
        totalSessions: 48, months: 3, hoursPerSession: 2,
        description: 'Khoá tiếng Trung thương mại xoay quanh đàm phán, báo giá, hợp đồng và các tình huống giao dịch thực tế với đối tác Trung Quốc.',
        image: `${IMG}/gt-gt3.jpg`, releasedAt: '2026-02-10',
        demoOwned: true, demoProgress: 65, demoDoneSessions: 12,
    },
    {
        code: 'GT4', cardLabel: 'GT4', title: 'TIẾNG TRUNG THƯƠNG MẠI CHUYÊN SÂU',
        category: 'di-lam', audiences: ['nguoi-di-lam'], studyForm: 'offline',
        price: 1_900_000, levelIn: 'HSK4', levelOut: 'HSK5',
        totalSessions: 48, months: 3, hoursPerSession: 2,
        description: 'Phiên bản chuyên sâu của khoá thương mại, đi sâu vào hợp đồng, logistics, thanh toán quốc tế và văn hoá kinh doanh Trung Quốc.',
        image: `${IMG}/gt-gt4.jpg`, releasedAt: '2026-02-15',
        demoOwned: false, demoProgress: 0, demoDoneSessions: 0,
    },
    {
        code: 'GT5', cardLabel: 'GT5', title: 'TIẾNG TRUNG DOANH NHÂN',
        category: 'di-lam', audiences: ['nguoi-di-lam', 'tu-do'], studyForm: 'online-tu-hoc',
        price: 2_000_000, levelIn: 'HSK4', levelOut: 'HSK6',
        totalSessions: 48, months: 3, hoursPerSession: 2,
        description: 'Khoá dành cho lãnh đạo và chủ doanh nghiệp, tập trung vào thuyết trình, gặp gỡ đối tác cấp cao và xây dựng quan hệ kinh doanh dài hạn.',
        image: `${IMG}/gt-gt5.jpg`, releasedAt: '2026-02-20',
        demoOwned: false, demoProgress: 0, demoDoneSessions: 0,
    },

    // ── TIẾNG TRUNG CÔNG XƯỞNG ───────────────────────────────────────────────
    {
        code: 'CX1.1', cardLabel: 'CX1.1', title: 'TIẾNG TRUNG CÔNG XƯỞNG 1',
        category: 'cong-xuong', audiences: ['nguoi-di-lam'], studyForm: 'offline',
        price: 900_000, levelIn: '0', levelOut: 'HSK2',
        totalSessions: 48, months: 3, hoursPerSession: 2,
        description: 'Khoá tiếng Trung công xưởng cấp 1 trang bị từ vựng chuyên ngành sản xuất, an toàn lao động và giao tiếp cơ bản trong nhà máy.',
        image: `${IMG}/cx-cx11.jpg`, releasedAt: '2026-03-01',
        demoOwned: true, demoProgress: 0, demoDoneSessions: 0,
    },
    {
        code: 'CX1.2', cardLabel: 'CX1.2', title: 'TIẾNG TRUNG CÔNG XƯỞNG 2',
        category: 'cong-xuong', audiences: ['nguoi-di-lam'], studyForm: 'offline',
        price: 1_100_000, levelIn: 'HSK2', levelOut: 'HSK3',
        totalSessions: 48, months: 3, hoursPerSession: 2,
        description: 'Tiếp nối cấp 1, khoá học đi sâu vào quy trình vận hành, quản lý ca kíp và trao đổi kỹ thuật với chuyên gia Trung Quốc.',
        image: `${IMG}/cx-cx12.jpg`, releasedAt: '2026-03-05',
        demoOwned: false, demoProgress: 0, demoDoneSessions: 0,
    },

    // ── TIẾNG TRUNG GIA SƯ ───────────────────────────────────────────────────
    {
        code: 'GS-HSK', cardLabel: 'GS HSK', title: 'GIA SƯ 1:1 LUYỆN HSK',
        category: 'gia-su', audiences: ['hoc-sinh', 'tre-em'], studyForm: 'online-ket-hop',
        price: 1_700_000, levelIn: '0', levelOut: 'HSK6',
        totalSessions: 48, months: 3, hoursPerSession: 2,
        description: 'Lộ trình gia sư 1:1 được cá nhân hoá theo trình độ đầu vào, tập trung luyện thi HSK với giáo viên kèm sát từng buổi học.',
        image: `${IMG}/gs-hsk.jpg`, releasedAt: '2026-03-10',
        demoOwned: true, demoProgress: 65, demoDoneSessions: 12,
    },
    {
        code: 'GS-GT', cardLabel: 'GS GT', title: 'GIA SƯ 1:1 GIAO TIẾP',
        category: 'gia-su', audiences: ['tre-em', 'tu-do'], studyForm: 'online-ket-hop',
        price: 1_600_000, levelIn: '0', levelOut: 'HSK4',
        totalSessions: 48, months: 3, hoursPerSession: 2,
        description: 'Gia sư 1:1 luyện phản xạ giao tiếp, sửa phát âm trực tiếp và xây dựng vốn từ theo chủ đề học viên quan tâm.',
        image: `${IMG}/gs-gt.jpg`, releasedAt: '2026-03-15',
        demoOwned: false, demoProgress: 0, demoDoneSessions: 0,
    },

    // ── VIDEO ONLINE CHỦ ĐỘNG ────────────────────────────────────────────────
    {
        code: 'ON-HSK', cardLabel: 'ON HSK', title: 'VIDEO ONLINE HSK',
        category: 'video-online', audiences: ['hoc-sinh', 'tu-do'], studyForm: 'online-tu-hoc',
        price: 500_000, levelIn: '0', levelOut: 'HSK4',
        totalSessions: 48, months: 3, hoursPerSession: 2,
        description: 'Khoá video online chủ động theo lộ trình HSK, học viên tự sắp xếp thời gian và ôn lại bài giảng không giới hạn.',
        image: `${IMG}/video-hsk.jpg`, releasedAt: '2026-03-20',
        demoOwned: true, demoProgress: 65, demoDoneSessions: 12,
    },
    {
        code: 'ON-GT', cardLabel: 'ON GT', title: 'VIDEO ONLINE GIAO TIẾP',
        category: 'video-online', audiences: ['tu-do'], studyForm: 'online-tu-hoc',
        price: 450_000, levelIn: '0', levelOut: 'HSK3',
        totalSessions: 48, months: 3, hoursPerSession: 2,
        description: 'Khoá video giao tiếp chủ động với hệ thống bài giảng ngắn theo tình huống, phù hợp người bận rộn muốn học linh hoạt.',
        image: `${IMG}/video-gt.jpg`, releasedAt: '2026-03-25',
        demoOwned: false, demoProgress: 0, demoDoneSessions: 0,
    },
];
