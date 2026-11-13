// Lớp gọi API dùng chung cho frontend HSK. Theo conventions của LMS_IELTS/frontend (lib/api/api-client.ts): ApiError,
// bóc envelope { success, data, errorCode, errorMessage }, thông báo lỗi thân thiện, createApiClient(baseUrl) cho từng service.
//
// Xác thực (luồng IdP như LMS_IELTS): phiên là cookie của oauth2-proxy (cùng origin, luôn gửi `credentials: "include"`), proxy
// tự gắn Authorization cho service phía sau và tự làm mới token, nên FE không giữ token. Riêng `next dev` (không có proxy) thì
// gắn Bearer từ dev-token-session.ts và làm mới bằng refresh token, thử lại ĐÚNG MỘT lần. Gặp 401 => phiên không còn hiệu lực:
// thông báo "hết phiên" (auth-session.ts) để RequireAuth đưa đi đăng nhập lại. KHÔNG ghi token/header/body vào log.
"use client";

import { notifySessionExpired } from "@/lib/api/auth-session";
import { bearerHeaders, fetchWithDevRefresh } from "@/lib/auth/dev-token-session";

export class ApiError extends Error {
  status: number;
  errorCode?: string;

  constructor(message: string, status: number, errorCode?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errorCode = errorCode;
  }

  /** status 0 = không nhận được phản hồi (mất mạng, CORS, DNS, bị huỷ). */
  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

function httpStatusMessage(status: number): string {
  if (status === 408 || status === 504) return "Máy chủ phản hồi quá lâu. Vui lòng thử lại sau ít phút.";
  if (status === 429) return "Bạn thao tác quá nhanh. Vui lòng đợi một chút rồi thử lại.";
  if (status === 413) return "Dữ liệu gửi lên quá lớn.";
  if (status === 404) return "Không tìm thấy dữ liệu được yêu cầu.";
  if (status >= 500) return "Hệ thống đang tạm thời gián đoạn hoặc đang bảo trì. Vui lòng thử lại sau ít phút.";
  return `Yêu cầu không thành công (${status}).`;
}

const MAX_MESSAGE_LENGTH = 300;
const HTML_TAG = /<\/?[a-z!][^>]*>/i;

/** Chỉ nhận thông điệp là văn bản ngắn, không phải HTML (tránh hiện trang lỗi của proxy/CDN). */
function readableMessage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > MAX_MESSAGE_LENGTH || HTML_TAG.test(text)) return null;
  return text;
}

interface ApiEnvelope<T> {
  success?: boolean;
  errorCode?: string;
  errorMessage?: string;
  message?: string;
  error?: string;
  data?: T;
}

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  // "?query" gắn thẳng vào gốc dịch vụ (".../notification?page=0"): thêm "/" sẽ thành ".../notification/?page=0", một URL khác
  // mà nhiều backend (vd Spring 6) không còn khớp với route "/notification".
  if (path.startsWith("?")) return `${base}${path}`;
  // Gọi thẳng vào gốc dịch vụ (POST tạo ticket ".../tickets"): không thêm "/" cuối vì lý do như trên.
  if (path === "") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

async function send(url: string, init: RequestInit): Promise<Response> {
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...bearerHeaders(),
    ...(init.headers as Record<string, string> | undefined),
  };
  try {
    return await fetch(url, { ...init, credentials: "include", headers });
  } catch (error: unknown) {
    // Huỷ khi đổi trang/bộ lọc là vòng đời bình thường, không phải mất kết nối.
    if (init.signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
    throw new ApiError("Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.", 0);
  }
}

export async function apiFetch<T>(baseUrl: string, path: string, init: RequestInit = {}): Promise<T> {
  const url = joinUrl(baseUrl, path);

  const res = await fetchWithDevRefresh(() => send(url, init));
  // Phiên không còn hiệu lực (proxy đã thử làm mới mà không được); response 401 gốc được trả về bên dưới.
  if (res.status === 401) notifySessionExpired();
  const rawText = await res.text().catch(() => "");
  let body: ApiEnvelope<T> | string | null = null;
  try {
    body = rawText ? (JSON.parse(rawText) as ApiEnvelope<T>) : null;
  } catch {
    body = rawText;
  }

  const envelope = body && typeof body === "object" ? body : null;

  if (!res.ok) {
    let message = httpStatusMessage(res.status);
    if (res.status === 403) {
      message = "Bạn không có quyền thực hiện thao tác này.";
    } else if (res.status === 401) {
      message = "Phiên đăng nhập đã hết hạn hoặc chưa đăng nhập.";
    } else {
      const serverMessage = envelope
        ? (readableMessage(envelope.errorMessage) ?? readableMessage(envelope.message) ?? readableMessage(envelope.error))
        : readableMessage(body);
      if (serverMessage) message = serverMessage;
    }
    throw new ApiError(message, res.status, envelope?.errorCode);
  }

  if (envelope) {
    if (envelope.success === false) {
      throw new ApiError(
        readableMessage(envelope.errorMessage) ?? readableMessage(envelope.message) ?? "Yêu cầu không thành công",
        res.status,
        envelope.errorCode,
      );
    }
    if ("data" in envelope && envelope.data !== undefined) {
      return envelope.data as T;
    }
  }

  return (body !== null && body !== undefined ? body : {}) as T;
}

/** Bộ hàm get/post/put/delete gắn sẵn base URL của một service. `getBaseUrl` trả null nếu chưa cấu hình. */
export function createApiClient(getBaseUrl: () => string | null) {
  const base = (): string => {
    const url = getBaseUrl();
    if (!url) throw new ApiNotConfiguredError();
    return url;
  };
  const jsonBody = (data: unknown) => (data !== undefined ? JSON.stringify(data) : undefined);

  return {
    // async: thiếu cấu hình phải thành promise bị reject (ApiNotConfiguredError), không được ném đồng bộ ra khỏi effect.
    get: async <T>(path: string, init?: RequestInit) => apiFetch<T>(base(), path, { ...init, method: "GET" }),
    post: async <T>(path: string, data?: unknown) => apiFetch<T>(base(), path, { method: "POST", body: jsonBody(data) }),
    put: async <T>(path: string, data?: unknown) => apiFetch<T>(base(), path, { method: "PUT", body: jsonBody(data) }),
    delete: async <T>(path: string) => apiFetch<T>(base(), path, { method: "DELETE" }),
  };
}

/** Ném khi service chưa được cấu hình base URL (biến môi trường trống). Giao diện hiển thị "chưa tích hợp". */
export class ApiNotConfiguredError extends Error {
  constructor() {
    super("API chưa được cấu hình (thiếu biến môi trường).");
    this.name = "ApiNotConfiguredError";
  }
}
