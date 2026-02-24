# Payment - Java Spring Boot
FROM maven:3.9-eclipse-temurin-17 AS builder

WORKDIR /app

COPY pom.xml ./
RUN mvn dependency:go-offline -B

COPY src ./src
RUN mvn package -DskipTests -B

# Runtime
FROM eclipse-temurin:17-jre

WORKDIR /app

COPY --from=builder /app/target/*.jar app.jar

ENV PORT=8080
EXPOSE 8080

USER nobody

ENTRYPOINT ["java", "-jar", "app.jar"]

