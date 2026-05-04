package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/baditaflorin/inscriere-activitati-copii-arad/internal/server"
	"github.com/rs/zerolog"
)

func main() {
	healthcheck := flag.Bool("healthcheck", false, "check the local server health endpoint and exit")
	flag.Parse()
	if *healthcheck {
		if err := runHealthcheck(envOrDefault("PORT", "8080")); err != nil {
			fmt.Fprintf(os.Stderr, "healthcheck failed: %v\n", err)
			os.Exit(1)
		}
		return
	}

	logger := zerolog.New(os.Stdout).With().Timestamp().Logger()
	handler, err := server.New(server.Config{
		StaticDir:   envOrDefault("STATIC_DIR", "docs"),
		CatalogPath: envOrDefault("CATALOG_PATH", "data/catalog.json"),
		VersionFile: envOrDefault("VERSION_FILE", "VERSION.md"),
	}, logger)
	if err != nil {
		logger.Fatal().Err(err).Msg("create server")
	}

	port := envOrDefault("PORT", "8080")
	httpServer := &http.Server{
		Addr:              ":" + port,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		logger.Info().Str("addr", httpServer.Addr).Msg("server listening")
		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Fatal().Err(err).Msg("server failed")
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		logger.Error().Err(err).Msg("server shutdown failed")
		return
	}
	logger.Info().Msg("server stopped")
}

func runHealthcheck(port string) error {
	client := http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get("http://127.0.0.1:" + port + "/healthz")
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status %d", resp.StatusCode)
	}
	return nil
}

func envOrDefault(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func init() {
	if os.Getenv("TZ") == "" {
		if err := os.Setenv("TZ", "Europe/Bucharest"); err != nil {
			fmt.Fprintf(os.Stderr, "could not set TZ: %v\n", err)
		}
	}
}
