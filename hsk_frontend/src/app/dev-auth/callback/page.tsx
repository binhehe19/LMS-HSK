import { notFound } from "next/navigation";
import { DevAuthCallback } from "@/components/auth/dev-auth-callback";

// Chỉ có ở `next dev`; mọi môi trường khác trả 404.
export default function DevAuthCallbackPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <DevAuthCallback />;
}
