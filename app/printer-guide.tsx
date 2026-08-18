"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "@/lib/catalog";
import { parseSafePositiveInteger, sanitizeSearchQuery } from "@/lib/security";
import { Ruta3DMark } from "./ruta-3d-mark";

type AnswerKey = "use" | "multicolor" | "large" | "technical" | "budget";
type Answers = Record<AnswerKey, string>;
type BudgetRange = { min: number | null; max: number | null };

const price = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const emptyAnswers: Answers = { use: "", multicolor: "", large: "", technical: "", budget: "" };
const guideStorageKey = "filtrar-3d-printer-guide-answers";
const guideResultsStorageKey = "filtrar-3d-printer-guide-results";
const guideBudgetMin = 300_000;
const guideBudgetMax = 3_000_000;
const guideBudgetStep = 50_000;
const multiheadPrinterNames = new Set(["Snapmaker U1", "Flashforge Creator 5 Pro"]);

const questions: Array<{ key: AnswerKey; question: string; options: Array<[string, string]> }> = [
  { key: "use", question: "¿Qué querés imprimir principalmente?", options: [["hobby", "Objetos, hobby y regalos"], ["functional", "Piezas funcionales y repuestos"], ["business", "Producción o emprendimiento"], ["unsure", "No sé todavía"]] },
  { key: "multicolor", question: "¿Con qué frecuencia pensás imprimir en varios colores?", options: [["never", "Nunca"], ["sometimes", "A veces"], ["often", "Todo el tiempo"], ["unsure", "No sé / me da igual"]] },
  { key: "large", question: "¿Vas a imprimir piezas grandes?", options: [["yes", "Sí, necesito mucho volumen"], ["no", "No, tamaño estándar"], ["unsure", "No sé todavía"]] },
  { key: "technical", question: "¿Querés usar materiales técnicos?", options: [["yes", "Sí, ABS, ASA, nylon o carbono"], ["no", "No, principalmente PLA y PETG"], ["unsure", "No sé qué materiales voy a usar"]] },
];

const profiles = [
  { name: "Bambu Lab A1 Mini", terms: ["a1 mini"], combo: false, uses: ["hobby", "miniatures"], multicolor: false, large: false, technical: false, enclosed: false, budget: "entry", note: "Para empezar con proyectos cotidianos y figuras pequeñas en un formato compacto.", features: ["Sin sistema AMS incluido", "Cama de impresión estándar", "Estructura abierta"] },
  { name: "Bambu Lab A1 Mini Combo", terms: ["a1 mini"], combo: true, uses: ["hobby", "miniatures"], multicolor: true, large: false, technical: false, enclosed: false, budget: "mid", note: "La A1 Mini con sistema AMS para imprimir en varios colores.", features: ["Multicolor con AMS", "Cama de impresión estándar", "Estructura abierta"] },
  { name: "Bambu Lab A1", terms: ["bambu lab a1", "bambulab a1"], combo: false, uses: ["hobby", "functional", "miniatures"], multicolor: false, large: false, technical: false, enclosed: false, budget: "mid", note: "Una opción equilibrada para objetos, hobby y repuestos.", features: ["Sin sistema AMS incluido", "Cama de impresión estándar", "Estructura abierta"] },
  { name: "Bambu Lab A1 Combo", terms: ["bambu lab a1", "bambulab a1"], combo: true, uses: ["hobby", "functional", "miniatures"], multicolor: true, large: false, technical: false, enclosed: false, budget: "mid", note: "La A1 con AMS para quienes priorizan trabajos multicolor.", features: ["Multicolor con AMS", "Cama de impresión estándar", "Estructura abierta"] },
  { name: "Elegoo Centauri Carbon", terms: ["centauri carbon"], combo: false, uses: ["functional", "business"], multicolor: false, large: false, technical: true, enclosed: true, budget: "mid", note: "Para piezas funcionales y materiales más exigentes.", features: ["Sin sistema multicolor incluido", "Cama de impresión estándar", "Estructura cerrada"] },
  { name: "Bambu Lab P1S", terms: ["bambu lab p1s", "bambulab p1s"], combo: false, uses: ["functional", "business"], multicolor: false, large: false, technical: true, enclosed: true, budget: "high", note: "Una alternativa cerrada para ampliar los materiales que usás.", features: ["Sin sistema AMS incluido", "Cama de impresión estándar", "Estructura cerrada"] },
  { name: "Bambu Lab P1S Combo", terms: ["bambu lab p1s", "bambulab p1s"], combo: true, uses: ["functional", "business"], multicolor: true, large: false, technical: true, enclosed: true, budget: "high", note: "La P1S con AMS para combinar materiales y colores.", features: ["Multicolor con AMS", "Cama de impresión estándar", "Estructura cerrada"] },
  { name: "Flashforge AD5X", terms: ["ad5x"], combo: true, uses: ["hobby", "functional"], multicolor: true, large: false, technical: false, enclosed: false, budget: "mid", note: "Una alternativa multicolor para usar de vez en cuando.", features: ["Multicolor con IFS", "Cama de impresión estándar", "Estructura abierta"] },
  { name: "Snapmaker U1", terms: ["snapmaker u1"], combo: false, uses: ["functional", "business"], multicolor: true, large: false, technical: true, enclosed: true, budget: "pro", note: "Multicolor intensivo con cuatro cabezales de impresión.", features: ["Multicolor, 4 cabezales", "Cama de impresión estándar", "Estructura cerrada"] },
  { name: "Flashforge Creator 5 Pro", terms: ["creator 5 pro"], combo: false, uses: ["business"], multicolor: true, large: false, technical: true, enclosed: true, budget: "pro", note: "Para producción multicolor frecuente con cuatro cabezales.", features: ["Multicolor, 4 cabezales", "Cama de impresión estándar", "Estructura cerrada"] },
  { name: "Creality K2 Plus", terms: ["k2 plus"], combo: false, uses: ["functional", "business"], multicolor: false, large: true, technical: true, enclosed: true, budget: "pro", note: "Para volumen de impresión alto y proyectos ambiciosos.", features: ["Sin sistema multicolor incluido", "Cama de impresión grande", "Estructura cerrada"] },
] as const;

