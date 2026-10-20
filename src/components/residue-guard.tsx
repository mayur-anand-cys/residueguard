import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CheckCircle,
  Clock,
  Database,
  FlaskConical,
  QrCode,
  Scale,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sprout,
} from "lucide-react";
import { useTranslation, labelClass } from "@/i18n/useTranslation";
import { formatUtcTimestamp } from "@/i18n/translate";
import type { MessageKey } from "@/i18n/translations";
import { LanguageSwitch } from "@/components/language-switch";
import { appendEvent, demonstratePayloadTamper, verifyChain } from "@/lib/audit/chain";
import {
  browserStore,
  buildExport,
  ensureDemonstrationChain,
  readStore,
  writeStore,
} from "@/lib/audit/store";
import type { AuditEvent, AuditStoreData, VerificationResult } from "@/lib/audit/types";
import {
  AUDIT_LOT,
  CHEMICALS,
  CHEMICAL_NAMES,
  CROPS,
  DATA_MOAT,
  auditDecayCurve,
  evaluate,
  formatFixed,
  formatMrl,
  type ChemicalName,
  type ComplianceInput,
  type ComplianceResult,
  type CropName,
  type Market,
  type Verdict,
} from "@/lib/kinetics";

type TabId = "dashboard" | "audit" | "policy" | "moat";

interface FormState {
  crop: CropName;
  chemical: ChemicalName;
  market: Market;
  doseApplied: string;
  labelDose: string;
  daysToHarvest: string;
}

const TABS: { id: TabId; labelKey: MessageKey; icon: typeof Sprout }[] = [
  { id: "dashboard", labelKey: "nav.dashboard", icon: Sprout },
  { id: "audit", labelKey: "nav.audit", icon: ShieldCheck },
  { id: "policy", labelKey: "nav.policy", icon: Scale },
  { id: "moat", labelKey: "nav.moat", icon: Database },
];

const INITIAL_FORM: FormState = {
  crop: "Grapes",
  chemical: "Azoxystrobin",
  market: "Domestic",
  doseApplied: "1.5",
  labelDose: "1.0",
  daysToHarvest: "10",
};

const CONTROL =
  "h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm";

export function ResidueGuard() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabId>("dashboard");
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [pulse, setPulse] = useState(0);

  const parsed = useMemo(() => readForm(form), [form]);
  const result = parsed.ok ? evaluate(parsed.input) : null;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="h-1 bg-emerald-600" />
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Shield className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-base font-bold tracking-tight">ResidueGuard</p>
              <p className="text-xs text-slate-500">{t("brand.tagline")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <p className="hidden text-xs font-semibold uppercase tracking-wider text-slate-500 sm:block">{t("brand.institute")}</p>
            <LanguageSwitch />
          </div>
        </div>
        <nav className="mx-auto grid max-w-6xl grid-cols-2 gap-2 px-4 pb-3 sm:flex" aria-label={t("nav.primary")}>
          {TABS.map((item) => {
            const active = tab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => setTab(item.id)}
                className={
                  "flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors sm:justify-start " +
                  (active
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100")
                }
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t(item.labelKey)}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {tab === "dashboard" ? (
          <Dashboard
            form={form}
            setForm={setForm}
            result={result}
            error={parsed.ok ? null : t(parsed.error as MessageKey)}
            pulse={pulse}
            onCalculate={() => {
              setPulse((n) => n + 1);
              document.getElementById("compliance-verdict")?.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
              });
            }}
          />
        ) : null}
        {tab === "audit" ? <BuyerAudit /> : null}
        {tab === "policy" ? <PolicySimulator /> : null}
        {tab === "moat" ? <DataMoat /> : null}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl space-y-1 px-4 py-5 text-center text-xs text-slate-500">
          <p>
            {t("footer.credit")}
          </p>
          <p>{t("footer.disclaimer")}</p>
        </div>
      </footer>
    </div>
  );
}

