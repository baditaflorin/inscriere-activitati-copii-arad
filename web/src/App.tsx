import { zodResolver } from "@hookform/resolvers/zod";
import * as Checkbox from "@radix-ui/react-checkbox";
import * as Tabs from "@radix-ui/react-tabs";
import * as Tooltip from "@radix-ui/react-tooltip";
import clsx from "clsx";
import {
  Check,
  Download,
  FileText,
  Info,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, type UseFormRegisterReturn, useForm } from "react-hook-form";
import { catalog, categories, circlesByID, type Circle } from "./catalog";
import { defaultEnrollmentDate, enrollmentFormSchema, type EnrollmentFormData } from "./formSchema";

const allTab = "Toate";

export default function App() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(allTab);
  const [selectedCircleIds, setSelectedCircleIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const idToCircle = useMemo(() => circlesByID(), []);

  const selectedCircles = selectedCircleIds
    .map((id) => idToCircle.get(id))
    .filter((circle): circle is Circle => Boolean(circle));

  const form = useForm<EnrollmentFormData>({
    resolver: zodResolver(enrollmentFormSchema),
    defaultValues: {
      parentName: "",
      childName: "",
      school: "",
      className: "",
      cnp: "",
      address: "",
      phone: "",
      consent: "DA",
      date: defaultEnrollmentDate(),
    },
    mode: "onBlur",
  });

  const filteredCircles = useMemo(() => {
    const normalizedQuery = normalize(query);
    return catalog.circles.filter((circle) => {
      const matchesCategory = activeCategory === allTab || circle.category === activeCategory;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        normalize(`${circle.name} ${circle.category} ${circle.sessions.map((session) => session.coordinator).join(" ")}`).includes(
          normalizedQuery,
        );
      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, query]);

  function toggleCircle(circleID: string) {
    setSelectedCircleIds((current) =>
      current.includes(circleID) ? current.filter((id) => id !== circleID) : [...current, circleID],
    );
  }

  async function onSubmit(data: EnrollmentFormData) {
    if (selectedCircles.length === 0) {
      setGenerationError("Alege cel putin un cerc inainte sa generezi PDF-ul.");
      return;
    }
    setIsGenerating(true);
    setGenerationError(null);
    try {
      const { generateEnrollmentPdf } = await import("./pdf/enrollmentPdf");
      const bytes = await generateEnrollmentPdf(data, selectedCircles);
      const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `cerere-inscriere-${slugify(data.childName)}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Nu am putut genera PDF-ul.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Tooltip.Provider delayDuration={150}>
      <div className="app-shell">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <Sparkles size={22} />
            </span>
            <div>
              <p>Palatul Copiilor Arad</p>
              <h1>Inscriere la cercuri</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <span className="version-pill">v{__APP_VERSION__}</span>
            <a className="source-link" href={catalog.enrollment.pdfUrl} target="_blank" rel="noreferrer">
              <FileText size={18} />
              Formular oficial
            </a>
          </div>
        </header>

        <main className="workspace">
          <section className="picker-panel" aria-labelledby="circles-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Pasul 1</p>
                <h2 id="circles-title">Alege cercurile</h2>
              </div>
              <strong>{selectedCircleIds.length} selectate</strong>
            </div>

            <label className="search-box">
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                placeholder="Cauta dupa cerc, profesor, categorie..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>

            <Tabs.Root value={activeCategory} onValueChange={setActiveCategory}>
              <Tabs.List className="tabs" aria-label="Categorii cercuri">
                {[allTab, ...categories].map((category) => (
                  <Tabs.Trigger key={category} className="tab" value={category}>
                    {category}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
              <Tabs.Content value={activeCategory} forceMount>
                <div className="circle-list">
                  {filteredCircles.map((circle) => (
                    <CircleOption
                      key={circle.id}
                      circle={circle}
                      checked={selectedCircleIds.includes(circle.id)}
                      onToggle={() => toggleCircle(circle.id)}
                    />
                  ))}
                </div>
              </Tabs.Content>
            </Tabs.Root>
          </section>

          <form className="form-panel" onSubmit={form.handleSubmit(onSubmit)} aria-labelledby="form-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Pasul 2</p>
                <h2 id="form-title">Completeaza datele</h2>
              </div>
              <PrivacyTooltip />
            </div>

            <div className="field-grid">
              <TextField label="Parinte / tutore" registration={form.register("parentName")} error={form.formState.errors.parentName?.message} />
              <TextField label="Copil" registration={form.register("childName")} error={form.formState.errors.childName?.message} />
              <TextField label="Gradinita / scoala" registration={form.register("school")} error={form.formState.errors.school?.message} />
              <TextField label="Grupa / clasa" registration={form.register("className")} error={form.formState.errors.className?.message} />
              <TextField label="CNP copil" registration={form.register("cnp")} error={form.formState.errors.cnp?.message} inputMode="numeric" />
              <TextField label="Telefon" registration={form.register("phone")} error={form.formState.errors.phone?.message} inputMode="tel" />
              <TextField label="Adresa" registration={form.register("address")} error={form.formState.errors.address?.message} wide />
              <TextField label="Data cererii" registration={form.register("date")} error={form.formState.errors.date?.message} type="date" />
            </div>

            <div className="consent-row">
              <div>
                <span>Imagine copil</span>
                <p>Alege DA sau NU pentru acordul foto/video din formular.</p>
              </div>
              <Controller
                control={form.control}
                name="consent"
                render={({ field }) => (
                  <div className="segmented" role="group" aria-label="Acord imagine copil">
                    {(["DA", "NU"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={clsx("segment", field.value === value && "active")}
                        onClick={() => field.onChange(value)}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                )}
              />
            </div>

            {generationError ? <p className="form-error">{generationError}</p> : null}

            <button className="primary-action" type="submit" disabled={isGenerating}>
              <Download size={19} />
              {isGenerating ? "Se genereaza..." : "Genereaza PDF-ul"}
            </button>
          </form>

          <aside className="summary-panel" aria-labelledby="summary-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Pasul 3</p>
                <h2 id="summary-title">Verifica rapid</h2>
              </div>
              <ShieldCheck size={24} aria-hidden="true" />
            </div>

            <div className="notice">
              <strong>Perioada inscrieri</strong>
              <span>{catalog.enrollment.period}</span>
            </div>

            <div className="summary-block">
              <h3>Cercuri in PDF</h3>
              {selectedCircles.length > 0 ? (
                <ul className="selected-list">
                  {selectedCircles.map((circle) => (
                    <li key={circle.id}>{circle.name}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Alege unul sau mai multe cercuri.</p>
              )}
            </div>

            <div className="summary-block">
              <h3>Documente necesare</h3>
              <ul className="plain-list">
                {catalog.enrollment.requiredDocuments.map((document) => (
                  <li key={document}>{document}</li>
                ))}
              </ul>
            </div>

            <div className="summary-block">
              <h3>Trimitere</h3>
              <p className="muted">PDF-ul generat se poate trimite la {catalog.enrollment.email} sau la profesorul coordonator.</p>
            </div>
          </aside>
        </main>

        <footer className="footer">
          <span>v{__APP_VERSION__}</span>
          <span>Date oficiale actualizate: {formatDateTime(catalog.generatedAt)}</span>
          <span>Fara cont, fara stocare, fara analytics.</span>
        </footer>
      </div>
    </Tooltip.Provider>
  );
}

type TextFieldProps = {
  label: string;
  registration: UseFormRegisterReturn;
  error?: string;
  type?: string;
  inputMode?: "numeric" | "tel";
  wide?: boolean;
};

function TextField({ label, registration, error, type = "text", inputMode, wide }: TextFieldProps) {
  return (
    <label className={clsx("field", wide && "wide")}>
      <span>{label}</span>
      <input type={type} inputMode={inputMode} {...registration} aria-invalid={Boolean(error)} />
      {error ? <small>{error}</small> : null}
    </label>
  );
}

function CircleOption({ circle, checked, onToggle }: { circle: Circle; checked: boolean; onToggle: () => void }) {
  const firstSession = circle.sessions[0];
  return (
    <article className={clsx("circle-card", checked && "checked")}>
      <div className="circle-card-main">
        <Checkbox.Root className="checkbox-root" checked={checked} onCheckedChange={onToggle} id={circle.id}>
          <Checkbox.Indicator>
            <Check size={16} />
          </Checkbox.Indicator>
        </Checkbox.Root>
        <label htmlFor={circle.id}>
          <strong>{circle.name}</strong>
          <span>{circle.category}</span>
        </label>
      </div>
      {firstSession ? (
        <div className="session-line">
          <MapPin size={15} aria-hidden="true" />
          <span>
            {firstSession.location}, {firstSession.schedule}, {firstSession.coordinator}
          </span>
        </div>
      ) : (
        <div className="session-line muted">
          <Info size={15} aria-hidden="true" />
          <span>Locatie temporara nepublicata in comunicatul curent</span>
        </div>
      )}
    </article>
  );
}

function PrivacyTooltip() {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger className="icon-button" type="button" aria-label="Confidentialitate">
        <ShieldCheck size={19} />
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tooltip-content" sideOffset={8}>
          Datele raman in browser si sunt folosite doar pentru PDF-ul descarcat.
          <Tooltip.Arrow className="tooltip-arrow" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function slugify(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "copil";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ro-RO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Bucharest",
  }).format(new Date(value));
}
