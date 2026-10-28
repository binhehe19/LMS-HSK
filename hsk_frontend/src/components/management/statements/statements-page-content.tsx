"use client";

import { useState } from "react";
import { StatementsView } from "@/components/management/statements/statements-view";
import { usePaymentSummary } from "@/components/management/statements/use-payment-summary";
import { useTransactionReport } from "@/components/management/statements/use-transaction-report";
import { DEFAULT_TRANSACTION_SORT, type TransactionTypeFilter } from "@/lib/payment/payment-model";

/**
 * Màn "Sao kê" (/admin/statements; HSK cũ: InstructorFinancialStatement, PrivateRoute ROLE_ADMIN). Chỉ ĐỌC. Trang/sắp xếp là tham số máy chủ;
 * tìm kiếm/loại lọc trên trang hiện tại như bản cũ. Đổi sắp xếp => về trang đầu (bản cũ giữ số trang cũ — vô nghĩa khi thứ tự đã đổi).
 */
export function StatementsPageContent() {
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState(DEFAULT_TRANSACTION_SORT);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<TransactionTypeFilter>("ALL");
  const summary = usePaymentSummary();
  const report = useTransactionReport(page, sort);

  return (
    <StatementsView
      summary={summary.state}
      report={report.state}
      lastReport={report.lastData}
      page={page}
      sort={sort}
      search={search}
      type={type}
      onSearchChange={setSearch}
      onTypeChange={setType}
      onSortChange={(value) => {
        setSort(value);
        setPage(0);
      }}
      onPageChange={setPage}
      onRetrySummary={summary.reload}
      onRetryReport={report.reload}
    />
  );
}
