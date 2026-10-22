// Thông báo "phiên đã hết" dùng chung cho mọi API. Phiên do oauth2-proxy giữ (cookie cùng origin) và proxy tự làm mới token,
// nên FE không còn tự refresh: 401 từ bất kỳ API nào nghĩa là phiên không còn hiệu lực (xem api-client.ts). Tách riêng khỏi
// api-client/auth-client để không có vòng import.
const expiredListeners = new Set<() => void>();

/** Đăng ký nhận thông báo "phiên đã hết". Trả hàm hủy đăng ký. */
export function subscribeSessionExpired(listener: () => void): () => void {
  expiredListeners.add(listener);
  return () => {
    expiredListeners.delete(listener);
  };
}

export function notifySessionExpired(): void {
  expiredListeners.forEach((listener) => listener());
}
