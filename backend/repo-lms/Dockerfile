FROM lms-framework AS build

WORKDIR /workspace

COPY repo-lms/pom.xml repo-lms/pom.xml
COPY repo-lms/src repo-lms/src
RUN mvn -f repo-lms/pom.xml -DskipTests package org.springframework.boot:spring-boot-maven-plugin:3.3.4:repackage \
    && JAR="$(ls repo-lms/target/*.jar | grep -vE '(-plain|-original)\.jar$' | head -n1)" \
    && cp "$JAR" /workspace/app.jar

FROM eclipse-temurin:21-jre-alpine

# Heap theo giới hạn bộ nhớ của container (Docker mem_limit / Kubernetes limits), có thể ghi đè bằng JAVA_TOOL_OPTIONS.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"

WORKDIR /workspace
COPY --from=build /workspace/app.jar /workspace/app.jar

EXPOSE 8090
ENTRYPOINT ["java","-jar","/workspace/app.jar"]