function publicOpinion(name: string) {
  if (name === "Bambu Lab P1S" || name === "Bambu Lab P1S Combo") return { summary: "En reseñas especializadas destaca por imprimir rápido y con buena calidad; el sistema cerrado es un punto fuerte para materiales exigentes.", source: "All3DP", url: "https://all3dp.com/1/bambu-lab-p1s-review-3d-printer-specs/" };
  if (name === "Elegoo Centauri Carbon") return { summary: "La opinión general valora su velocidad, capacidades y relación precio-prestaciones, aunque algunas reseñas señalan detalles de software por pulir.", source: "VoxelMatters", url: "https://www.voxelmatters.com/elegoo-centauri-carbon-review-fast-capable-slightly-unfinished/" };
  if (name === "Flashforge AD5X") return { summary: "Las reseñas destacan buena calidad de impresión y multicolor accesible; el software de laminado es el punto que más divide opiniones.", source: "Tom's Hardware", url: "https://www.tomshardware.com/3d-printing/flashforge-ad5x-review" };
  return { summary: "Todavía no hay una síntesis editorial conectada para este modelo. Consultá opiniones recientes antes de decidir.", source: "Buscar opiniones online", url: `https://www.google.com/search?q=${encodeURIComponent(`${name} review`)}` };
}

function parsePriceInput(value: string) {
  return parseSafePositiveInteger(value);
}

function priceRangeLabel(min: number | null, max: number | null) {
  if (min === null && max === null) return "Elegí un mínimo y un máximo";
  if (min !== null && max !== null) return `${price.format(min)} - ${price.format(max)}`;
  if (min !== null) return `Desde ${price.format(min)}`;
  return `Hasta ${price.format(max ?? 0)}`;
}

function budgetFromRange(max: number | null) {
  if (max === null) return "pro";
  if (max <= 700_000) return "entry";
  if (max <= 1_500_000) return "mid";
  if (max <= 3_000_000) return "high";
  return "pro";
}

function orderedRange(min: number | null, max: number | null) {
  if (min !== null && max !== null && min > max) return { min: max, max: min };
  return { min, max };
}

function productMatchesBudgetRange(product: Product, range: BudgetRange | null) {
  return (!range?.min || product.bestPrice >= range.min) && (!range?.max || product.bestPrice <= range.max);
}

