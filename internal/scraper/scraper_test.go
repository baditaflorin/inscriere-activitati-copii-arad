package scraper

import (
	"testing"
	"time"
)

func TestParseEnrollmentFindsOfficialPDFAndEmail(t *testing.T) {
	body := []byte(`<html><body>
		<h4><a href="https://palatulcopiilorarad.ro/wp-content/uploads/2026/05/cerere-inscriere-Arad-2026-2027.pdf">
		INSCRIERI AN SCOLAR 2026-2027<br>- la adresa de e-mail: inscrierepcarad@gmail.com
		</a></h4>
	</body></html>`)

	got, err := ParseEnrollment(body)
	if err != nil {
		t.Fatalf("ParseEnrollment() error = %v", err)
	}
	if got.Email != "inscrierepcarad@gmail.com" {
		t.Fatalf("Email = %q", got.Email)
	}
	if got.PDFURL == "" {
		t.Fatal("PDFURL is empty")
	}
}

func TestParseCirclesNormalizesCards(t *testing.T) {
	body := []byte(`<html><body>
		<div class="elementor-cta">
			<h3 class="elementor-cta__title">Cultură și civilizație Engleză I</h3>
			<a class="elementor-cta__button" href="/cercuri/engleza-i/">Detalii</a>
			<div class="elementor-ribbon-inner">CULTURAL-CIVICE</div>
		</div>
		<div class="elementor-cta">
			<h3 class="elementor-cta__title">Șah</h3>
			<a class="elementor-cta__button" href="https://example.test/sah">Detalii</a>
			<div class="elementor-ribbon-inner">Sportive</div>
		</div>
	</body></html>`)

	got, err := ParseCircles(body)
	if err != nil {
		t.Fatalf("ParseCircles() error = %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("len(ParseCircles()) = %d", len(got))
	}
	if got[0].Category != "Cultural-Civice" {
		t.Fatalf("Category = %q", got[0].Category)
	}
	if got[1].ID != "sah" {
		t.Fatalf("ID = %q", got[1].ID)
	}
}

func TestParseRelocationExtractsBothTableShapes(t *testing.T) {
	body := []byte(`<html><body><table>
		<tr><td>1.</td><td>Colegiul Economic Arad Str. Alexandru Dimitrie Xenopol, Nr.2, Mun. Arad</td><td>Sala A19</td><td>14-19</td><td>Cultură și civilizație engleză 2</td><td>Mistor Anca</td></tr>
		<tr><td>2.</td><td>Palatul Copiilor Arad (curtea ISJ Arad) Str.Corneliu Coposu, Nr.26, Mun. Arad</td><td>14-20</td><td>Aeromodele</td><td>Corodeanu Vasile</td></tr>
	</table></body></html>`)

	got, err := ParseRelocation(body)
	if err != nil {
		t.Fatalf("ParseRelocation() error = %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("len(ParseRelocation()) = %d", len(got))
	}
	if got[0].Session.Room != "Sala A19" {
		t.Fatalf("Room = %q", got[0].Session.Room)
	}
	if got[1].CircleName != "Aeromodele" {
		t.Fatalf("CircleName = %q", got[1].CircleName)
	}
}

func TestBuildAttachesRelocationSessions(t *testing.T) {
	pages := []Page{
		{Name: "inscrieri-arad", URL: EnrollmentURL, Body: []byte(`<a href="https://palatulcopiilorarad.ro/wp-content/uploads/2026/05/cerere-inscriere-Arad-2026-2027.pdf">inscrierepcarad@gmail.com</a>`)},
		{Name: "cercuri-arad", URL: CirclesURL, Body: []byte(`<div class="elementor-cta"><h3 class="elementor-cta__title">Muzică vocal-instrumentală (Canto)</h3><a class="elementor-cta__button" href="/cercuri/canto/">Detalii</a><div class="elementor-ribbon-inner">Artistice</div></div>`)},
		{Name: "relocare-temporara", URL: RelocationURL, Body: []byte(`<table><tr><td>1.</td><td>Colegiul Național Elena Ghiba Birta Arad Str. B-dul General Dragalina, Nr.6, Mun. Arad</td><td>Sala festivă</td><td>15-19</td><td>Canto</td><td>Bizău-Roșu Laura</td></tr></table>`)},
	}

	got, err := Build("0.1.0", pages, time.Date(2026, 5, 4, 12, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatalf("Build() error = %v", err)
	}
	if len(got.Circles[0].Sessions) != 1 {
		t.Fatalf("sessions = %d", len(got.Circles[0].Sessions))
	}
}
