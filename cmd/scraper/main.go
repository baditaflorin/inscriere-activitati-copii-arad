package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/baditaflorin/inscriere-activitati-copii-arad/internal/scraper"
)

func main() {
	output := flag.String("out", "web/src/data/catalog.json", "catalog JSON output path")
	versionFile := flag.String("version-file", "VERSION.md", "version file path")
	flag.Parse()

	versionBytes, err := os.ReadFile(*versionFile)
	if err != nil {
		fatal(err)
	}
	client := scraper.Client{}
	pages, err := client.Fetch()
	if err != nil {
		fatal(err)
	}
	catalog, err := scraper.Build(strings.TrimSpace(string(versionBytes)), pages, time.Now())
	if err != nil {
		fatal(err)
	}
	payload, err := json.MarshalIndent(catalog, "", "  ")
	if err != nil {
		fatal(err)
	}
	payload = append(payload, '\n')
	if err := os.WriteFile(*output, payload, 0o644); err != nil {
		fatal(err)
	}
	fmt.Printf("wrote %s with %d circles\n", *output, len(catalog.Circles))
}

func fatal(err error) {
	fmt.Fprintf(os.Stderr, "scraper: %v\n", err)
	os.Exit(1)
}
