package scraper

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"slices"
	"sort"
	"strings"
	"time"
	"unicode"

	"github.com/PuerkitoBio/goquery"
	"github.com/baditaflorin/inscriere-activitati-copii-arad/internal/catalog"
	"golang.org/x/text/unicode/norm"
)

const (
	EnrollmentURL = "https://palatulcopiilorarad.ro/inscrieri-arad/"
	CirclesURL    = "https://palatulcopiilorarad.ro/cercuri-arad/"
	RelocationURL = "https://palatulcopiilorarad.ro/anunturi/comunicat-de-presa-relocarea-temporara-a-activitatilor-palatului-copiilor-arad/"
)

type Page struct {
	Name string
	URL  string
	Body []byte
}

type RelocationSession struct {
	CircleName string
	Session    catalog.Session
}

type Client struct {
	HTTPClient *http.Client
	Now        func() time.Time
}

func (c Client) Fetch() ([]Page, error) {
	client := c.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 20 * time.Second}
	}
	targets := []Page{
		{Name: "inscrieri-arad", URL: EnrollmentURL},
		{Name: "cercuri-arad", URL: CirclesURL},
		{Name: "relocare-temporara", URL: RelocationURL},
	}
	for i := range targets {
		req, err := http.NewRequest(http.MethodGet, targets[i].URL, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("User-Agent", "pcarad-inscriere-helper/0.1")
		resp, err := client.Do(req)
		if err != nil {
			return nil, fmt.Errorf("fetch %s: %w", targets[i].URL, err)
		}
		body, readErr := io.ReadAll(resp.Body)
		closeErr := resp.Body.Close()
		if readErr != nil {
			return nil, fmt.Errorf("read %s: %w", targets[i].URL, readErr)
		}
		if closeErr != nil {
			return nil, fmt.Errorf("close %s: %w", targets[i].URL, closeErr)
		}
		if resp.StatusCode < 200 || resp.StatusCode > 299 {
			return nil, fmt.Errorf("fetch %s: status %d", targets[i].URL, resp.StatusCode)
		}
		targets[i].Body = body
	}
	return targets, nil
}

func Build(version string, pages []Page, now time.Time) (catalog.Catalog, error) {
	pageByName := map[string][]byte{}
	sources := make([]catalog.Source, 0, len(pages))
	retrievedAt := now.UTC().Format(time.RFC3339)
	for _, page := range pages {
		pageByName[page.Name] = page.Body
		hash := sha256.Sum256(page.Body)
		sources = append(sources, catalog.Source{
			Name:        page.Name,
			URL:         page.URL,
			RetrievedAt: retrievedAt,
			SHA256:      hex.EncodeToString(hash[:]),
		})
	}

	enrollment, err := ParseEnrollment(pageByName["inscrieri-arad"])
	if err != nil {
		return catalog.Catalog{}, err
	}
	circles, err := ParseCircles(pageByName["cercuri-arad"])
	if err != nil {
		return catalog.Catalog{}, err
	}
	sessions, err := ParseRelocation(pageByName["relocare-temporara"])
	if err != nil {
		return catalog.Catalog{}, err
	}
	attachSessions(circles, sessions)

	result := catalog.Catalog{
		Version:     version,
		GeneratedAt: retrievedAt,
		Sources:     sources,
		Enrollment:  enrollment,
		Circles:     circles,
	}
	if err := result.Validate(); err != nil {
		return catalog.Catalog{}, err
	}
	return result, nil
}

func ParseEnrollment(body []byte) (catalog.Enrollment, error) {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(string(body)))
	if err != nil {
		return catalog.Enrollment{}, fmt.Errorf("parse enrollment html: %w", err)
	}
	text := cleanText(doc.Find(".elementor-widget-container").Text())
	pdfURL := ""
	doc.Find("a[href$='.pdf']").EachWithBreak(func(_ int, s *goquery.Selection) bool {
		href, ok := s.Attr("href")
		if ok && strings.Contains(href, "cerere-inscriere-Arad-2026-2027.pdf") {
			pdfURL = href
			return false
		}
		return true
	})
	if pdfURL == "" {
		return catalog.Enrollment{}, fmt.Errorf("official enrollment PDF link not found")
	}

	return catalog.Enrollment{
		SchoolYear: "2026-2027",
		Period:     extractOrDefault(text, regexp.MustCompile(`(?i)perioada\s+([0-9]+\s+\pL+\s+-\s+[0-9]+\s+\pL+\s+2026)`), "4 mai - 12 iunie 2026"),
		Email:      extractOrDefault(text, regexp.MustCompile(`inscrierepcarad@gmail\.com`), "inscrierepcarad@gmail.com"),
		PDFURL:     pdfURL,
		RequiredDocuments: []string{
			"cerere de inscriere completata de catre parinte/reprezentant legal/tutore",
			"copia certificatului de nastere sau a buletinului copilului",
		},
		SubmissionMethods: []string{
			"la profesorul coordonator",
			"la adresa de e-mail: inscrierepcarad@gmail.com",
		},
	}, nil
}

