package server_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/baditaflorin/inscriere-activitati-copii-arad/internal/server"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/rs/zerolog"
)

func TestVersionHealthReadyAndCatalog(t *testing.T) {
	handler := newTestHandler(t)

	for _, path := range []string{"/healthz", "/readyz", "/api/catalog", "/metrics"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("%s status = %d, body = %s", path, rec.Code, rec.Body.String())
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/api/version", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("/api/version status = %d", rec.Code)
	}
	var payload server.VersionResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode version: %v", err)
	}
	if payload.Version != "0.1.0" {
		t.Fatalf("version = %q", payload.Version)
	}
}

func TestStaticHandlerServesPagesBasePath(t *testing.T) {
	handler := newTestHandler(t)
	req := httptest.NewRequest(http.MethodGet, "/inscriere-activitati-copii-arad/", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "app") {
		t.Fatalf("index body = %q", rec.Body.String())
	}
}

func newTestHandler(t *testing.T) http.Handler {
	t.Helper()
	temp := t.TempDir()
	staticDir := filepath.Join(temp, "docs")
	dataDir := filepath.Join(temp, "data")
	if err := os.MkdirAll(staticDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		t.Fatal(err)
	}
	mustWrite(t, filepath.Join(staticDir, "index.html"), []byte("<html><body>app</body></html>"))
	mustWrite(t, filepath.Join(temp, "VERSION.md"), []byte("0.1.0\n"))
	mustWrite(t, filepath.Join(dataDir, "catalog.json"), []byte(`{
	  "version": "0.1.0",
	  "generatedAt": "2026-05-04T00:00:00Z",
	  "sources": [],
	  "enrollment": {"schoolYear": "2026-2027", "period": "4 mai - 12 iunie 2026", "email": "inscrierepcarad@gmail.com", "pdfUrl": "https://example.test/form.pdf", "requiredDocuments": [], "submissionMethods": []},
	  "circles": [{"id": "sah", "name": "Sah", "category": "Sportive"}]
	}`))

	handler, err := server.New(server.Config{
		StaticDir:   staticDir,
		CatalogPath: filepath.Join(dataDir, "catalog.json"),
		VersionFile: filepath.Join(temp, "VERSION.md"),
		Registry:    prometheus.NewRegistry(),
	}, zerolog.Nop())
	if err != nil {
		t.Fatalf("server.New() error = %v", err)
	}
	return handler
}

func mustWrite(t *testing.T, path string, content []byte) {
	t.Helper()
	if err := os.WriteFile(path, content, 0o644); err != nil {
		t.Fatal(err)
	}
}
