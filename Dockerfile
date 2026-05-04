FROM node:22-alpine AS web
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY web ./web
COPY VERSION.md ./
RUN npm run build:pages

FROM golang:1.26-alpine AS go-builder
WORKDIR /src
RUN apk add --no-cache ca-certificates
COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal
COPY data ./data
COPY VERSION.md ./
COPY --from=web /src/docs ./docs
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o /out/pcarad-server ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=go-builder /out/pcarad-server /app/pcarad-server
COPY --from=web /src/docs /app/docs
COPY data /app/data
COPY VERSION.md /app/VERSION.md
ENV PORT=8080
ENV STATIC_DIR=/app/docs
ENV CATALOG_PATH=/app/data/catalog.json
ENV VERSION_FILE=/app/VERSION.md
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/app/pcarad-server"]
