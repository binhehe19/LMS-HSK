FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY scripts/copy-tinymce.mjs ./scripts/
RUN npm ci

COPY . .

# NEXT_PUBLIC_* được nhúng vào bundle lúc build (không đọc lại lúc chạy) nên truyền qua build arg. Để trống = dịch vụ chưa tích hợp (WAITING FOR BACKEND).
# Sau Traefik của backend chung, các API nghiệp vụ dùng đường dẫn tương đối: /api/lms, /api/notification, /api/storage.
# next.config.ts từ chối build khi có giá trị trỏ localhost/.invalid/.test hoặc *_API_PROXY_TARGET (không bao giờ build bản mock).
ARG NEXT_PUBLIC_AUTH_API_BASE_URL
ARG NEXT_PUBLIC_AUTH_FRONTEND_URL
ARG NEXT_PUBLIC_LMS_API_BASE_PATH=/api/lms
ARG NEXT_PUBLIC_NOTIFICATION_API_BASE_PATH=/api/notification
ARG NEXT_PUBLIC_STORAGE_API_BASE_PATH=/api/storage
ARG NEXT_PUBLIC_ADMIN_USER_API_BASE_PATH=
ARG NEXT_PUBLIC_HSK_API_BASE_PATH=
ARG NEXT_PUBLIC_QUIZ_API_BASE_PATH=
ARG NEXT_PUBLIC_TICKET_API_BASE_PATH=
ENV NEXT_PUBLIC_AUTH_API_BASE_URL=${NEXT_PUBLIC_AUTH_API_BASE_URL} \
    NEXT_PUBLIC_AUTH_FRONTEND_URL=${NEXT_PUBLIC_AUTH_FRONTEND_URL} \
    NEXT_PUBLIC_LMS_API_BASE_PATH=${NEXT_PUBLIC_LMS_API_BASE_PATH} \
    NEXT_PUBLIC_NOTIFICATION_API_BASE_PATH=${NEXT_PUBLIC_NOTIFICATION_API_BASE_PATH} \
    NEXT_PUBLIC_STORAGE_API_BASE_PATH=${NEXT_PUBLIC_STORAGE_API_BASE_PATH} \
    NEXT_PUBLIC_ADMIN_USER_API_BASE_PATH=${NEXT_PUBLIC_ADMIN_USER_API_BASE_PATH} \
    NEXT_PUBLIC_HSK_API_BASE_PATH=${NEXT_PUBLIC_HSK_API_BASE_PATH} \
    NEXT_PUBLIC_QUIZ_API_BASE_PATH=${NEXT_PUBLIC_QUIZ_API_BASE_PATH} \
    NEXT_PUBLIC_TICKET_API_BASE_PATH=${NEXT_PUBLIC_TICKET_API_BASE_PATH} \
    NEXT_PUBLIC_DEMO_MODE= \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner

RUN apk add --no-cache tzdata
ENV TZ=Asia/Bangkok
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

WORKDIR /app

# standalone không tự copy public và .next/static (cùng cách LMS_IELTS/frontend/Dockerfile).
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node

EXPOSE 3000

CMD ["node", "server.js"]