function buyerFit(profile: typeof profiles[number], answers: Answers) {
  const checks: Array<{ label: string; level: "yes" | "partial" | "no" }> = [];
  const multihead = multiheadPrinterNames.has(profile.name);
  if (answers.use !== "unsure") checks.push({ label: "Uso principal", level: profile.uses.includes(answers.use as never) ? "yes" : "no" });
  if (answers.multicolor === "sometimes") checks.push({ label: "Multicolor a veces", level: profile.multicolor ? "yes" : "no" });
  if (answers.multicolor === "often") checks.push({ label: "Multicolor todo el tiempo", level: multihead ? "yes" : profile.multicolor ? "partial" : "no" });
  if (answers.multicolor === "never") checks.push({ label: "Uso principal en un color", level: "yes" });
  if (answers.large === "yes") checks.push({ label: "Cama de gran volumen", level: profile.large ? "yes" : "no" });
  if (answers.technical === "yes") checks.push({ label: "Materiales técnicos", level: profile.technical ? "yes" : "no" });
  return checks;
}

export function PrinterGuide({ products }: { products: Product[] }) {
  const [answers, setAnswers] = useState<Answers>(emptyAnswers);
  const [budgetMin, setBudgetMinState] = useState<number | null>(null);
  const [budgetMax, setBudgetMaxState] = useState<number | null>(null);
  const [answersRestored, setAnswersRestored] = useState(false);
  const [isPreparingResults, setIsPreparingResults] = useState(false);
  const [showAllRecommendations, setShowAllRecommendations] = useState(false);
  const [searchedAnswers, setSearchedAnswers] = useState<Answers | null>(null);
  const [searchedBudgetRange, setSearchedBudgetRange] = useState<BudgetRange | null>(null);
  const [modelSearch, setModelSearch] = useState("");
  const resultsTimer = useRef<number | null>(null);
  const prepareResults = () => {
    if (resultsTimer.current) window.clearTimeout(resultsTimer.current);
    setIsPreparingResults(true);
    setShowAllRecommendations(false);
    resultsTimer.current = window.setTimeout(() => {
      setIsPreparingResults(false);
      resultsTimer.current = null;
    }, 2400);
  };
  const updateAnswer = (key: AnswerKey, value: string) => setAnswers({ ...answers, [key]: value });
  const setBudgetRange = (min: number | null, max: number | null) => {
    const nextRange = orderedRange(min, max);
    setBudgetMinState(nextRange.min);
    setBudgetMaxState(nextRange.max);
    setAnswers((current) => ({ ...current, budget: nextRange.min === null && nextRange.max === null ? "" : budgetFromRange(nextRange.max) }));
  };
  const setBudgetMin = (value: number | null) => setBudgetRange(value, budgetMax);
  const setBudgetMax = (value: number | null) => setBudgetRange(budgetMin, value);
  const setBudgetUnknown = () => {
    setBudgetMinState(null);
    setBudgetMaxState(null);
    setAnswers((current) => ({ ...current, budget: "unsure" }));
  };
  const searchPrinters = () => {
    if (!Object.values(answers).every(Boolean)) return;
    setSearchedAnswers(answers);
    setSearchedBudgetRange(answers.budget === "unsure" ? null : { min: budgetMin, max: budgetMax });
    localStorage.setItem(guideResultsStorageKey, JSON.stringify(answers));
    prepareResults();
  };
  useEffect(() => {
    let restoredAnswers = emptyAnswers;
    let restoredResults: Answers | null = null;
    try {
      const saved = JSON.parse(localStorage.getItem(guideStorageKey) ?? "null");
      if (saved && Object.keys(emptyAnswers).every((key) => typeof saved[key] === "string")) {
        restoredAnswers = { ...emptyAnswers, ...saved, use: saved.use === "miniatures" ? "hobby" : saved.use, multicolor: saved.multicolor === "yes" ? "sometimes" : saved.multicolor === "no" ? "never" : saved.multicolor };
      }
      const savedResults = JSON.parse(localStorage.getItem(guideResultsStorageKey) ?? "null");
      if (savedResults && Object.keys(emptyAnswers).every((key) => typeof savedResults[key] === "string")) {
        restoredResults = { ...emptyAnswers, ...savedResults, use: savedResults.use === "miniatures" ? "hobby" : savedResults.use, multicolor: savedResults.multicolor === "yes" ? "sometimes" : savedResults.multicolor === "no" ? "never" : savedResults.multicolor };
      }
    } catch {
      // Keep the blank form when local storage cannot be read.
    }
    const restoreTimer = window.setTimeout(() => {
      setAnswers(restoredAnswers);
      setSearchedAnswers(restoredResults);
      setAnswersRestored(true);
    }, 0);
    return () => {
      window.clearTimeout(restoreTimer);
      if (resultsTimer.current) window.clearTimeout(resultsTimer.current);
    };
  }, []);
  useEffect(() => { if (answersRestored) localStorage.setItem(guideStorageKey, JSON.stringify(answers)); }, [answers, answersRestored]);
  const complete = Object.values(answers).every(Boolean);
  const currentBudgetRange = answers.budget === "unsure" ? null : { min: budgetMin, max: budgetMax };
  const hasPendingChanges = Boolean(
    searchedAnswers &&
      (JSON.stringify(searchedAnswers) !== JSON.stringify(answers) ||
        JSON.stringify(searchedBudgetRange) !== JSON.stringify(currentBudgetRange)),
  );
  const budgetMinSliderValue = Math.max(guideBudgetMin, Math.min(budgetMin ?? guideBudgetMin, guideBudgetMax));
  const budgetMaxSliderValue = Math.max(guideBudgetMin, Math.min(budgetMax ?? guideBudgetMax, guideBudgetMax));
  const budgetDisplay = answers.budget === "unsure" ? "No sé todavía" : priceRangeLabel(budgetMin, budgetMax);
  const recommendations = useMemo(() => profiles.map((profile) => {
    if (!searchedAnswers) return null;
    const isMultihead = multiheadPrinterNames.has(profile.name);
    if (["sometimes", "often"].includes(searchedAnswers.multicolor) && !profile.multicolor) return null;
    if (searchedAnswers.technical === "yes" && !profile.enclosed) return null;
    if (searchedAnswers.large === "yes" && profile.name.includes("A1 Mini")) return null;
    const offers = products
      .filter((product) => product.isFdmPrinter)
      .filter((product) => /\b(impresora|printer)\b/i.test(product.name))
      .filter((product) => profile.terms.some((term) => product.searchText.includes(term)))
      .filter((product) => !["Bambu Lab A1", "Bambu Lab A1 Combo"].includes(profile.name) || !product.searchText.includes("a1 mini"))
      .filter((product) => profile.combo ? /\b(combo|ams)\b/i.test(product.name) : !/\b(combo|ams)\b/i.test(product.name))
      .filter((product) => productMatchesBudgetRange(product, searchedBudgetRange))
      .sort((a, b) => Number(b.stock !== "Consultar") - Number(a.stock !== "Consultar") || a.bestPrice - b.bestPrice)
      .filter((offer, index, list) => list.findIndex((candidate) => candidate.store === offer.store) === index);
    if (!offers.length) return null;
    const score = buyerFit(profile, searchedAnswers).filter((check) => check.level === "yes").length + Number(isMultihead && searchedAnswers.multicolor === "often");
    return { profile, offers: offers.slice(0, 3), score };
  }).filter((entry): entry is { profile: typeof profiles[number]; offers: Product[]; score: number } => Boolean(entry)).sort((a, b) => b.score - a.score || a.offers[0].bestPrice - b.offers[0].bestPrice), [products, searchedAnswers, searchedBudgetRange]);
  const safeModelSearch = sanitizeSearchQuery(modelSearch);
  const matchedRecommendations = safeModelSearch ? recommendations.filter(({ profile }) => profile.name.toLocaleLowerCase("es-AR").includes(safeModelSearch.toLocaleLowerCase("es-AR"))) : recommendations;
  const catalogSearchMatches = useMemo(() => {
    const query = sanitizeSearchQuery(modelSearch).toLocaleLowerCase("es-AR");
    if (!query) return [];
    return products.filter((product) => product.isFdmPrinter && /\b(impresora|printer)\b/i.test(product.name) && product.searchText.includes(query)).sort((a, b) => a.bestPrice - b.bestPrice).filter((product, index, list) => list.findIndex((candidate) => candidate.name === product.name) === index);
  }, [modelSearch, products]);
  const visibleRecommendations = showAllRecommendations || safeModelSearch ? matchedRecommendations : matchedRecommendations.slice(0, 3);
  const remainingRecommendations = Math.max(0, matchedRecommendations.length - 3);
  const hasNoBudgetMatches = Boolean(searchedBudgetRange && recommendations.length === 0 && !safeModelSearch);

  return (
    <main className="printer-guide-page">
      <header className="site-header guide-site-header">
        <div className="site-header-main"><Link className="site-header-brand" href="/" aria-label="Ruta 3D, inicio"><Ruta3DMark className="site-header-mark" /></Link><div className="site-header-actions"><a className="header-contact" href="mailto:lok3d.co@gmail.com">Contacto</a></div></div>
        <nav className="site-header-nav" aria-label="Navegación principal"><Link href="/#comparador">Comparador</Link><Link href="/#como-funciona">Cómo funciona</Link><Link className="printer-guide-trigger" href="/que-impresora-compro">¿Qué impresora compro?</Link><Link href="/#transparencia">Precios y stock</Link><Link href="/#sumar-tienda">Sumá tu tienda</Link></nav>
      </header>
      <section className="guide-intro">
        <div><h1>¿Qué impresora compro?</h1><p>Contanos qué querés hacer. Te proponemos impresoras FDM de filamento disponibles y las tiendas argentinas que las tienen.</p></div>
        <span>Guía de compra</span>
      </section>
      <section className="guide-workspace" aria-label="Recomendador de impresoras">
        <div className="guide-form">
          <h2>Elegí lo que hoy sabés</h2>
          <p>No hace falta tener todo definido: “No sé” también es una respuesta útil.</p>
          {questions.map(({ key, question, options }) => <fieldset key={key}><legend>{question}</legend><div>{options.map(([value, label]) => <button key={value} type="button" className={answers[key] === value ? "selected" : ""} aria-pressed={answers[key] === value} onClick={() => updateAnswer(key, value)}>{label}</button>)}</div></fieldset>)}
          <fieldset className="guide-budget"><legend>¿Cuál es tu presupuesto aproximado?</legend><div className="guide-budget-value">{budgetDisplay}</div><div className="dual-range guide-dual-range"><input type="range" min={guideBudgetMin} max={guideBudgetMax} step={guideBudgetStep} value={budgetMinSliderValue} onChange={(event) => setBudgetMin(Number(event.target.value))} aria-label="Presupuesto mínimo" /><input type="range" min={guideBudgetMin} max={guideBudgetMax} step={guideBudgetStep} value={budgetMaxSliderValue} onChange={(event) => setBudgetMax(Number(event.target.value))} aria-label="Presupuesto máximo" /></div><div className="guide-budget-labels"><span>$300k</span><span>$1.5M</span><span>$3M</span></div><div className="price-inputs guide-price-inputs"><label><span>Mínimo</span><input inputMode="numeric" value={budgetMin ?? ""} placeholder={String(guideBudgetMin)} onChange={(event) => setBudgetMin(parsePriceInput(event.target.value))} /></label><label><span>Máximo</span><input inputMode="numeric" value={budgetMax ?? ""} placeholder={String(guideBudgetMax)} onChange={(event) => setBudgetMax(parsePriceInput(event.target.value))} /></label></div><button type="button" className={answers.budget === "unsure" ? "selected" : ""} aria-pressed={answers.budget === "unsure"} onClick={setBudgetUnknown}>No sé todavía</button></fieldset>
          <button type="button" className="guide-submit" disabled={!complete || isPreparingResults} onClick={searchPrinters}>{isPreparingResults ? "Buscando impresoras…" : "Buscar impresoras"}<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 8h10M8.5 3.5 13 8l-4.5 4.5" /></svg></button>
          {searchedAnswers ? <button type="button" className="guide-reset" onClick={() => { if (resultsTimer.current) window.clearTimeout(resultsTimer.current); localStorage.removeItem(guideResultsStorageKey); setIsPreparingResults(false); setSearchedAnswers(null); setSearchedBudgetRange(null); setBudgetMinState(null); setBudgetMaxState(null); setAnswers(emptyAnswers); }}>Limpiar búsqueda</button> : null}
        </div>
        <aside className="guide-results" aria-live="polite">
          {!searchedAnswers ? <div className="guide-empty"><h2>Tus recomendaciones van a aparecer acá</h2><p>Elegí una opción en cada pregunta y tocá “Buscar impresoras” para ver modelos, fotos y ofertas reales.</p></div> : isPreparingResults ? <div className="guide-loading" role="status"><div className="guide-loading-copy"><span>Buscando las mejores opciones</span><h2>Estamos preparando tus recomendaciones</h2><p>Comparamos tus respuestas con el catálogo disponible.</p></div><div className="guide-loading-progress" aria-hidden="true"><i /></div><small>Esto demora solo unos segundos</small></div> : <><div className="guide-results-heading"><h2>Modelos para vos</h2><p>{hasPendingChanges ? "Cambiaste algunas respuestas. Tocá “Buscar impresoras” para actualizar esta lista." : "Ordenados según tus respuestas y el catálogo conectado."}</p><label className="guide-model-search"><span>Buscar un modelo recomendado</span><input value={modelSearch} onChange={(event) => setModelSearch(event.target.value)} placeholder="Ej. Bambu Lab P1S" /></label></div><div className="guide-criteria-legend" aria-label="Criterio de compatibilidad"><span><b className="yes">✓</b>Cumple</span><span><b className="partial">—</b>Cumple con límites</span><span><b className="no">×</b>No cumple</span><small>Los requisitos indispensables excluyen el modelo: materiales técnicos requieren estructura cerrada y gran volumen requiere cama grande.</small></div>{matchedRecommendations.length === 0 ? <div className="guide-empty guide-search-empty"><h2>No encontramos ese modelo entre los perfiles evaluados</h2><p>La guía evalúa perfiles FDM con especificaciones verificadas; podés buscar el modelo en el comparador general.</p></div> : visibleRecommendations.map(({ profile, offers }) => {
            const checks = buyerFit(profile, searchedAnswers);
            const unmetCriteria = checks.filter((check) => check.level !== "yes").length;
            const fit = unmetCriteria === 0 ? 3 : unmetCriteria === 1 ? 2 : 1;
            const opinion = publicOpinion(profile.name);
            return <article key={profile.name} className="guide-model"><div className="guide-model-photo">{offers[0].image ? <Image src={offers[0].image} alt={offers[0].name} fill sizes="(max-width: 760px) 90vw, 300px" /> : <span>3D</span>}</div><div className="guide-model-copy"><div className="guide-model-title"><h3>{profile.name}</h3><span className={profile.combo ? "combo-badge" : "base-badge"}>{profile.combo ? "FDM · Combo / AMS" : "Impresora FDM"}</span></div><p>{profile.note}</p><ul className="guide-model-features">{profile.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>{checks.length ? <ul className="guide-buyer-fit">{checks.map((check) => <li className={check.level} key={check.label}><span>{check.level === "yes" ? "✓" : check.level === "partial" ? "—" : "×"}</span>{check.label}</li>)}</ul> : null}<div className={`guide-fit fit-${fit}`} aria-label={`Nivel de recomendación: ${fit} de 3`}><span>Qué tan recomendada para vos</span><i aria-hidden="true">{[1, 2, 3].map((bar) => <b className={bar <= fit ? "active" : ""} key={bar} />)}</i></div><div className="guide-public-opinion"><div><span>Opinión general online</span><strong>{opinion.summary}</strong><a href={opinion.url} target="_blank" rel="noreferrer">{opinion.source.startsWith("Buscar") ? "Buscar opiniones recientes" : `Leer reseña en ${opinion.source}`}</a></div></div><strong>Desde {price.format(offers[0].bestPrice)}</strong><div className="guide-offers">{offers.map((offer) => <a key={offer.id} href={offer.url} target="_blank" rel="noreferrer"><span>{offer.store}</span><b>{price.format(offer.bestPrice)}</b><small>{offer.stock}</small></a>)}</div><Link className="guide-search-model" href={`/?q=${encodeURIComponent(profile.name)}`}>Buscar esta impresora en el comparador</Link></div></article>;
          })}{remainingRecommendations > 0 && !safeModelSearch ? <button type="button" className="guide-more-recommendations" aria-expanded={showAllRecommendations} onClick={() => setShowAllRecommendations((current) => !current)}><span>{showAllRecommendations ? "Ver menos impresoras" : `Ver ${remainingRecommendations} impresora${remainingRecommendations === 1 ? "" : "s"} más`}</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 6 5 5 5-5" /></svg></button> : null}</>}
          {hasNoBudgetMatches ? <div className="guide-budget-empty"><h2>No hay impresoras por ese precio</h2><p>Probá ampliar el mínimo o máximo del presupuesto para ver las impresoras FDM disponibles.</p></div> : null}
          {safeModelSearch && catalogSearchMatches.length ? <section className="guide-catalog-search-results" aria-label="Impresoras encontradas en el comparador"><h2>También encontradas en el comparador</h2><p>Estas publicaciones no tienen todavía una ficha técnica curada para medir todos los criterios.</p>{catalogSearchMatches.filter((product) => !profiles.some((profile) => profile.terms.some((term) => product.searchText.includes(term)))).map((product) => <article key={product.id} className="guide-catalog-match"><div><h3>{product.name}</h3><span>Impresora FDM</span></div><strong>Desde {price.format(product.bestPrice)}</strong><Link href={`/?q=${encodeURIComponent(product.name)}`}>Ver todas las ofertas</Link></article>)}</section> : null}
        </aside>
      </section>
      <p className="guide-disclaimer">Las recomendaciones son orientativas. Confirmá especificaciones, precio y stock en la tienda antes de comprar.</p>
    </main>
  );
}
