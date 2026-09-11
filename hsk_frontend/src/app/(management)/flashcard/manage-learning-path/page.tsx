import { redirect } from "next/navigation";

// Bí danh cũ của /flashcard/package (màn Thẻ ghi nhớ đã bỏ): chuyển về bộ từ vựng.
export default function FlashcardManageLearningPathPage() {
  redirect("/vocab-set/manage");
}
