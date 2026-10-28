import { notFound } from "next/navigation";
import { MigrationPlaceholder } from "@/components/management/migration-placeholder/migration-placeholder";
import { findRoute } from "@/lib/management/route-registry";

// KHÔNG phải trang "bắt mọi URL": chỉ route đã đăng ký trong route-registry với trạng thái NOT_MIGRATED mới hiện trang
// "Chức năng đang được chuyển đổi"; mọi URL khác (sai, UNKNOWN, OUT_OF_SCOPE) gọi notFound() => HTTP 404.
// Route thật (page.tsx tĩnh ở đúng URL) luôn được Next ưu tiên hơn route động này nên tự thay thế placeholder.
export default async function ManagementPlaceholderPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const pathname = `/${slug.join("/")}`;
  const route = findRoute(pathname);
  if (!route || route.status !== "NOT_MIGRATED") notFound();
  return <MigrationPlaceholder pathname={pathname} />;
}
