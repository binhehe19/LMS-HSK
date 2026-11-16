"use client";

// Chủ đề của một gói (Kho) cho giao diện: tải chủ đề + mục thuộc chủ đề nào, và các thao tác thêm/đổi tên/xóa/đổi thứ tự/chuyển mục sang chủ đề
// (mỗi thao tác ghi xong tải lại). Dùng chung cho màn Kho phẳng (use-flat-content.ts) và màn tài liệu học tập. Tải lỗi thì `data` là null và màn vẫn
// hiện mục như trước, chỉ không hiện chủ đề.
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import type { PackageTopicState, PackageTopicsClient } from "@/lib/api/package-topics-client";
import { writeErrorMessage } from "@/lib/content/content-tree-validate";
import type { FlatTopic, FlatTopicUi } from "@/types/content";

export function usePackageTopics(api: PackageTopicsClient | undefined, packageId: string | null, key: string, demo: boolean, onWritten?: () => void) {
  const fetch = useKeyedFetch<PackageTopicState>(packageId && api ? `${key}:topics:${packageId}` : null, () => (api as PackageTopicsClient).list(packageId ?? ""));
  const data = fetch.state.kind === "ok" ? fetch.state.data : null;
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const { reload } = fetch;

  const topicUi: FlatTopicUi | undefined = useMemo(() => {
    if (!api || !packageId || !data) return undefined;
    const counts = new Map<string, number>();
    for (const topicId of Object.values(data.membership)) counts.set(topicId, (counts.get(topicId) ?? 0) + 1);
    const topics: FlatTopic[] = data.topics.map((t) => ({ id: t.id, title: t.title, itemCount: counts.get(t.id) ?? 0 }));
    const ref = (t: FlatTopic) => ({ id: t.id, title: t.title });

    // Một thao tác ghi tại một thời điểm; ghi xong tải lại chủ đề (id có thể đổi khi gói được tạo bản nháp) và gọi onWritten (tải lại mục).
    const mutate = async (fallback: string, work: () => Promise<void>, success?: string): Promise<boolean> => {
      if (lock.current) return false;
      lock.current = true;
      setBusy(true);
      try {
        await work();
      } catch (error) {
        toast.error(writeErrorMessage(error, fallback));
        return false;
      } finally {
        lock.current = false;
        setBusy(false);
      }
      if (success) toast.success(success);
      reload();
      onWritten?.();
      return true;
    };

    return {
      topics,
      topicOf: (itemId) => data.membership[itemId] ?? null,
      onCreate: (title) => mutate("Không thể thêm chủ đề", () => api.create(packageId, title, demo), "Đã thêm chủ đề"),
      onRename: (topic, title) => mutate("Không thể đổi tên chủ đề", () => api.rename(packageId, ref(topic), title, demo), "Đã đổi tên chủ đề"),
      onDelete: (topic) => void mutate("Không thể xóa chủ đề", () => api.remove(packageId, ref(topic), demo), "Đã xóa chủ đề (các mục giữ nguyên, chuyển về chưa phân chủ đề)"),
      onMove: (topic, direction) => {
        const from = topics.findIndex((t) => t.id === topic.id);
        const to = from + direction;
        if (from < 0 || to < 0 || to >= topics.length) return;
        const next = [...topics];
        [next[from], next[to]] = [next[to], next[from]];
        void mutate("Không thể đổi thứ tự chủ đề", () => api.reorder(packageId, next.map(ref), demo));
      },
      onAssign: (itemId, topicId) => {
        const target = topicId ? topics.find((t) => t.id === topicId) : undefined;
        void mutate("Không thể chuyển chủ đề", () => api.assign(packageId, itemId, target ? ref(target) : null, demo));
      },
    };
  }, [api, packageId, data, demo, reload, onWritten]);

  return { data, topicUi, busy };
}
