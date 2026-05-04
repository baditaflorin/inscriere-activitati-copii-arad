package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/baditaflorin/inscriere-activitati-copii-arad/internal/catalog"
	"github.com/go-chi/chi/v5"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/rs/zerolog"
)

const pagesBasePath = "/inscriere-activitati-copii-arad"

type Config struct {
	StaticDir   string
	CatalogPath string
	VersionFile string
	Registry    *prometheus.Registry
}

type VersionResponse struct {
	Version string `json:"version"`
}

type metrics struct {
	requests *prometheus.CounterVec
	duration *prometheus.HistogramVec
}

func New(config Config, logger zerolog.Logger) (http.Handler, error) {
	if config.StaticDir == "" {
		config.StaticDir = "docs"
	}
	if config.CatalogPath == "" {
		config.CatalogPath = "data/catalog.json"
	}
	if config.VersionFile == "" {
		config.VersionFile = "VERSION.md"
	}
	registry := config.Registry
	if registry == nil {
		registry = prometheus.NewRegistry()
	}
	registry.MustRegister(collectors.NewGoCollector())
	registry.MustRegister(collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}))
	m := newMetrics(registry)

	versionBytes, err := os.ReadFile(config.VersionFile)
	if err != nil {
		return nil, fmt.Errorf("read version file: %w", err)
	}
	version := strings.TrimSpace(string(versionBytes))

	r := chi.NewRouter()
	r.Use(m.middleware)
	r.Use(accessLog(logger))

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	r.Get("/readyz", func(w http.ResponseWriter, _ *http.Request) {
		if err := readiness(config); err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not_ready", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
	})
	r.Get("/api/version", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, VersionResponse{Version: version})
	})
	r.Get("/api/catalog", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		http.ServeFile(w, r, config.CatalogPath)
	})
	r.Handle("/metrics", promhttp.HandlerFor(registry, promhttp.HandlerOpts{}))

	r.NotFound(staticHandler(config.StaticDir))
	return r, nil
}

func newMetrics(registry prometheus.Registerer) metrics {
	return metrics{
		requests: promauto.With(registry).NewCounterVec(
			prometheus.CounterOpts{
				Name: "pcarad_http_requests_total",
				Help: "Total HTTP requests by method, route, and status.",
			},
			[]string{"method", "route", "status"},
		),
		duration: promauto.With(registry).NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "pcarad_http_request_duration_seconds",
				Help:    "HTTP request duration by method, route, and status.",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"method", "route", "status"},
		),
	}
}

func (m metrics) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		start := time.Now()
		next.ServeHTTP(recorder, r)
		route := chi.RouteContext(r.Context()).RoutePattern()
		if route == "" {
			route = routeLabel(r.URL.Path)
		}
		status := strconv.Itoa(recorder.status)
		m.requests.WithLabelValues(r.Method, route, status).Inc()
		m.duration.WithLabelValues(r.Method, route, status).Observe(time.Since(start).Seconds())
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}

func accessLog(logger zerolog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			next.ServeHTTP(w, r)
			logger.Info().
				Str("method", r.Method).
				Str("path", r.URL.Path).
				Dur("duration", time.Since(start)).
				Msg("request")
		})
	}
}

func readiness(config Config) error {
	if _, err := catalogFromPath(config.CatalogPath); err != nil {
		return err
	}
	indexPath := filepath.Join(config.StaticDir, "index.html")
	if stat, err := os.Stat(indexPath); err != nil || stat.IsDir() {
		return fmt.Errorf("static index is not ready")
	}
	return nil
}

func catalogFromPath(catalogPath string) (catalog.Catalog, error) {
	file, err := os.Open(catalogPath)
	if err != nil {
		return catalog.Catalog{}, fmt.Errorf("open catalog: %w", err)
	}
	defer file.Close()
	return catalog.Decode(file)
}

func staticHandler(staticDir string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		requestPath := stripPagesBasePath(r.URL.Path)
		if requestPath == "/" || requestPath == "." {
			serveStaticFile(w, r, staticDir, "index.html")
			return
		}
		cleanPath := strings.TrimPrefix(path.Clean(requestPath), "/")
		if cleanPath == "." || strings.HasPrefix(cleanPath, "..") {
			http.NotFound(w, r)
			return
		}
		target := filepath.Join(staticDir, filepath.FromSlash(cleanPath))
		if stat, err := os.Stat(target); err == nil && !stat.IsDir() {
			serveStaticFile(w, r, staticDir, cleanPath)
			return
		}
		serveStaticFile(w, r, staticDir, "index.html")
	}
}

func stripPagesBasePath(requestPath string) string {
	if requestPath == pagesBasePath {
		return "/"
	}
	if strings.HasPrefix(requestPath, pagesBasePath+"/") {
		return strings.TrimPrefix(requestPath, pagesBasePath)
	}
	return requestPath
}

func serveStaticFile(w http.ResponseWriter, r *http.Request, staticDir string, cleanPath string) {
	if strings.HasPrefix(cleanPath, "assets/") {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	} else {
		w.Header().Set("Cache-Control", "no-cache")
	}
	http.ServeFile(w, r, filepath.Join(staticDir, filepath.FromSlash(cleanPath)))
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func routeLabel(requestPath string) string {
	if strings.HasPrefix(requestPath, pagesBasePath+"/assets/") || strings.HasPrefix(requestPath, "/assets/") {
		return "/assets/*"
	}
	if strings.HasPrefix(requestPath, pagesBasePath) {
		return pagesBasePath + "/*"
	}
	return requestPath
}