func ParseCircles(body []byte) ([]catalog.Circle, error) {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(string(body)))
	if err != nil {
		return nil, fmt.Errorf("parse circles html: %w", err)
	}

	var circles []catalog.Circle
	doc.Find(".elementor-cta").Each(func(_ int, card *goquery.Selection) {
		name := cleanText(card.Find(".elementor-cta__title").First().Text())
		category := cleanText(card.Find(".elementor-ribbon-inner").First().Text())
		href, _ := card.Find("a.elementor-cta__button").First().Attr("href")
		if name == "" || category == "" {
			return
		}
		circles = append(circles, catalog.Circle{
			ID:         slugify(name),
			Name:       normalizeCircleDisplayName(name),
			Category:   normalizeCategory(category),
			DetailsURL: absoluteURL(CirclesURL, href),
		})
	})
	if len(circles) == 0 {
		return nil, fmt.Errorf("no circles found")
	}
	sort.SliceStable(circles, func(i, j int) bool {
		if circles[i].Category == circles[j].Category {
			return circles[i].Name < circles[j].Name
		}
		return circles[i].Category < circles[j].Category
	})
	return circles, nil
}

func ParseRelocation(body []byte) ([]RelocationSession, error) {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(string(body)))
	if err != nil {
		return nil, fmt.Errorf("parse relocation html: %w", err)
	}
	var sessions []RelocationSession
	doc.Find("table tr").Each(func(_ int, row *goquery.Selection) {
		var cells []string
		row.Find("td").Each(func(_ int, cell *goquery.Selection) {
			cells = append(cells, cleanText(cell.Text()))
		})
		switch len(cells) {
		case 6:
			if !looksNumeric(cells[0]) {
				return
			}
			location, address := splitLocationAddress(cells[1])
			sessions = append(sessions, RelocationSession{
				CircleName: cells[4],
				Session: catalog.Session{
					Location:    cleanText(location),
					Address:     cleanText(address),
					Room:        cleanText(cells[2]),
					Schedule:    cleanText(cells[3]),
					Coordinator: cleanText(cells[5]),
				},
			})
		case 5:
			if !looksNumeric(cells[0]) {
				return
			}
			location, address := splitLocationAddress(cells[1])
			sessions = append(sessions, RelocationSession{
				CircleName: cells[3],
				Session: catalog.Session{
					Location:    cleanText(location),
					Address:     cleanText(address),
					Schedule:    cleanText(cells[2]),
					Coordinator: cleanText(cells[4]),
				},
			})
		}
	})
	if len(sessions) == 0 {
		return nil, fmt.Errorf("no relocation sessions found")
	}
	return sessions, nil
}

func attachSessions(circles []catalog.Circle, sessions []RelocationSession) {
	for _, session := range sessions {
		key := normalizeCircleKey(session.CircleName)
		for i := range circles {
			if circleMatchesSession(circles[i].Name, key) {
				circles[i].Sessions = append(circles[i].Sessions, session.Session)
			}
		}
	}
	for i := range circles {
		slices.SortFunc(circles[i].Sessions, func(a, b catalog.Session) int {
			return strings.Compare(a.Location+a.Room+a.Coordinator, b.Location+b.Room+b.Coordinator)
		})
	}
}

