package catalog_test

import (
	"strings"
	"testing"

	"github.com/baditaflorin/inscriere-activitati-copii-arad/internal/catalog"
)

func TestDecodeValidatesCatalog(t *testing.T) {
	input := `{
	  "version": "0.1.0",
	  "generatedAt": "2026-05-04T00:00:00Z",
	  "sources": [],
	  "enrollment": {"schoolYear": "2026-2027", "period": "4 mai - 12 iunie 2026", "email": "inscrierepcarad@gmail.com", "pdfUrl": "https://example.test/form.pdf", "requiredDocuments": [], "submissionMethods": []},
	  "circles": [{"id": "sah", "name": "Sah", "category": "Sportive"}]
	}`

	got, err := catalog.Decode(strings.NewReader(input))
	if err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	if got.Circles[0].ID != "sah" {
		t.Fatalf("unexpected circle id %q", got.Circles[0].ID)
	}
}

func TestValidateRejectsDuplicateCircleIDs(t *testing.T) {
	c := catalog.Catalog{
		Version: "0.1.0",
		Enrollment: catalog.Enrollment{
			PDFURL: "https://example.test/form.pdf",
		},
		Circles: []catalog.Circle{
			{ID: "sah", Name: "Sah", Category: "Sportive"},
			{ID: "sah", Name: "Sah 2", Category: "Sportive"},
		},
	}
	if err := c.Validate(); err == nil {
		t.Fatal("Validate() error = nil, want duplicate id error")
	}
}
