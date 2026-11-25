# LMS HSK

`hsk_frontend` contains the Next.js app. The Spring Boot API is in `backend/repo-lms` and uses the Maven parent and framework modules under `backend`.

For local development on Windows, install JDK 21, Maven, and Node.js with npm. Set the following environment variables before running `run-hsk.bat`.

| Variable | Purpose |
|---|---|
| `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD` | PostgreSQL connection |
| `SPRING_DATA_REDIS_HOST`, `SPRING_DATA_REDIS_PORT`, `SPRING_DATA_REDIS_PASSWORD` | Redis connection |
| `SPRING_KAFKA_BOOTSTRAP_SERVERS` | Kafka brokers |
| `EXTERNAL_JWT_PUBLIC_KEY_PATH` | Path to the authentication service's RSA public key in PEM format |
| `INTERNAL_CLIENT_ID`, `INTERNAL_CLIENT_SECRET`, `AUTH_API_BASE_URL` | Authentication service configuration |
| `CMS_API_BASE_URL` | ERP endpoint for classes, sessions, and syllabi |

PostgreSQL, Redis, and Kafka default to localhost. Set the frontend authentication URLs via `NEXT_PUBLIC_AUTH_FRONTEND_URL` and `NEXT_PUBLIC_AUTH_API_BASE_URL` when using a different authentication service. The launcher starts the API on port 8090 and the frontend on port 3000 by default.
