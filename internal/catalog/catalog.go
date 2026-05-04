package catalog

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"
)

type Source struct {
	Name        string `json:"name"`
	URL         string `json:"url"`
	RetrievedAt string `json:"retrievedAt"`
	SHA256      string `json:"sha256,omitempty"`
}

type Enrollment struct {
	SchoolYear        string   `json:"schoolYear"`
	Period            string   `json:"period"`
	Email             string   `json:"email"`
	PDFURL            string   `json:"pdfUrl"`
	RequiredDocuments []string `json:"requiredDocuments"`
	SubmissionMethods []string `json:"submissionMethods"`
}

type Session struct {
	Location    string `json:"location"`
	Address     string `json:"address"`
	Room        string `json:"room,omitempty"`
	Schedule    string `json:"schedule"`
	Coordinator string `json:"coordinator"`
}

type Circle struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Category   string    `json:"category"`
	DetailsURL string    `json:"detailsUrl,omitempty"`
	Sessions   []Session `json:"sessions,omitempty"`
}

type Catalog struct {
	Version     string     `json:"version"`
	GeneratedAt string     `json:"generatedAt"`
	Sources     []Source   `json:"sources"`
	Enrollment  Enrollment `json:"enrollment"`
	Circles     []Circle   `json:"circles"`
}

func Decode(r io.Reader) (Catalog, error) {
	var c Catalog
	if err := json.NewDecoder(r).Decode(&c); err != nil {
		return Catalog{}, fmt.Errorf("decode catalog: %w", err)
	}
	if err := c.Validate(); err != nil {
		return Catalog{}, err
	}
	return c, nil
}

func (c Catalog) Validate() error {
	if strings.TrimSpace(c.Version) == "" {
		return fmt.Errorf("catalog version is required")
	}
	if strings.TrimSpace(c.Enrollment.PDFURL) == "" {
		return fmt.Errorf("enrollment PDF URL is required")
	}
	if len(c.Circles) == 0 {
		return fmt.Errorf("at least one circle is required")
	}
	seen := map[string]struct{}{}
	for _, circle := range c.Circles {
		if strings.TrimSpace(circle.ID) == "" {
			return fmt.Errorf("circle id is required")
		}
		if _, ok := seen[circle.ID]; ok {
			return fmt.Errorf("duplicate circle id %q", circle.ID)
		}
		seen[circle.ID] = struct{}{}
		if strings.TrimSpace(circle.Name) == "" {
			return fmt.Errorf("circle %q name is required", circle.ID)
		}
		if strings.TrimSpace(circle.Category) == "" {
			return fmt.Errorf("circle %q category is required", circle.ID)
		}
	}
	return nil
}
