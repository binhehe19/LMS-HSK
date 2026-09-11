import { redirect } from "next/navigation";

// Màn "Thẻ ghi nhớ" đã bỏ: flashcard là chế độ xem của từ vựng, còn soạn bộ từ vựng ở /vocab-set/manage (chọn từ từ Từ điển). Giữ route để liên kết cũ
// không gãy.
export default function FlashcardPackagePage() {
  redirect("/vocab-set/manage");
}
