"use client";

// Chủ đề (topic) của một học phần theo id gói, dùng cho các màn Kho (bài tập, ngữ pháp, từ vựng/thẻ ghi nhớ). Cùng backend và cùng hợp đồng với
// chủ đề ở màn lịch giáo trình (syllabus-schedule-resources-client.ts) nhưng khóa theo gói thay vì theo (giáo trình, loại). Gói của Kho không có buổi
// học nên mọi mục và chủ đề nằm ở buổi 1 (như các client Kho khác).
//
// Backend chỉ ghi chủ đề trên phiên bản NHÁP. Gói đã xuất bản mà chưa có nháp thì lần ghi đầu tiên tạo nháp bằng cách nhân bản, và chủ đề được nhân
// bản với id MỚI (học liệu giữ nguyên id). Vì vậy các thao tác theo chủ đề nhận cả id lẫn tên chủ đề: khi vừa tạo nháp thì tìm lại chủ đề trong
// nháp theo tên (tên chủ đề không trùng trong cùng buổi, không phân biệt hoa thường).
import { lmsClient } from "@/lib/api/lms-client";
import { assertWriteEnabled } from "@/lib/api/write-gate";

const FEATURE = "content";


export interface PackageTopic {
  id: string;
  title: string;
  topicOrder: number;
}
/** Chủ đề đã biết ở phía giao diện: đủ để tìm lại trong bản nháp mới. */
export interface PackageTopicRef {
  id: string;
  title: string;
}
export interface PackageTopicState {
  topics: PackageTopic[];
  /** id học liệu => id chủ đề (chỉ mục thuộc một chủ đề). */
  membership: Record<string, string>;
}

/** Bộ hàm topic một màn Kho cần (xem FlatContentClient.topics). */
export interface PackageTopicsClient {
  list(packageId: string): Promise<PackageTopicState>;
  create(packageId: string, title: string, demo: boolean): Promise<void>;
  rename(packageId: string, topic: PackageTopicRef, title: string, demo: boolean): Promise<void>;
  remove(packageId: string, topic: PackageTopicRef, demo: boolean): Promise<void>;
  /** `topics` theo thứ tự mới của MỌI chủ đề trong gói. */
  reorder(packageId: string, topics: readonly PackageTopicRef[], demo: boolean): Promise<void>;
  /** topic null = bỏ mục khỏi chủ đề. */
  assign(packageId: string, itemId: string, topic: PackageTopicRef | null, demo: boolean): Promise<void>;
}

interface BackendPackage {
  draftVersionId: string | null;
  publishedVersionId: string | null;
}
interface BackendTopic extends PackageTopic {
  sessionNo?: number;
}
interface BackendLink {
  learningResourceId: string;
  topicId?: string | null;
}

const enc = encodeURIComponent;
const key = (title: string) => title.trim().toLowerCase();

export function getPackage(packageId: string) {
  return lmsClient.get<BackendPackage>(`/content-packages/${enc(packageId)}`);
}

/** Phiên bản nháp để ghi; `created` = nháp vừa được tạo (id chủ đề đã đổi so với bản đang xem). Dùng chung với tên buổi (package-sessions-client.ts). */
export async function writableVersion(packageId: string): Promise<{ versionId: string; created: boolean }> {
  const pkg = await getPackage(packageId);
  if (pkg.draftVersionId) return { versionId: pkg.draftVersionId, created: false };
  const draft = await lmsClient.post<{ id: string }>(`/content-packages/${enc(packageId)}/draft`);
  return { versionId: draft.id, created: true };
}

export function packageTopicsForSession(sessionNo: number): PackageTopicsClient {
function listVersionTopics(versionId: string) {
  return lmsClient.get<BackendTopic[]>(`/content-packages/versions/${enc(versionId)}/topics?sessionNo=${sessionNo}`);
}

/** Hàm đổi chủ đề đã biết sang id trong phiên bản ghi được: giữ nguyên id nếu nháp có sẵn, tra theo tên nếu nháp vừa tạo. */
async function resolver(versionId: string, created: boolean): Promise<(topic: PackageTopicRef) => string> {
  if (!created) return (topic) => topic.id;
  const byTitle = new Map((await listVersionTopics(versionId)).map((t) => [key(t.title), t.id]));
  return (topic) => {
    const id = byTitle.get(key(topic.title));
    if (!id) throw new Error(`Không tìm thấy chủ đề "${topic.title}" trong bản nháp.`);
    return id;
  };
}

return {
  async list(packageId) {
    const pkg = await getPackage(packageId);
    const versionId = pkg.draftVersionId ?? pkg.publishedVersionId;
    if (!versionId) return { topics: [], membership: {} };
    const [topics, links] = await Promise.all([listVersionTopics(versionId), lmsClient.get<BackendLink[]>(`/content-packages/versions/${enc(versionId)}/resources?sessionNo=${sessionNo}`)]);
    const membership: Record<string, string> = {};
    for (const link of links) if (link.topicId) membership[link.learningResourceId] = link.topicId;
    return { topics: [...topics].sort((a, b) => a.topicOrder - b.topicOrder).map((t) => ({ id: t.id, title: t.title, topicOrder: t.topicOrder })), membership };
  },

  async create(packageId, title, demo) {
    assertWriteEnabled(FEATURE, demo);
    const { versionId } = await writableVersion(packageId);
    await lmsClient.post(`/content-packages/versions/${enc(versionId)}/topics`, { sessionNo, title });
  },

  async rename(packageId, topic, title, demo) {
    assertWriteEnabled(FEATURE, demo);
    const { versionId, created } = await writableVersion(packageId);
    const idOf = await resolver(versionId, created);
    await lmsClient.put(`/content-packages/versions/${enc(versionId)}/topics/${enc(idOf(topic))}`, { title });
  },

  async remove(packageId, topic, demo) {
    assertWriteEnabled(FEATURE, demo);
    const { versionId, created } = await writableVersion(packageId);
    const idOf = await resolver(versionId, created);
    await lmsClient.delete(`/content-packages/versions/${enc(versionId)}/topics/${enc(idOf(topic))}`);
  },

  async reorder(packageId, topics, demo) {
    assertWriteEnabled(FEATURE, demo);
    const { versionId, created } = await writableVersion(packageId);
    const idOf = await resolver(versionId, created);
    await lmsClient.put(`/content-packages/versions/${enc(versionId)}/topics/reorder`, { sessionNo, topicIdsInOrder: topics.map(idOf) });
  },

  async assign(packageId, itemId, topic, demo) {
    assertWriteEnabled(FEATURE, demo);
    const { versionId, created } = await writableVersion(packageId);
    const topicId = topic ? (await resolver(versionId, created))(topic) : null;
    await lmsClient.put(`/content-packages/versions/${enc(versionId)}/resources/${enc(itemId)}/topic`, { topicId });
  },
};

}
export const packageTopicsClient = packageTopicsForSession(1);
