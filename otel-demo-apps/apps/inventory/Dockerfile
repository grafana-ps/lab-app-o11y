# Inventory - Go
FROM golang:1.21-alpine AS builder

WORKDIR /app

COPY go.mod ./
RUN go mod download

COPY main.go ./

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o inventory .

# Runtime
FROM alpine:3.19

RUN apk --no-cache add ca-certificates

WORKDIR /app

COPY --from=builder /app/inventory .

ENV PORT=8080
EXPOSE 8080

USER nobody

CMD ["./inventory"]