function Dashboard({
  form,
  setForm,
  result,
  error,
  pulse,
  onCalculate,
}: {
  form: FormState;
  setForm: (next: FormState) => void;
  result: ComplianceResult | null;
  error: string | null;
  pulse: number;
  onCalculate: () => void;
}) {
  const { t } = useTranslation();
  const spec = CHEMICALS[form.chemical];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">{t("dash.kicker")}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{t("dash.title")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">{t("dash.subtitle")}</p>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={t("dash.status")}>
        <Kpi label={t("kpi.active")} value="24" icon={<Sprout className="h-4 w-4" />} tone="slate" />
        <Kpi label={t("kpi.safe")} value="18" icon={<CheckCircle className="h-4 w-4" />} tone="emerald" />
        <Kpi label={t("kpi.delay")} value="4" icon={<Clock className="h-4 w-4" />} tone="amber" />
        <Kpi label={t("kpi.rejection")} value="2" icon={<ShieldAlert className="h-4 w-4" />} tone="rose" />
      </section>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{t("form.title")}</h2>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" aria-hidden="true" />{t("form.live")}
            </span>
          </div>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              onCalculate();
            }}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="crop">{t("form.crop")}</FieldLabel>
                <select
                  id="crop"
                  className={CONTROL}
                  value={form.crop}
                  onChange={(event) => setForm({ ...form, crop: event.target.value as CropName })}
                >
                  {CROPS.map((crop) => (
                    <option key={crop}>{crop}</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel htmlFor="chemical">{t("form.chemical")}</FieldLabel>
                <select
                  id="chemical"
                  className={CONTROL}
                  value={form.chemical}
                  onChange={(event) =>
                    setForm({ ...form, chemical: event.target.value as ChemicalName })
                  }
                >
                  {CHEMICAL_NAMES.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </div>
            </div>

            <fieldset>
              <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">{t("form.market")}</legend>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["Domestic", t("form.fssai")],
                    ["EU", t("form.eu")],
                  ] as const
                ).map(([value, label]) => {
                  const selected = form.market === value;
                  return (
                    <label
                      key={value}
                      className={
                        "flex min-h-11 cursor-pointer items-center justify-center rounded-lg border text-sm font-semibold " +
                        (selected
                          ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 bg-white text-slate-600")
                      }
                    >
                      <input
                        type="radio"
                        name="market"
                        className="sr-only"
                        checked={selected}
                        onChange={() => setForm({ ...form, market: value })}
                      />
                      {label}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <NumberField
                id="dose-applied"
                label={t("form.dose")}
                value={form.doseApplied}
                step="0.1"
                onChange={(doseApplied) => setForm({ ...form, doseApplied })}
              />
              <NumberField
                id="label-dose"
                label={t("form.labelDose")}
                value={form.labelDose}
                step="0.1"
                onChange={(labelDose) => setForm({ ...form, labelDose })}
              />
              <NumberField
                id="days-to-harvest"
                label={t("form.days")}
                value={form.daysToHarvest}
                step="1"
                onChange={(daysToHarvest) => setForm({ ...form, daysToHarvest })}
              />
            </div>

            <dl className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm sm:grid-cols-4">
              <SpecItem label={t("form.phi")} value={`${spec.phi} d`} />
              <SpecItem label={t("form.dt50")} value={`${spec.dt50} d`} />
              <SpecItem label={t("form.fssaiMrl")} value={`${formatMrl(spec.mrl_fssai)}`} />
              <SpecItem
                label={t("form.euStatus")}
                value={spec.eu_approved ? t("form.approved") : t("form.notApproved")}
              />
            </dl>

            <button
              type="submit"
              className="btn-lift min-h-11 w-full rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
            >{t("form.calculate")}
            </button>
          </form>
        </section>

        <VerdictCard result={result} error={error} pulse={pulse} />
      </div>
    </div>
  );
}

function VerdictCard({
  result,
  error,
  pulse,
}: {
  result: ComplianceResult | null;
  error: string | null;
  pulse: number;
}) {
  const { t } = useTranslation();
  if (!result) {
    return (
      <section
        id="compliance-verdict"
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        aria-live="polite"
      >
        <h2 className="text-lg font-semibold">{t("verdict.heading")}</h2>
        <p className="mt-3 text-sm text-slate-600">{error}</p>
      </section>
    );
  }

  const theme = VERDICT_THEME[result.verdict];
  const Icon = result.verdict === "SAFE" ? CheckCircle : ShieldAlert;
  const reason =
    result.verdict === "DO_NOT_USE"
      ? t("verdict.reason.banned")
      : result.verdict === "DELAY_HARVEST"
        ? t("verdict.reason.delay", { days: result.msi - result.daysToHarvest, msi: result.msi })
        : t("verdict.reason.safe", { msi: result.msi });
  const narrative = t("verdict.narrative", {
    ratio: formatFixed(result.doseRatio, 2),
    signed: `${result.doseAdj >= 0 ? "+" : ""}${Math.round(result.doseAdj)}`,
  });

  return (
    <section
      id="compliance-verdict"
      key={`${result.verdict}-${pulse}`}
      aria-live="polite"
      className={`verdict-pop rounded-xl border p-5 shadow-sm ${theme.card}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${theme.icon}`}
        >
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("verdict.heading")}
          </p>
          <h2 className={`text-3xl font-extrabold tracking-tight ${theme.title}`}>{t(`verdict.${result.verdict}` as MessageKey)}</h2>
          <p className="mt-1 text-sm font-medium text-slate-800">{reason}</p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <FlaskConical className="h-4 w-4" aria-hidden="true" />
          {t("verdict.explain")}
        </div>
        <p className="text-sm font-medium text-slate-900">
          {result.verdict === "DO_NOT_USE" ? reason : narrative}
        </p>
        {result.verdict === "DO_NOT_USE" ? (
          <p className="mt-1 text-sm text-slate-600">
            {t("verdict.noAuth")}
          </p>
        ) : null}
        <dl className="mt-3 space-y-1 text-xs tabular-nums text-slate-600">
          <div className="flex justify-between gap-3">
            <dt>{t("verdict.k")}</dt>
            <dd>
              {formatFixed(result.k, 4)} d<sup>-1</sup>
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>{t("verdict.phiLabel")}</dt>
            <dd>{result.phi} days</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>{t("verdict.doseAdj")}</dt>
            <dd>
              {result.doseAdj >= 0 ? "+" : ""}
              {formatFixed(result.doseAdj, 2)} days
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>{t("verdict.marketAdj")}</dt>
            <dd>+{formatFixed(result.marketAdj, 2)} days</dd>
          </div>
          <div className="flex justify-between gap-3 font-semibold text-slate-900">
            <dt>{t("verdict.msi")}</dt>
            <dd>{result.msi} days</dd>
          </div>
        </dl>
      </div>

      <div className="mt-4 flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-3">
        <QrMark value={result.lotId} />
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <QrCode className="h-4 w-4" aria-hidden="true" />
            Lot passport
          </div>
          <p className="text-sm font-semibold text-slate-900">{t("verdict.lotId")}: {result.lotId}</p>
          <p className="mt-1 text-xs text-slate-500">
            {result.verdict === "SAFE"
              ? t("verdict.attach")
              : t("verdict.hold")}
          </p>
        </div>
      </div>
    </section>
  );
}

function BuyerAudit() {
  const { t, lang } = useTranslation();
  const [store, setStore] = useState<AuditStoreData | null>(null);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const proof = evaluate({
    crop: AUDIT_LOT.crop,
    chemical: AUDIT_LOT.chemical,
    market: AUDIT_LOT.market,
    doseApplied: AUDIT_LOT.doseApplied,
    labelDose: AUDIT_LOT.labelDose,
    daysToHarvest: 21,
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const next = await ensureDemonstrationChain(browserStore(), AUDIT_LOT.lotId);
        if (active) setStore(next);
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : t("audit.loadError"));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [t]);

  const runVerification = async (events = store?.events, head = store?.head) => {
    if (!events) return;
    setBusy(true);
    setFeedback(null);
    try {
      const result = await verifyChain(events, {
        scope: "lot",
        lotId: AUDIT_LOT.lotId,
        expectedHead: head,
      });
      setVerification(result);
    } catch {
      setVerification({
        valid: false,
        checkedEventCount: 0,
        firstInvalidSequence: null,
        failureCode: "unsupported",
        failureReason: t("audit.fail.unsupported"),
        verifiedAt: new Date().toISOString(),
        scope: "lot",
      });
    } finally {
      setBusy(false);
    }
  };

  const exportAudit = async () => {
    if (!store) return;
    setBusy(true);
    setFeedback(null);
    try {
      const current = readStore(browserStore());
      const nextEvents = await appendEvent(current.events, {
        lotId: AUDIT_LOT.lotId,
        eventType: "report_exported",
        payload: { demonstration: true, synthetic: true, format: "json" },
      });
      const next = { ...current, events: nextEvents, head: nextEvents.at(-1)?.eventHash ?? null };
      writeStore(browserStore(), next);
      const payload = buildExport(next, AUDIT_LOT.lotId, new Date().toISOString());
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${AUDIT_LOT.lotId}-audit.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStore(next);
      setVerification(null);
      setFeedback(t("audit.exported"));
    } catch {
      setFeedback(t("audit.exportFail"));
    } finally {
      setBusy(false);
    }
  };

  const tamperDemo = async () => {
    if (!store || store.events.length < 2) return;
    setBusy(true);
    try {
      const tampered = demonstratePayloadTamper(store.events, 2);
      const result = await verifyChain(tampered, { scope: "lot", lotId: AUDIT_LOT.lotId, expectedHead: store.head });
      setVerification(result);
      setFeedback(t("audit.tamperNote"));
    } finally {
      setBusy(false);
    }
  };

  const copyHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      setFeedback(t("audit.copied"));
    } catch {
      setFeedback(t("audit.copyFail"));
    }
  };

  const statusLabel = loading
    ? t("audit.loading")
    : !store || store.events.length === 0
      ? t("audit.empty")
      : verification?.valid
        ? t("audit.verified")
        : verification
          ? t("audit.failed")
          : t("audit.pending");
  const statusClass = verification?.valid
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : verification && !verification.valid
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : "border-amber-200 bg-amber-50 text-amber-800";
  const latestEvent = store?.events.at(-1);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            <ShieldCheck className="h-7 w-7" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">{t("audit.kicker")}</p>
            <h1 className="text-2xl font-extrabold tracking-tight text-emerald-700 sm:text-3xl">{t("audit.title")}</h1>
          </div>
        </div>
        <p className="text-sm font-semibold text-emerald-900">{t("audit.lotId")}: {AUDIT_LOT.lotId}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
        <p>{t("audit.localBanner")}</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">{t("audit.details")}</h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Detail label={t("audit.fpo")} value={AUDIT_LOT.fpo} />
          <Detail label={t("audit.crop")} value={AUDIT_LOT.crop} />
          <Detail label={t("audit.chemical")} value={AUDIT_LOT.chemical} />
          <Detail label={t("audit.msi")} value={`${proof.msi} ${t("unit.days")}`} />
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-1 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-semibold">{t("audit.chart")}</h2>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("audit.doseNote")}</p>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-4 text-xs font-semibold">
          <span className="inline-flex items-center gap-2 text-emerald-700"><span className="h-0.5 w-6 bg-emerald-600" />{t("audit.residue")}</span>
          <span className="inline-flex items-center gap-2 text-rose-600"><span className="h-0.5 w-6 bg-rose-600" />{t("audit.mrlLine")}</span>
        </div>
        <DecayChart />
        <p className="mt-3 text-sm text-slate-600">{t("audit.caption", { msi: proof.msi })}</p>
      </section>

      <section className={`rounded-xl border p-5 shadow-sm ${statusClass}`} aria-live="polite">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider">{t("audit.status")}</p>
            <h2 className="mt-1 text-xl font-bold">{statusLabel}</h2>
            {verification?.failureCode ? <p className="mt-2 text-sm font-medium">{t(`audit.fail.${verification.failureCode}` as MessageKey)}</p> : null}
            {verification?.firstInvalidSequence ? <p className="mt-1 text-sm">{t("audit.sequence")}: {verification.firstInvalidSequence}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={loading || busy || !store?.events.length} onClick={() => void runVerification()} className="min-h-11 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{busy ? t("audit.working") : t("audit.verify")}</button>
            <button type="button" disabled={loading || busy || !store?.events.length} onClick={() => void tamperDemo()} className="min-h-11 rounded-lg border border-rose-300 bg-white px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50">{t("audit.tamper")}</button>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><dt className={labelClass(lang)}>{t("audit.scope")}</dt><dd className="mt-1 font-semibold">{t("audit.scopeLot")}</dd></div>
          <div><dt className={labelClass(lang)}>{t("audit.checked")}</dt><dd className="mt-1 font-semibold tabular-nums">{verification?.checkedEventCount ?? 0}</dd></div>
          <div><dt className={labelClass(lang)}>{t("audit.latestTime")}</dt><dd className="mt-1 font-semibold">{latestEvent ? formatUtcTimestamp(latestEvent.timestamp, lang) : "—"}</dd></div>
          <div><dt className={labelClass(lang)}>{t("audit.verifiedAt")}</dt><dd className="mt-1 font-semibold">{verification ? formatUtcTimestamp(verification.verifiedAt, lang) : t("audit.notRun")}</dd></div>
        </dl>
      </section>

      {feedback ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{feedback}</p> : null}
      {loadError ? <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">{loadError}</p> : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{t("audit.history")}</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || !store?.events.length} onClick={() => void exportAudit()} className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{t("audit.export")}</button>
            <button type="button" disabled={!store?.events.length} onClick={() => setShowHistory((value) => !value)} className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{showHistory ? t("audit.hideHistory") : t("audit.history")}</button>
          </div>
        </div>
        {showHistory ? <AuditHistory events={store?.events ?? []} onCopy={copyHash} /> : null}
      </section>

      <aside className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("audit.limitsTitle")}</p>
        <p className="mt-2">{t("audit.limits")}</p>
      </aside>
    </div>
  );
}

function AuditHistory({ events, onCopy }: { events: AuditEvent[]; onCopy: (hash: string) => void }) {
  const { t, lang } = useTranslation();
  if (!events.length) return <p className="mt-4 text-sm text-slate-500">{t("audit.empty")}</p>;
  return (
    <div className="mt-4 space-y-3">
      {events.map((event) => (
        <article key={event.eventId} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{t(`audit.event.${event.eventType}` as MessageKey)}</p>
              <p className="mt-1 text-xs text-slate-500">{formatUtcTimestamp(event.timestamp, lang)} · {t("audit.actor")}: {t("audit.anonymous")}</p>
            </div>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">{t("audit.sequence")} {event.sequence}</span>
          </div>
          <dl className="mt-3 space-y-2 text-xs">
            <div><dt className="font-semibold text-slate-500">{t("audit.eventHash")}</dt><dd className="mt-1 break-all font-mono text-slate-700">{event.eventHash}</dd></div>
            <div><dt className="font-semibold text-slate-500">{t("audit.prevHash")}</dt><dd className="mt-1 break-all font-mono text-slate-700">{event.previousHash}</dd></div>
          </dl>
          <button type="button" onClick={() => onCopy(event.eventHash)} className="mt-3 min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">{t("audit.copy")}</button>
        </article>
      ))}
    </div>
  );
}

function DecayChart() {
  const { t } = useTranslation();
  const [ready, setReady] = useState(false);
  const data = useMemo(() => auditDecayCurve(), []);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) {
    return <div className="h-80 rounded-lg bg-slate-100" aria-hidden="true" />;
  }

  const day21 = data.find((point) => point.day === 21);

  return (
    <div className="h-80 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid stroke="var(--color-slate-200)" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fill: "var(--color-slate-500)", fontSize: 12 }}
            stroke="var(--color-slate-300)"
            tickLine={false}
          />
          <YAxis
            domain={[0, 10]}
            tick={{ fill: "var(--color-slate-500)", fontSize: 12 }}
            stroke="var(--color-slate-300)"
            tickLine={false}
            width={36}
          />
          <Tooltip
            formatter={(value) => [`${Number(value).toFixed(2)} mg/kg`, t("audit.tooltipResidue")]}
            labelFormatter={(label) => t("audit.day", { day: label })}
          />
          <ReferenceLine
            y={2}
            stroke="var(--color-rose-600)"
            strokeWidth={2}
            ifOverflow="extendDomain"
          />
          {day21 ? (
            <ReferenceDot
              x={21}
              y={day21.residue}
              r={5}
              fill="var(--color-emerald-600)"
              stroke="white"
              strokeWidth={2}
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="residue"
            name={t("audit.residue")}
            stroke="var(--color-emerald-600)"
            strokeWidth={2.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function PolicySimulator() {
  const { t } = useTranslation();
  const [eu, setEu] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
          {t("policy.kicker")}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{t("policy.title")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">{t("policy.subtitle")}</p>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:justify-center">
        <span className={`text-sm font-semibold ${eu ? "text-slate-400" : "text-emerald-700"}`}>
          {t("policy.domestic")}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={eu}
          aria-label={t("policy.switch")}
          onClick={() => setEu((value) => !value)}
          className={`relative h-9 w-16 rounded-full transition-colors ${eu ? "bg-rose-600" : "bg-emerald-600"}`}
        >
          <span
            className={`absolute top-1 left-1 h-7 w-7 rounded-full bg-white shadow-sm transition-transform ${eu ? "translate-x-7" : "translate-x-0"}`}
          />
        </button>
        <span className={`text-sm font-semibold ${eu ? "text-rose-700" : "text-slate-400"}`}>
          {t("policy.eu")}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PolicyCard
          name="Azoxystrobin"
          safe
          detail={
            eu
              ? t("policy.azoxEu")
              : t("policy.azoxDomestic")
          }
        />
        <PolicyCard
          name="Mancozeb"
          safe={!eu}
          detail={
            eu
              ? t("policy.mancBan")
              : t("policy.mancDomestic")
          }
        />
      </div>
    </div>
  );
}

function PolicyCard({ name, safe, detail }: { name: string; safe: boolean; detail: string }) {
  const { t } = useTranslation();
  if (!safe) {
    return (
      <article className="flex min-h-64 flex-col justify-between rounded-xl border-2 border-rose-600 bg-rose-50 p-5 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-rose-700">{name}</p>
          <div className="mt-4 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-600 text-white">
              <ShieldAlert className="h-6 w-6" aria-hidden="true" />
            </span>
            <h2 className="text-4xl font-extrabold tracking-tight text-rose-600">{t("policy.bannedTitle")}</h2>
          </div>
        </div>
        <p className="mt-6 text-base font-medium text-rose-900">{detail}</p>
      </article>
    );
  }

  return (
    <article className="flex min-h-64 flex-col justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">{name}</p>
        <div className="mt-4 flex items-center gap-3">
          <CheckCircle className="h-10 w-10 text-emerald-600" aria-hidden="true" />
          <h2 className="text-3xl font-extrabold tracking-tight text-emerald-700">{t("policy.safe")}</h2>
        </div>
      </div>
      <p className="mt-6 text-sm text-emerald-950">{detail}</p>
    </article>
  );
}

function DataMoat() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const rows = DATA_MOAT.filter((row) => {
    if (!needle) return true;
    const haystack = [
      row.crop,
      row.ingredient,
      String(row.phi),
      String(row.dt50),
      formatMrl(row.euMrl),
      row.euApproved ? "yes approved" : "no",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
          {t("moat.kicker")}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          {t("moat.title")}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          {t("moat.subtitle")}
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <label className="relative block">
          <span className="sr-only">{t("moat.search")}</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("moat.placeholder")}
            className="h-11 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-10 text-sm text-slate-900 shadow-sm"
          />
        </label>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-3 py-3 font-semibold">{t("moat.crop")}</th>
                <th className="px-3 py-3 font-semibold">{t("moat.ingredient")}</th>
                <th className="px-3 py-3 font-semibold">{t("moat.phi")}</th>
                <th className="px-3 py-3 font-semibold">{t("moat.dt50")}</th>
                <th className="px-3 py-3 font-semibold">{t("moat.euMrl")}</th>
                <th className="px-3 py-3 font-semibold">{t("moat.approved")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.crop}-${row.ingredient}`} className="border-b border-slate-100">
                  <td className="px-3 py-3 font-medium">{t(`crop.${row.crop}` as MessageKey)}</td>
                  <td className="px-3 py-3">{row.ingredient}</td>
                  <td className="px-3 py-3 tabular-nums">{row.phi}</td>
                  <td className="px-3 py-3 tabular-nums">{row.dt50}</td>
                  <td className="px-3 py-3 tabular-nums">{formatMrl(row.euMrl)}</td>
                  <td className="px-3 py-3">
                    {row.euApproved ? (
                      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                        {t("moat.yes")}
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800">
                        {t("moat.no")}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-slate-500">
              {t("moat.empty", { query: query.trim() })}
            </p>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {t("moat.count", { shown: rows.length, total: DATA_MOAT.length })}
        </p>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone: "slate" | "emerald" | "amber" | "rose";
}) {
  const toneClass = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
  }[tone];

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneClass}`}>{icon}</span>
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight">{value}</p>
    </article>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500"
    >
      {children}
    </label>
  );
}

function NumberField({
  id,
  label,
  value,
  step,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  step: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min="0"
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${CONTROL} tabular-nums`}
      />
    </div>
  );
}

function SpecItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function QrMark({ value }: { value: string }) {
  const size = 21;
  const cells: boolean[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      cells.push(qrModule(value, row, col, size));
    }
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="h-28 w-28 shrink-0 rounded-md border border-slate-200 bg-white p-1 text-slate-900"
      role="img"
      aria-label={`QR mark for ${value}`}
    >
      {cells.map((on, index) =>
        on ? (
          <rect
            key={index}
            x={index % size}
            y={Math.floor(index / size)}
            width="1"
            height="1"
            fill="currentColor"
          />
        ) : null,
      )}
    </svg>
  );
}

function qrModule(value: string, row: number, col: number, size: number): boolean {
  const finder = finderOn(row, col, size);
  if (finder !== null) return finder;
  const quiet =
    (row < 8 && col < 8) || (row < 8 && col > size - 9) || (row > size - 9 && col < 8);
  if (quiet) return false;
  let hash = 2166136261;
  const salt = `${value}:${row}:${col}`;
  for (let i = 0; i < salt.length; i += 1) {
    hash ^= salt.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 3 !== 0;
}

function finderOn(row: number, col: number, size: number): boolean | null {
  const origins = [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ];
  for (const [originRow, originCol] of origins) {
    if (row < originRow || col < originCol || row >= originRow + 7 || col >= originCol + 7) {
      continue;
    }
    const localRow = row - originRow;
    const localCol = col - originCol;
    const edge = localRow === 0 || localRow === 6 || localCol === 0 || localCol === 6;
    const core = localRow >= 2 && localRow <= 4 && localCol >= 2 && localCol <= 4;
    return edge || core;
  }
  return null;
}

const VERDICT_THEME: Record<Verdict, { card: string; title: string; icon: string }> = {
  SAFE: {
    card: "border-emerald-200 bg-emerald-50",
    title: "text-emerald-700",
    icon: "bg-emerald-600 text-white",
  },
  DELAY_HARVEST: {
    card: "border-amber-200 bg-amber-50",
    title: "text-amber-700",
    icon: "bg-amber-500 text-white",
  },
  DO_NOT_USE: {
    card: "border-rose-200 bg-rose-50",
    title: "text-rose-700",
    icon: "bg-rose-600 text-white",
  },
};

function readForm(form: FormState): { ok: true; input: ComplianceInput } | { ok: false; error: string } {
  if (
    form.doseApplied.trim() === "" ||
    form.labelDose.trim() === "" ||
    form.daysToHarvest.trim() === ""
  ) {
    return { ok: false, error: "form.err.required" };
  }
  const doseApplied = Number(form.doseApplied);
  const labelDose = Number(form.labelDose);
  const daysToHarvest = Number(form.daysToHarvest);
  if (!Number.isFinite(doseApplied) || doseApplied <= 0) {
    return { ok: false, error: "form.err.dose" };
  }
  if (!Number.isFinite(labelDose) || labelDose <= 0) {
    return { ok: false, error: "form.err.label" };
  }
  if (!Number.isFinite(daysToHarvest) || daysToHarvest < 0) {
    return { ok: false, error: "form.err.days" };
  }
  return {
    ok: true,
    input: {
      crop: form.crop,
      chemical: form.chemical,
      market: form.market,
      doseApplied,
      labelDose,
      daysToHarvest,
    },
  };
}
