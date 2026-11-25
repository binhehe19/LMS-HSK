package pl.co.lms.service.grading;

import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

// Chạy tác vụ ngoài DB (gửi Kafka, thông báo) SAU khi transaction commit; không có transaction thì chạy ngay.
// Transaction rollback thì tác vụ không chạy, tránh bắn sự kiện cho dữ liệu chưa được lưu.
final class AfterCommit {

    private AfterCommit() {}

    static void run(Runnable task) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    task.run();
                }
            });
        } else {
            task.run();
        }
    }
}