func circleMatchesSession(circleName string, sessionKey string) bool {
	circleKey := normalizeCircleKey(circleName)
	if circleKey == sessionKey {
		return true
	}
	aliases := map[string][]string{
		normalizeCircleKey("Muzica vocal-instrumentala (Canto)"):    {normalizeCircleKey("Canto")},
		normalizeCircleKey("Muzica vocal-instrumentala (Formatie)"): {normalizeCircleKey("Formatie muzica usoara")},
		normalizeCircleKey("Muzica vocal-instrumentala (Pian)"):     {normalizeCircleKey("Pian")},
		normalizeCircleKey("Muzica vocal-instrumentala (Taraf)"):    {normalizeCircleKey("Taraf")},
		normalizeCircleKey("Informatica / Multimedia"):              {normalizeCircleKey("Informatica-Multimedia")},
		normalizeCircleKey("Redactie presa / Radio-TV"):             {normalizeCircleKey("Redactie presa/radio TV")},
		normalizeCircleKey("Cultura si civilizatie Romaneasca"):     {normalizeCircleKey("Cultura si civilizatie romaneasca")},
		normalizeCircleKey("Cultura si civilizatie Engleza I"):      {normalizeCircleKey("Cultura si civilizatie engleza 1")},
		normalizeCircleKey("Cultura si civilizatie Engleza II"):     {normalizeCircleKey("Cultura si civilizatie engleza 2")},
		normalizeCircleKey("Cultura si civilizatie Germana"):        {normalizeCircleKey("Cultura si civilizatie germana")},
		normalizeCircleKey("Cultura si civilizatie Spaniola"):       {normalizeCircleKey("Cultura si civilizatie spaniola")},
		normalizeCircleKey("Desen / Pictura"):                       {normalizeCircleKey("Desen/ Pictura")},
	}
	return slices.Contains(aliases[circleKey], sessionKey)
}

func cleanText(s string) string {
	replacer := strings.NewReplacer("\u00a0", " ", "\t", " ", "\n", " ", "\r", " ")
	return strings.Join(strings.Fields(replacer.Replace(s)), " ")
}

func extractOrDefault(text string, pattern *regexp.Regexp, fallback string) string {
	match := pattern.FindStringSubmatch(text)
	if len(match) > 1 {
		return cleanText(match[1])
	}
	if len(match) == 1 {
		return cleanText(match[0])
	}
	return fallback
}

func absoluteURL(base, href string) string {
	if href == "" {
		return ""
	}
	parsed, err := url.Parse(href)
	if err != nil {
		return href
	}
	if parsed.IsAbs() {
		return parsed.String()
	}
	baseURL, err := url.Parse(base)
	if err != nil {
		return href
	}
	return baseURL.ResolveReference(parsed).String()
}

func slugify(s string) string {
	key := normalizeCircleKey(s)
	key = strings.ReplaceAll(key, " ", "-")
	key = regexp.MustCompile(`[^a-z0-9-]+`).ReplaceAllString(key, "")
	key = regexp.MustCompile(`-+`).ReplaceAllString(key, "-")
	return strings.Trim(key, "-")
}

func normalizeCircleKey(s string) string {
	s = strings.ToLower(removeDiacritics(cleanText(s)))
	s = strings.NewReplacer("ă", "a", "â", "a", "î", "i", "ș", "s", "ş", "s", "ț", "t", "ţ", "t").Replace(s)
	s = regexp.MustCompile(`[^a-z0-9]+`).ReplaceAllString(s, " ")
	return strings.TrimSpace(s)
}

func removeDiacritics(s string) string {
	t := norm.NFD.String(s)
	var b strings.Builder
	for _, r := range t {
		if unicode.Is(unicode.Mn, r) {
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}

func normalizeCategory(category string) string {
	switch normalizeCircleKey(category) {
	case "cultural civice":
		return "Cultural-Civice"
	case "tehnico aplicative":
		return "Tehnico-aplicative"
	case "artistice":
		return "Artistice"
	case "sportive":
		return "Sportive"
	default:
		return cleanText(category)
	}
}

func normalizeCircleDisplayName(name string) string {
	return strings.NewReplacer("Radio TV", "Radio-TV", " / ", " / ").Replace(cleanText(name))
}

func looksNumeric(s string) bool {
	_, ok := strings.CutSuffix(strings.TrimSpace(s), ".")
	if ok {
		return true
	}
	return regexp.MustCompile(`^\d+$`).MatchString(strings.TrimSpace(s))
}

func splitLocationAddress(s string) (string, string) {
	parts := strings.Split(cleanText(s), " Str.")
	if len(parts) == 2 {
		return parts[0], "Str." + parts[1]
	}
	return s, ""
}
