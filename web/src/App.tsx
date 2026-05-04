import { zodResolver } from "@hookform/resolvers/zod";
import * as Checkbox from "@radix-ui/react-checkbox";
import * as Tabs from "@radix-ui/react-tabs";
import * as Tooltip from "@radix-ui/react-tooltip";
import clsx from "clsx";
import {
  Archive,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Code2,
  Copy,
  Cpu,
  Download,
  Dumbbell,
  ExternalLink,
  FileCheck2,
  FileText,
  Github,
  Grid2X2,
  Heart,
  HelpCircle,
  Home,
  Languages,
  Mail,
  Palette,
  PenLine,
  Search,
  Send,
  Server,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Controller, type UseFormRegisterReturn, useForm } from "react-hook-form";
import { catalog, categories, circlesByID, type Circle } from "./catalog";
import { defaultEnrollmentDate, enrollmentFormSchema, type EnrollmentFormData } from "./formSchema";

const allTab = "Toate";
const repoURL = "https://github.com/baditaflorin/inscriere-activitati-copii-arad";

export default function App() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(allTab);
  const [selectedCircleIds, setSelectedCircleIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [downloadReady, setDownloadReady] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "manual">("idle");
  const idToCircle = useMemo(() => circlesByID(), []);

  const form = useForm<EnrollmentFormData>({
    resolver: zodResolver(enrollmentFormSchema),
    defaultValues: {
      parentName: "",
      parentSignature: "",
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
  const watchedForm = form.watch();

  const selectedCircles = selectedCircleIds
    .map((id) => idToCircle.get(id))
    .filter((circle): circle is Circle => Boolean(circle));
  const emailDraft = makeEmailDraft(watchedForm, selectedCircles);
  const emailHref = makeMailtoHref(emailDraft);
  const gmailHref = makeGmailHref(emailDraft);
  const selectedCountLabel =
    selectedCircles.length === 1 ? "1 cerc selectat" : `${selectedCircles.length} cercuri selectate`;

  const filteredCircles = useMemo(() => {
    const normalizedQuery = normalize(query);
    return catalog.circles.filter((circle) => {
      const sessionText = circle.sessions.map((session) => `${session.location} ${session.coordinator}`).join(" ");
      const matchesCategory = activeCategory === allTab || circle.category === activeCategory;
      const matchesQuery =
        normalizedQuery.length === 0 || normalize(`${circle.name} ${circle.category} ${sessionText}`).includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, query]);

  const locationCards = useMemo(() => {
    const grouped = new Map<string, { address: string; items: { circle: Circle; schedule: string; coordinator: string }[] }>();
    for (const circle of catalog.circles) {
      for (const session of circle.sessions) {
        const current = grouped.get(session.location) ?? { address: session.address, items: [] };
        current.items.push({ circle, schedule: session.schedule, coordinator: session.coordinator });
        grouped.set(session.location, current);
      }
    }
    return Array.from(grouped.entries()).map(([location, value], index) => ({ location, index: index + 1, ...value }));
  }, []);

  function toggleCircle(circleID: string) {
    setDownloadReady(false);
    setCopyStatus("idle");
    setSelectedCircleIds((current) =>
      current.includes(circleID) ? current.filter((id) => id !== circleID) : [...current, circleID],
    );
  }

  async function copyPreparedEmail() {
    const text = formatEmailDraft(emailDraft);
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(text);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("manual");
    }
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
      if (selectedCircles.length === 1) {
        const bytes = await generateEnrollmentPdf(data, [selectedCircles[0]]);
        downloadBlob(bytes, `cerere-inscriere-${slugify(data.childName)}-${slugify(selectedCircles[0].name)}.pdf`, "application/pdf");
      } else {
        const { default: JSZip } = await import("jszip");
        const zip = new JSZip();
        for (const circle of selectedCircles) {
          const bytes = await generateEnrollmentPdf(data, [circle]);
          zip.file(`cerere-inscriere-${slugify(data.childName)}-${slugify(circle.name)}.pdf`, bytes);
        }
        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadBlob(zipBlob, `cereri-inscriere-${slugify(data.childName)}.zip`, "application/zip");
      }
      setDownloadReady(true);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Nu am putut genera documentele.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Tooltip.Provider delayDuration={150}>
      <div className="app-shell">
        <header className="topbar">
          <a className="brand" href="#start" aria-label="Palatul Copiilor Arad">
            <img src={`${import.meta.env.BASE_URL}assets/palatul-logo.jpg`} alt="" />
            <span>Palatul Copiilor Arad</span>
          </a>
          <nav className="nav-links" aria-label="Navigare principala">
            <a href="#cercuri">
              <Grid2X2 size={18} /> Cercuri
            </a>
            <a href="#inscriere">
              <PenLine size={18} /> Inscriere
            </a>
            <a href="#program">
              <CalendarDays size={18} /> Program
            </a>
            <a href="#ajutor">
              <HelpCircle size={18} /> Ajutor
            </a>
          </nav>
          <a className="version-pill" href={repoURL} target="_blank" rel="noreferrer">
            <Code2 size={18} /> Frontend v{__APP_VERSION__}
          </a>
        </header>

        <main>
          <section className="hero" id="start">
            <div className="hero-copy">
              <p className="eyebrow">Inscrieri an scolar</p>
              <h1>
                Inscrieri Palatul Copiilor Arad <span>2026-2027</span>
              </h1>
              <p>
                Alege cercurile preferate, completeaza datele parintelui si ale copilului, iar aplicatia genereaza
                cererea oficiala completata.
              </p>
              <div className="hero-actions">
                <a className="primary-link" href="#inscriere">
                  <PenLine size={20} /> Incepe inscrierea <ChevronRight size={20} />
                </a>
                <a className="secondary-link" href="#cercuri">
                  <BookOpen size={20} /> Vezi cercurile <ChevronRight size={20} />
                </a>
              </div>
            </div>
            <div className="hero-art" aria-hidden="true">
              <img src={`${import.meta.env.BASE_URL}assets/palatul-child-hero.png`} alt="" />
              <span className="art-chip camera">Arte</span>
              <span className="art-chip music">Muzica</span>
              <span className="art-chip map">Arad</span>
            </div>
          </section>

          <section className="quick-facts" aria-label="Informatii rapide">
            <InfoCard icon={<FileText />} title="Documente necesare">
              <ul>
                <li>cerere de inscriere completata</li>
                <li>copie certificat de nastere sau buletin</li>
              </ul>
            </InfoCard>
            <InfoCard icon={<CalendarDays />} title="Perioada de inscriere">
              <strong>{catalog.enrollment.period}</strong>
            </InfoCard>
            <InfoCard icon={<Mail />} title="Modalitati de inscriere">
              <ul>
                <li>la profesorul coordonator</li>
                <li>
                  prin e-mail: <a href={`mailto:${catalog.enrollment.email}`}>{catalog.enrollment.email}</a>
                </li>
              </ul>
            </InfoCard>
          </section>

          <section className="flow" aria-labelledby="flow-title">
            <h2 id="flow-title">Cum functioneaza</h2>
            <div className="flow-steps">
              <StepCard number="1" icon={<Grid2X2 />} title="Selectezi cercurile" text="Poti alege unul sau mai multe." />
              <StepCard number="2" icon={<PenLine />} title="Completezi datele" text="Datele raman doar in browser." />
              <StepCard number="3" icon={<FileCheck2 />} title="Verifici PDF-ul" text="Un document pentru fiecare cerc." />
              <StepCard number="4" icon={<Send />} title="Descarci si trimiti" text="E-mailul este pregatit automat." />
            </div>
          </section>

          <section className="workbench" id="inscriere">
            <div className="section-title">
              <div>
                <p className="eyebrow">Cercuri</p>
                <h2 id="cercuri">Alege cercurile preferate</h2>
                <p>Pentru mai multe cercuri, descarcarea contine cate un PDF separat pentru fiecare optiune.</p>
              </div>
              <span className="selected-counter">{selectedCountLabel}</span>
            </div>

            <div className="workbench-grid">
              <section className="picker-panel" aria-label="Lista cercuri">
                <Tabs.Root value={activeCategory} onValueChange={setActiveCategory}>
                  <Tabs.List className="tabs" aria-label="Categorii cercuri">
                    {[allTab, ...categories].map((category) => (
                      <Tabs.Trigger key={category} className="tab" value={category}>
                        {categoryIcon(category)}
                        {category}
                      </Tabs.Trigger>
                    ))}
                  </Tabs.List>
                </Tabs.Root>

                <div className="picker-tools">
                  <label className="search-box">
                    <Search size={18} aria-hidden="true" />
                    <input
                      type="search"
                      placeholder="Cauta un cerc..."
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </label>
                  <span className="hint-pill">
                    <Check size={16} /> {selectedCountLabel}
                  </span>
                </div>

                <div className="circle-grid">
                  {filteredCircles.map((circle) => (
                    <CircleOption
                      key={circle.id}
                      circle={circle}
                      checked={selectedCircleIds.includes(circle.id)}
                      onToggle={() => toggleCircle(circle.id)}
                    />
                  ))}
                </div>
              </section>

              <aside className="selection-panel" aria-label="Selectia ta">
                <div className="panel-title">
                  <h3>Selectia ta</h3>
                  <span>{selectedCircles.length}</span>
                </div>
                {selectedCircles.length > 0 ? (
                  <ul className="selection-list">
                    {selectedCircles.map((circle) => (
                      <li key={circle.id}>
                        <span className="selection-icon">
                          <img src={circleImageSrc(circle)} alt="" />
                        </span>
                        <div>
                          <strong>{circle.name}</strong>
                          <small>{circle.category}</small>
                        </div>
                        <button type="button" onClick={() => toggleCircle(circle.id)} aria-label={`Scoate ${circle.name}`}>
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">Selecteaza cel putin un cerc pentru a genera cererea.</p>
                )}
                <div className="selection-note">
                  <Archive size={18} />
                  <span>Daca alegi mai multe cercuri, primesti un ZIP cu un PDF separat pentru fiecare cerc.</span>
                </div>
                <a className="primary-link wide-link" href="#date">
                  Continua cu datele <ChevronRight size={18} />
                </a>
              </aside>
            </div>
          </section>

          <section className="form-preview" id="date">
            <form className="form-panel" onSubmit={form.handleSubmit(onSubmit)} aria-labelledby="form-title">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Inscriere</p>
                  <h2 id="form-title">Completeaza cererea</h2>
                </div>
                <PrivacyTooltip />
              </div>

              <div className="form-group">
                <h3>Date parinte / reprezentant</h3>
                <div className="field-grid">
                  <TextField
                    label="Nume si prenume parinte"
                    registration={form.register("parentName")}
                    error={form.formState.errors.parentName?.message}
                  />
                  <TextField label="Telefon" registration={form.register("phone")} error={form.formState.errors.phone?.message} inputMode="tel" />
                  <TextField label="Adresa" registration={form.register("address")} error={form.formState.errors.address?.message} wide />
                  <TextField
                    label="Semnatura parinte / tutore"
                    registration={form.register("parentSignature")}
                    error={form.formState.errors.parentSignature?.message}
                    wide
                  />
                </div>
              </div>

              <div className="form-group">
                <h3>Date copil</h3>
                <div className="field-grid">
                  <TextField label="Nume si prenume copil" registration={form.register("childName")} error={form.formState.errors.childName?.message} />
                  <TextField label="CNP copil" registration={form.register("cnp")} error={form.formState.errors.cnp?.message} inputMode="numeric" />
                  <TextField
                    label="Gradinita / scoala"
                    registration={form.register("school")}
                    error={form.formState.errors.school?.message}
                  />
                  <TextField label="Grupa / clasa" registration={form.register("className")} error={form.formState.errors.className?.message} />
                  <TextField label="Data cererii" registration={form.register("date")} error={form.formState.errors.date?.message} type="date" />
                </div>
              </div>

              <div className="consent-row">
                <div>
                  <span>Acord imagine copil</span>
                  <p>Marcam DA sau NU in formularul oficial.</p>
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
                {isGenerating ? "Se genereaza..." : selectedCircles.length > 1 ? `Genereaza ${selectedCircles.length} PDF-uri (.zip)` : "Genereaza PDF-ul"}
              </button>
            </form>

            <aside className="next-panel" id="ajutor" aria-labelledby="next-title">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Trimitere</p>
                  <h2 id="next-title">Pasii urmatori</h2>
                </div>
                <Mail size={25} />
              </div>
              <ol className="next-list">
                <li>
                  <strong>Descarca documentul generat.</strong>
                  <span>{selectedCircles.length > 1 ? "Vei primi un ZIP cu cate un PDF pentru fiecare cerc." : "Vei primi un PDF completat."}</span>
                </li>
                <li>
                  <strong>Verifica PDF-ul si adauga copia certificatului.</strong>
                  <span>Copia certificatului de nastere sau a buletinului copilului ramane atasamentul tau separat.</span>
                </li>
                <li>
                  <strong>Trimite e-mailul pregatit.</strong>
                  <span>Foloseste Gmail in browser, clientul tau de e-mail sau copiaza textul manual.</span>
                </li>
              </ol>
              {downloadReady ? <p className="success-message">Documentul a fost descarcat. Acum poti deschide e-mailul pregatit.</p> : null}
              <div className="email-actions">
                <a className="mail-action" href={gmailHref} target="_blank" rel="noreferrer">
                  <Mail size={19} /> Deschide in Gmail
                </a>
                <a className="secondary-link mailto-link" href={emailHref}>
                  <Send size={18} /> Client e-mail
                </a>
              </div>
              <div className="email-draft" aria-label="Text e-mail pentru copiere manuala">
                <label>
                  <span>Catre</span>
                  <input readOnly value={emailDraft.to} />
                </label>
                <label>
                  <span>Subiect</span>
                  <input readOnly value={emailDraft.subject} />
                </label>
                <label className="draft-body">
                  <span>Mesaj</span>
                  <textarea readOnly value={emailDraft.body} />
                </label>
                <button className="copy-action" type="button" onClick={copyPreparedEmail}>
                  <Copy size={17} /> {copyStatus === "copied" ? "Text copiat" : "Copiaza textul"}
                </button>
                {copyStatus === "manual" ? <p>Selecteaza textul din casete si copiaza-l manual.</p> : null}
              </div>
              <p className="mail-note">Ataseaza manual PDF-ul sau ZIP-ul descarcat si copia certificatului de nastere/buletinului.</p>
              <a className="secondary-link wide-link" href={catalog.enrollment.pdfUrl} target="_blank" rel="noreferrer">
                <FileText size={18} /> Formular oficial gol <ExternalLink size={16} />
              </a>
            </aside>
          </section>

          <section className="program-section" id="program">
            <div className="location-callout">
              <Home size={54} />
              <div>
                <h2>Activitatile se desfasoara temporar in alte scoli din Arad</h2>
                <p>Pana la finalizarea noului sediu, cercurile sunt gazduite de unitatile publicate de Palatul Copiilor Arad.</p>
              </div>
              <a className="secondary-link" href="#program-list">
                Vezi programul si locatiile <ChevronRight size={18} />
              </a>
            </div>

            <div className="program-grid" id="program-list">
              {locationCards.map((card) => (
                <article className="location-card" key={card.location}>
                  <span className="location-number">{card.index}</span>
                  <div>
                    <h3>{card.location}</h3>
                    <p>{card.address}</p>
                    <div className="mini-tags">
                      {card.items.slice(0, 3).map((item) => (
                        <span key={`${card.location}-${item.circle.id}`}>{item.circle.name}</span>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="trust-strip" aria-label="Calitate tehnica">
            <TrustItem icon={<FileCheck2 />} title="PDF auto-completat" text="Cate un formular clar pentru fiecare cerc." />
            <TrustItem icon={<Github />} title="Git-friendly" text="Versiuni controlate si istoric clar." />
            <TrustItem icon={<Server />} title="Docker Compose" text="Pornire rapida pe portul 26453." />
            <TrustItem icon={<ShieldCheck />} title="Date in browser" text="Fara conturi, fara analytics." />
          </section>
        </main>

        <footer className="footer">
          <div className="footer-brand">
            <img src={`${import.meta.env.BASE_URL}assets/palatul-logo.jpg`} alt="" />
            <div>
              <strong>Palatul Copiilor Arad</strong>
              <span>Dezvoltam talente, construim viitorul.</span>
            </div>
          </div>
          <div className="footer-links">
            <a href={repoURL} target="_blank" rel="noreferrer">
              <Github size={17} /> GitHub repo
            </a>
            <a href={`mailto:${catalog.enrollment.email}`}>
              <Mail size={17} /> {catalog.enrollment.email}
            </a>
            <span>Frontend v{__APP_VERSION__}</span>
            <span>Backend API v{__APP_VERSION__}</span>
            <span>Port 26453</span>
          </div>
          <p>
            Made with <Heart size={15} fill="currentColor" /> by{" "}
            <a href="https://www.florinbadita.com/" target="_blank" rel="noreferrer">
              Florin Badita
            </a>
          </p>
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
    <article
      className={clsx("circle-card", checked && "checked")}
      data-testid={`circle-card-${circle.id}`}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button,label")) {
          return;
        }
        onToggle();
      }}
    >
      <div className="circle-art" aria-hidden="true">
        <img data-testid={`circle-image-${circle.id}`} src={circleImageSrc(circle)} alt="" />
      </div>
      <div className="circle-copy">
        <strong>{circle.name}</strong>
        <span>{circle.category}</span>
        <p>{circleDescription(circle)}</p>
        {firstSession ? (
          <small>
            {firstSession.location}, {firstSession.schedule}
          </small>
        ) : null}
      </div>
      <div className="select-row">
        <Checkbox.Root
          className="select-control"
          checked={checked}
          onCheckedChange={onToggle}
          id={circle.id}
          aria-label={`${checked ? "Scoate" : "Selecteaza"} ${circle.name}`}
        >
          <Checkbox.Indicator>
            <Check size={15} />
          </Checkbox.Indicator>
        </Checkbox.Root>
        <label htmlFor={circle.id}>{checked ? "Selectat" : "Selecteaza"}</label>
      </div>
    </article>
  );
}

function InfoCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <article className="info-card">
      <span>{icon}</span>
      <div>
        <h2>{title}</h2>
        {children}
      </div>
    </article>
  );
}

function StepCard({ number, icon, title, text }: { number: string; icon: ReactNode; title: string; text: string }) {
  return (
    <article className="step-card">
      <span className="step-number">{number}</span>
      <span className="step-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function TrustItem({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <article className="trust-item">
      <span>{icon}</span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
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
          Datele raman in browser si sunt folosite doar pentru documentele descarcate.
          <Tooltip.Arrow className="tooltip-arrow" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function downloadBlob(content: BlobPart | Uint8Array, filename: string, type: string) {
  const blob = content instanceof Blob ? content : new Blob([content as unknown as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

type EmailDraft = {
  to: string;
  subject: string;
  body: string;
};

function makeEmailDraft(form: Partial<EnrollmentFormData>, circles: Circle[]): EmailDraft {
  const childName = form.childName?.trim() || "[nume copil]";
  const parentName = form.parentName?.trim() || "[nume parinte]";
  const circleNames = circles.length > 0 ? circles.map((circle) => circle.name).join(", ") : "[cercuri selectate]";
  return {
    to: catalog.enrollment.email,
    subject: `Cerere inscriere Palatul Copiilor Arad - ${childName}`,
    body: [
      "Buna ziua,",
      "",
      `Atasez cererea/cererile de inscriere generate pentru copilul ${childName}.`,
      `Cercuri solicitate: ${circleNames}.`,
      "",
      "Atasez si copia certificatului de nastere sau a buletinului copilului.",
      "",
      "Multumesc,",
      parentName,
    ].join("\n"),
  };
}

function makeMailtoHref(draft: EmailDraft) {
  return `mailto:${draft.to}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
}

function makeGmailHref(draft: EmailDraft) {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: draft.to,
    su: draft.subject,
    body: draft.body,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

function formatEmailDraft(draft: EmailDraft) {
  return [`Catre: ${draft.to}`, `Subiect: ${draft.subject}`, "", draft.body].join("\n");
}

function categoryIcon(category: string) {
  if (category.includes("Artistice")) return <Palette className="category-symbol artistice" size={18} />;
  if (category.includes("Sportive")) return <Dumbbell className="category-symbol sportive" size={18} />;
  if (category.includes("Tehnico")) return <Cpu className="category-symbol tehnico" size={18} />;
  if (category.includes("Cultural")) return <Languages className="category-symbol cultural" size={18} />;
  return <BookOpen className="category-symbol" size={18} />;
}

function circleDescription(circle: Circle) {
  if (circle.category.includes("Artistice")) return "Culori, ritm si creativitate.";
  if (circle.category.includes("Sportive")) return "Miscare, disciplina si incredere.";
  if (circle.category.includes("Tehnico")) return "Logica, tehnologie si curiozitate.";
  if (circle.category.includes("Cultural")) return "Expresie, comunicare si cultura.";
  return "Activitate educativa pentru copii.";
}

type CircleVisual = {
  initials: string;
  accent: string;
  fill: string;
};

const categoryVisuals: Record<string, CircleVisual> = {
  Artistice: { initials: "AR", accent: "#7a4fd8", fill: "#f0e9ff" },
  Sportive: { initials: "SP", accent: "#21a55b", fill: "#eaf9f0" },
  "Tehnico-aplicative": { initials: "IT", accent: "#0b8f96", fill: "#e6fbff" },
  "Cultural-Civice": { initials: "CC", accent: "#f59b00", fill: "#fff4de" },
};

const circleVisuals: Record<string, CircleVisual> = {
  "aeromodele": { initials: "AV", accent: "#1384d6", fill: "#e8f5ff" },
  "arta-decorativa": { initials: "AD", accent: "#7a4fd8", fill: "#f0e9ff" },
  "ceramica": { initials: "CE", accent: "#b86b28", fill: "#fff0df" },
  "cultura-si-civilizatie-engleza-i": { initials: "EN", accent: "#f59b00", fill: "#fff4de" },
  "cultura-si-civilizatie-engleza-ii": { initials: "E2", accent: "#f59b00", fill: "#fff4de" },
  "cultura-si-civilizatie-germana": { initials: "DE", accent: "#f59b00", fill: "#fff4de" },
  "cultura-si-civilizatie-romaneasca": { initials: "RO", accent: "#f59b00", fill: "#fff4de" },
  "cultura-si-civilizatie-spaniola": { initials: "ES", accent: "#f59b00", fill: "#fff4de" },
  "dans-modern": { initials: "DM", accent: "#21a55b", fill: "#eaf9f0" },
  "dans-popular": { initials: "DP", accent: "#21a55b", fill: "#eaf9f0" },
  "dans-sportiv": { initials: "DS", accent: "#21a55b", fill: "#eaf9f0" },
  "desen-pictura": { initials: "DP", accent: "#7a4fd8", fill: "#f0e9ff" },
  "educatie-pentru-cetatenie-democratica": { initials: "ED", accent: "#f59b00", fill: "#fff4de" },
  "gimnastica-aerobica": { initials: "GA", accent: "#21a55b", fill: "#eaf9f0" },
  "informatica-multimedia": { initials: "IM", accent: "#0b8f96", fill: "#e6fbff" },
  "jocuri-logice": { initials: "JL", accent: "#0b8f96", fill: "#e6fbff" },
  "judo": { initials: "JU", accent: "#21a55b", fill: "#eaf9f0" },
  "karate": { initials: "KA", accent: "#21a55b", fill: "#eaf9f0" },
  "karting": { initials: "KT", accent: "#0b8f96", fill: "#e6fbff" },
  "muzica-vocal-instrumentala-canto": { initials: "CA", accent: "#7a4fd8", fill: "#f0e9ff" },
  "muzica-vocal-instrumentala-formatie": { initials: "MF", accent: "#7a4fd8", fill: "#f0e9ff" },
  "muzica-vocal-instrumentala-pian": { initials: "PI", accent: "#7a4fd8", fill: "#f0e9ff" },
  "muzica-vocal-instrumentala-taraf": { initials: "TA", accent: "#7a4fd8", fill: "#f0e9ff" },
  "pictura-pe-sticla": { initials: "PS", accent: "#7a4fd8", fill: "#f0e9ff" },
  "redactie-presa-radio-tv": { initials: "RT", accent: "#f59b00", fill: "#fff4de" },
  "sah": { initials: "SA", accent: "#21a55b", fill: "#eaf9f0" },
  "teatru": { initials: "TE", accent: "#f59b00", fill: "#fff4de" },
  "teatru-de-papusi": { initials: "TP", accent: "#f59b00", fill: "#fff4de" },
  "tenis-de-masa": { initials: "TM", accent: "#21a55b", fill: "#eaf9f0" },
};

function circleImageSrc(circle: Circle) {
  const visual = circleVisuals[circle.id] ?? categoryVisuals[circle.category] ?? categoryVisuals.Artistice;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="20" fill="${visual.fill}"/><circle cx="76" cy="20" r="17" fill="${visual.accent}" opacity=".18"/><circle cx="21" cy="78" r="16" fill="${visual.accent}" opacity=".14"/><path d="M22 64 C34 34 54 30 75 43" fill="none" stroke="${visual.accent}" stroke-width="8" stroke-linecap="round" opacity=".32"/><rect x="20" y="19" width="56" height="56" rx="16" fill="#fff" opacity=".78"/><text x="48" y="58" text-anchor="middle" font-family="Arial, sans-serif" font-size="25" font-weight="800" fill="${visual.accent}">${visual.initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
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
