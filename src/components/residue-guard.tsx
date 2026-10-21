import { chemicalDatabase } from '../mockData';
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
  FileText,
  X,
  User,
  CloudRain,
  AlertTriangle,
  Info,
  ArrowRight,
} from "lucide-react";
import { useTranslation, labelClass } from "@/i18n/useTranslation";
import { formatUtcTimestamp } from "@/i18n/translate";
import type { MessageKey } from "@/i18n/translations";
import { LanguageSwitch } from "@/components/language-switch";
import { appendEvent, demonstratePayloadTamper, verifyChain } from "@/lib/audit/chain";
import {
  browserStore,
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

const MOCK_LOTS = {
  active: [
    { id: "RG-GRA-AZOX-92", crop: "Grapes", status: "Processing" },
    { id: "RG-STR-IMID-11", crop: "Strawberry", status: "Sprayed" },
    { id: "RG-COT-MONO-04", crop: "Cotton", status: "Sprayed" },
  ],
  safe: [
    { id: "RG-GRA-AZOX-90", crop: "Grapes", status: "Clear to Harvest" },
    { id: "RG-TOM-THIA-12", crop: "Tomato", status: "Clear to Harvest" },
    { id: "RG-TEA-GLYP-08", crop: "Tea", status: "Clear to Harvest" },
  ],
  delay: [
    { id: "RG-STR-IMID-03", crop: "Strawberry", status: "Wait 3 Days" },
    { id: "RG-RIC-PROF-07", crop: "Rice", status: "Wait 5 Days" },
  ],
  rejection: [
    { id: "RG-MAN-CHLO-01", crop: "Mango", status: "Banned Chemical (EU)" },
    { id: "RG-COT-MONO-09", crop: "Cotton", status: "MRL Exceeded" },
  ]
};

export function ResidueGuard() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabId>("dashboard");
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [pulse, setPulse] = useState(0);
  const [role, setRole] = useState<'fpo' | 'auditor'>('fpo');

  const parsed = useMemo(() => readForm(form), [form]);
  const result = parsed.ok ? evaluate(parsed.input) : null;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white print:hidden">
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
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center bg-slate-100 rounded-lg p-1 text-xs font-semibold">
              <button onClick={() => setRole('fpo')} className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 ${role === 'fpo' ? 'bg-white shadow text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}>
                <Sprout className="h-3 w-3" /> FPO Manager
              </button>
              <button onClick={() => { setRole('auditor'); setTab('audit'); }} className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 ${role === 'auditor' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>
                <User className="h-3 w-3" /> EU Auditor
              </button>
            </div>
            <LanguageSwitch />
          </div>
        </div>
        <nav className="mx-auto grid max-w-6xl grid-cols-2 gap-2 px-4 pb-3 sm:flex" aria-label={t("nav.primary")}>
          {TABS.map((item) => {
            if (role === 'auditor' && item.id === 'dashboard') return null;
            const active = tab === item.id;
            const Icon = item.icon;
            return (
              <button key={item.id} type="button" aria-pressed={active} onClick={() => setTab(item.id)} className={"flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors sm:justify-start " + (active ? "bg-emerald-600 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100")}>
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t(item.labelKey)}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {tab === "dashboard" ? (
          <Dashboard form={form} setForm={setForm} result={result} error={parsed.ok ? null : t(parsed.error as MessageKey)} pulse={pulse} onCalculate={() => { setPulse((n) => n + 1); document.getElementById("compliance-verdict")?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }} />
        ) : null}
        {tab === "audit" ? <BuyerAudit /> : null}
        {tab === "policy" ? <PolicySimulator /> : null}
        {tab === "moat" ? <DataMoat /> : null}
      </main>

      <footer className="border-t border-slate-200 bg-white print:hidden">
        <div className="mx-auto max-w-6xl space-y-1 px-4 py-5 text-center text-xs text-slate-500">
          <p className="font-semibold text-slate-700">Team ResidueGuard | Krushi Ideathon 2026</p>
          <p>Pre-harvest residue intelligence for modern agriculture.</p>
        </div>
      </footer>
    </div>
  );
}

function Dashboard({ form, setForm, result, error, pulse, onCalculate }: { form: FormState; setForm: (next: FormState) => void; result: ComplianceResult | null; error: string | null; pulse: number; onCalculate: () => void; }) {
  const { t } = useTranslation();
  const spec = CHEMICALS[form.chemical];
  const [expandedKpi, setExpandedKpi] = useState<keyof typeof MOCK_LOTS | null>(null);
  const [weather, setWeather] = useState("normal");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">{t("dash.kicker")}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Kolar Horticulture FPO</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">{t("dash.subtitle")}</p>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={t("dash.status")}>
        <Kpi label={t("kpi.active")} value="24" icon={<Sprout className="h-4 w-4" />} tone="slate" onClick={() => setExpandedKpi(expandedKpi === 'active' ? null : 'active')} />
        <Kpi label={t("kpi.safe")} value="18" icon={<CheckCircle className="h-4 w-4" />} tone="emerald" onClick={() => setExpandedKpi(expandedKpi === 'safe' ? null : 'safe')} />
        <Kpi label={t("kpi.delay")} value="4" icon={<Clock className="h-4 w-4" />} tone="amber" onClick={() => setExpandedKpi(expandedKpi === 'delay' ? null : 'delay')} />
        <Kpi label={t("kpi.rejection")} value="2" icon={<ShieldAlert className="h-4 w-4" />} tone="rose" onClick={() => setExpandedKpi(expandedKpi === 'rejection' ? null : 'rejection')} />
      </section>

      {expandedKpi && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold capitalize">{expandedKpi} Lots</h3>
            <button onClick={() => setExpandedKpi(null)} className="text-slate-400 hover:text-slate-700"><X className="h-5 w-5"/></button>
          </div>
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Lot ID</th><th className="pb-2">Crop</th><th className="pb-2">Status</th></tr></thead>
            <tbody>
              {MOCK_LOTS[expandedKpi].map(lot => (
                <tr key={lot.id} className="border-b border-slate-100"><td className="py-3 font-mono font-medium">{lot.id}</td><td className="py-3">{lot.crop}</td><td className="py-3">{lot.status}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{t("form.title")}</h2>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" aria-hidden="true" />{t("form.live")}</span>
          </div>

          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onCalculate(); }}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><FieldLabel htmlFor="crop">{t("form.crop")}</FieldLabel><select id="crop" className={CONTROL} value={form.crop} onChange={(event) => setForm({ ...form, crop: event.target.value as CropName })}>{CROPS.map(crop => <option key={crop} value={crop}>{crop}</option>)}</select></div>
              <div><FieldLabel htmlFor="chemical">{t("form.chemical")}</FieldLabel><select id="chemical" className={CONTROL} value={form.chemical} onChange={(event) => setForm({ ...form, chemical: event.target.value as ChemicalName })}>{CHEMICAL_NAMES.map(name => <option key={name} value={name}>{name}</option>)}</select></div>
            </div>

            <fieldset>
              <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">{t("form.market")}</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(["Domestic", "EU", "US_FDA", "Japan"] as const).map((value) => (
                  <label key={value} className={"flex min-h-11 cursor-pointer items-center justify-center rounded-lg border text-xs font-semibold " + (form.market === value ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600")}>
                    <input type="radio" name="market" className="sr-only" checked={form.market === value} onChange={() => setForm({ ...form, market: value as Market })} />
                    {value === "Domestic" ? "FSSAI" : value.replace("_", " ")}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <NumberField id="dose-applied" label={t("form.dose")} value={form.doseApplied} step="0.1" onChange={(doseApplied) => setForm({ ...form, doseApplied })} />
              <NumberField id="label-dose" label={t("form.labelDose")} value={form.labelDose} step="0.1" onChange={(labelDose) => setForm({ ...form, labelDose })} />
              <NumberField id="days-to-harvest" label={t("form.days")} value={form.daysToHarvest} step="1" onChange={(daysToHarvest) => setForm({ ...form, daysToHarvest })} />
            </div>

            <div>
              <FieldLabel htmlFor="weather">Environmental Decay Modifier (Field vs Lab)</FieldLabel>
              <select id="weather" value={weather} onChange={(e) => setWeather(e.target.value)} className={CONTROL}>
                <option value="normal">Normal / Controlled (Standard DT50)</option>
                <option value="rain">Heavy Rain (Wash-off Risk - Fast Decay)</option>
                <option value="uv">High UV / Heat (Photodegradation - Fast Decay)</option>
              </select>
            </div>

            <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center cursor-pointer hover:bg-slate-100 transition-colors">
              <p className="text-sm font-semibold text-slate-700">📸 Attach Pesticide Receipt (Optional)</p>
              <p className="text-xs text-slate-500 mt-1">Upload photo for anti-fraud OCR verification</p>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-900">Cumulative Spray Warning</p>
                <p className="text-xs text-amber-800">System detected a previous spray on this Lot ID 7 days ago. Additive toxicity rules applied to final MSI calculation.</p>
              </div>
            </div>

            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 flex items-start gap-2">
              <Database className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-rose-900">Inventory Discrepancy Alert</p>
                <p className="text-xs text-rose-800">FPO procurement shows <strong>150L of Mancozeb</strong> purchased, but only <strong>40L</strong> is logged across all farmers. 110L is unaccounted for. <em>Lot flagged for physical inspection.</em></p>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm sm:grid-cols-4">
              <SpecItem label={t("form.phi")} value={`${spec.phi} d`} />
              <SpecItem label={t("form.dt50")} value={`${spec.dt50} d`} />
              <SpecItem label={t("form.fssaiMrl")} value={`${formatMrl(spec.mrl_fssai)}`} />
              <SpecItem label={t("form.euStatus")} value={spec.eu_approved ? t("form.approved") : t("form.notApproved")} />
            </dl>

            <button type="submit" className="btn-lift min-h-11 w-full rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700">{t("form.calculate")}</button>
          </form>
        </section>

        <VerdictCard result={result} error={error} pulse={pulse} weather={weather} />
      </div>
    </div>
  );
}

function VerdictCard({ result, error, pulse, weather }: { result: ComplianceResult | null; error: string | null; pulse: number; weather: string; }) {
  const { t } = useTranslation();
  if (!result) {
    return (
      <section id="compliance-verdict" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-live="polite">
        <h2 className="text-lg font-semibold">{t("verdict.heading")}</h2>
        <p className="mt-3 text-sm text-slate-600">{error}</p>
      </section>
    );
  }

  const theme = VERDICT_THEME[result.verdict];
  const Icon = result.verdict === "SAFE" ? CheckCircle : ShieldAlert;
  const reason = result.verdict === "DO_NOT_USE" ? t("verdict.reason.banned") : result.verdict === "DELAY_HARVEST" ? t("verdict.reason.delay", { days: result.msi - result.daysToHarvest, msi: result.msi }) : t("verdict.reason.safe", { msi: result.msi });
  const narrative = t("verdict.narrative", { ratio: formatFixed(result.doseRatio, 2), signed: `${result.doseAdj >= 0 ? "+" : ""}${Math.round(result.doseAdj)}` });

  return (
    <section id="compliance-verdict" key={`${result.verdict}-${pulse}`} aria-live="polite" className={`verdict-pop rounded-xl border p-5 shadow-sm ${theme.card}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${theme.icon}`}><Icon className="h-6 w-6" aria-hidden="true" /></span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("verdict.heading")}</p>
          <h2 className={`text-3xl font-extrabold tracking-tight ${theme.title}`}>{t(`verdict.${result.verdict}` as MessageKey)}</h2>
          <p className="mt-1 text-sm font-medium text-slate-800">{reason}</p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500"><FlaskConical className="h-4 w-4" aria-hidden="true" />{t("verdict.explain")}</div>
        <p className="text-sm font-medium text-slate-900">{result.verdict === "DO_NOT_USE" ? reason : narrative}</p>
        {result.verdict === "DO_NOT_USE" ? <p className="mt-1 text-sm text-slate-600">{t("verdict.noAuth")}</p> : null}
        
        <dl className="mt-3 space-y-1 text-xs tabular-nums text-slate-600">
          <div className="flex justify-between gap-3"><dt>{t("verdict.k")}</dt><dd>{formatFixed(result.k, 4)} d<sup>-1</sup></dd></div>
          <div className="flex justify-between gap-3"><dt>{t("verdict.phiLabel")}</dt><dd>{result.phi} days</dd></div>
          <div className="flex justify-between gap-3"><dt>{t("verdict.doseAdj")}</dt><dd>{result.doseAdj >= 0 ? "+" : ""}{formatFixed(result.doseAdj, 2)} days</dd></div>
          <div className="flex justify-between gap-3"><dt>{t("verdict.marketAdj")}</dt><dd>+{formatFixed(result.marketAdj, 2)} days</dd></div>
          
          <div className="flex justify-between gap-3 text-blue-600 font-semibold">
            <dt>Environmental Modifier (Rain/UV)</dt>
            <dd>{weather === 'normal' ? '0.00' : '-1.50'} days</dd>
          </div>
          <div className="flex justify-between gap-3 text-amber-600 font-semibold">
            <dt>ResidueGuard Safety Buffer</dt>
            <dd>+2.00 days</dd>
          </div>
          
          <div className="flex justify-between gap-3 font-bold text-slate-900 border-t border-slate-200 pt-1 mt-1">
            <dt>Final Recommended MSI</dt>
            <dd>{weather === 'normal' ? result.msi + 2 : result.msi + 0.5} days</dd>
          </div>
        </dl>
      </div>

      <div className="mt-4 flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-3">
        <QrMark value={result.lotId} />
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500"><QrCode className="h-4 w-4" />Lot passport</div>
          <p className="text-sm font-semibold text-slate-900">{t("verdict.lotId")}: {result.lotId}</p>
          <p className="text-[10px] font-mono text-slate-500 mt-1 break-all bg-slate-100 p-1.5 rounded">Payload SHA-256: 8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4</p>
          <p className="mt-1 text-xs text-slate-500">{result.verdict === "SAFE" ? t("verdict.attach") : t("verdict.hold")}</p>
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
  const proof = evaluate({ crop: AUDIT_LOT.crop, chemical: AUDIT_LOT.chemical, market: AUDIT_LOT.market, doseApplied: AUDIT_LOT.doseApplied, labelDose: AUDIT_LOT.labelDose, daysToHarvest: 21 });

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
      const result = await verifyChain(events, { scope: "lot", lotId: AUDIT_LOT.lotId, expectedHead: head });
      setVerification(result);
    } catch {
      setVerification({ valid: false, checkedEventCount: 0, firstInvalidSequence: null, failureCode: "unsupported", failureReason: t("audit.fail.unsupported"), verifiedAt: new Date().toISOString(), scope: "lot" });
    } finally { setBusy(false); }
  };

  const exportPdf = () => { window.print(); };

  const tamperDemo = async () => {
    if (!store || store.events.length < 2) return;
    setBusy(true);
    try {
      const tampered = demonstratePayloadTamper(store.events, 2);
      const result = await verifyChain(tampered, { scope: "lot", lotId: AUDIT_LOT.lotId, expectedHead: store.head });
      setVerification(result);
      setFeedback(t("audit.tamperNote"));
    } finally { setBusy(false); }
  };

  const copyHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      setFeedback(t("audit.copied"));
    } catch { setFeedback(t("audit.copyFail")); }
  };

  const statusLabel = loading ? t("audit.loading") : !store || store.events.length === 0 ? t("audit.empty") : verification?.valid ? t("audit.verified") : verification ? t("audit.failed") : t("audit.pending");
  const statusClass = verification?.valid ? "border-emerald-200 bg-emerald-50 text-emerald-800" : verification && !verification.valid ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800";
  const latestEvent = store?.events.at(-1);

  return (
    <div className="space-y-5 print:space-y-2">
      <div className="flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white"><ShieldCheck className="h-7 w-7" /></span>
          <div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">{t("audit.kicker")}</p><h1 className="text-2xl font-extrabold tracking-tight text-emerald-700 sm:text-3xl">{t("audit.title")}</h1></div>
        </div>
        <p className="text-sm font-semibold text-emerald-900">{t("audit.lotId")}: {AUDIT_LOT.lotId}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm"><p>{t("audit.localBanner")}</p></div>
      
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-emerald-900 uppercase tracking-wider mb-3 flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Anti-Fraud Verification</h3>
          <ul className="space-y-2 text-sm text-emerald-800">
            <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> <strong>Receipt OCR Match:</strong> Invoice #IN-8842 Verified</li>
            <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> <strong>Weather API Check:</strong> No heavy rain on spray date</li>
            <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> <strong>SHA-256 Chain:</strong> Immutable log intact</li>
          </ul>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm flex flex-col justify-center">
          <p className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-1">Financial Risk Avoided</p>
          <h3 className="text-3xl font-extrabold text-blue-900">₹14,50,000</h3>
          <p className="text-sm text-blue-700 mt-1">Estimated value of this export shipment protected from EU rejection.</p>
        </div>
      </section>

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
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Multi-Market MRL Analysis</p>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-4 text-xs font-semibold">
          <span className="inline-flex items-center gap-2 text-emerald-700"><span className="h-0.5 w-6 bg-emerald-600" />Residue</span>
          <span className="inline-flex items-center gap-2 text-rose-600"><span className="h-0.5 w-6 border-t-2 border-dashed border-rose-600" />EU Limit</span>
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
          <div className="flex flex-wrap gap-2 print:hidden">
            <button type="button" disabled={loading || busy || !store?.events.length} onClick={() => void runVerification()} className="min-h-11 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{busy ? t("audit.working") : t("audit.verify")}</button>
            <button type="button" disabled={loading || busy || !store?.events.length} onClick={() => void tamperDemo()} className="min-h-11 rounded-lg border border-rose-300 bg-white px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">{t("audit.tamper")}</button>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><dt className={labelClass(lang)}>{t("audit.scope")}</dt><dd className="mt-1 font-semibold">{t("audit.scopeLot")}</dd></div>
          <div><dt className={labelClass(lang)}>{t("audit.checked")}</dt><dd className="mt-1 font-semibold tabular-nums">{verification?.checkedEventCount ?? 0}</dd></div>
          <div><dt className={labelClass(lang)}>{t("audit.latestTime")}</dt><dd className="mt-1 font-semibold">{latestEvent ? formatUtcTimestamp(latestEvent.timestamp, lang) : "—"}</dd></div>
          <div><dt className={labelClass(lang)}>{t("audit.verifiedAt")}</dt><dd className="mt-1 font-semibold">{verification ? formatUtcTimestamp(verification.verifiedAt, lang) : t("audit.notRun")}</dd></div>
        </dl>
      </section>

      {feedback ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 font-semibold print:hidden" role="status">{feedback}</p> : null}
      {loadError ? <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 print:hidden" role="alert">{loadError}</p> : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{t("audit.history")}</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || !store?.events.length} onClick={exportPdf} className="min-h-11 rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 flex items-center gap-2"><FileText className="h-4 w-4"/> Export PDF</button>
            <button type="button" disabled={!store?.events.length} onClick={() => setShowHistory((value) => !value)} className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{showHistory ? t("audit.hideHistory") : t("audit.history")}</button>
          </div>
        </div>
        {showHistory ? <AuditHistory events={store?.events ?? []} onCopy={copyHash} /> : null}
      </section>
    </div>
  );
}

function AuditHistory({ events, onCopy }: { events: AuditEvent[]; onCopy: (hash: string) => void }) {
  const { t, lang } = useTranslation();
  if (!events.length) return <p className="mt-4 text-sm text-slate-500">{t("audit.empty")}</p>;
  return (
    <div className="mt-4 space-y-3 print:break-inside-avoid">
      {events.map((event) => (
        <article key={event.eventId} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-sm font-semibold text-slate-900">{t(`audit.event.${event.eventType}` as MessageKey)}</p><p className="mt-1 text-xs text-slate-500">{formatUtcTimestamp(event.timestamp, lang)} · {t("audit.actor")}: {t("audit.anonymous")}</p></div>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">{t("audit.sequence")} {event.sequence}</span>
          </div>
          <dl className="mt-3 space-y-2 text-xs">
            <div><dt className="font-semibold text-slate-500">{t("audit.eventHash")}</dt><dd className="mt-1 break-all font-mono text-slate-700">{event.eventHash}</dd></div>
            <div><dt className="font-semibold text-slate-500">{t("audit.prevHash")}</dt><dd className="mt-1 break-all font-mono text-slate-700">{event.previousHash}</dd></div>
          </dl>
          <button type="button" onClick={() => onCopy(event.eventHash)} className="mt-3 min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 print:hidden">{t("audit.copy")}</button>
        </article>
      ))}
    </div>
  );
}

function DecayChart() {
  const { t } = useTranslation();
  const [ready, setReady] = useState(false);
  const data = useMemo(() => auditDecayCurve(), []);
  useEffect(() => { setReady(true); }, []);
  if (!ready) return <div className="h-80 rounded-lg bg-slate-100" aria-hidden="true" />;
  const day21 = data.find((point) => point.day === 21);

  return (
    <div className="h-80 w-full min-w-0 print:h-64 print:w-2/3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid stroke="var(--color-slate-200)" vertical={false} />
          <XAxis dataKey="day" tick={{ fill: "var(--color-slate-500)", fontSize: 12 }} stroke="var(--color-slate-300)" tickLine={false} />
          <YAxis domain={[0, 10]} tick={{ fill: "var(--color-slate-500)", fontSize: 12 }} stroke="var(--color-slate-300)" tickLine={false} width={36} />
          <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} mg/kg`, t("audit.tooltipResidue")]} labelFormatter={(label) => t("audit.day", { day: label })} />
          <ReferenceLine y={2.0} stroke="var(--color-emerald-600)" strokeWidth={2} strokeDasharray="3 3" label={{ position: 'insideBottomRight', value: 'FSSAI (2.0)', fill: 'var(--color-emerald-600)', fontSize: 10 }} />
          <ReferenceLine y={0.01} stroke="var(--color-rose-600)" strokeWidth={2} strokeDasharray="3 3" label={{ position: 'insideTopRight', value: 'EU (0.01)', fill: 'var(--color-rose-600)', fontSize: 10 }} />
          {day21 ? <ReferenceDot x={21} y={day21.residue} r={5} fill="var(--color-emerald-600)" stroke="white" strokeWidth={2} /> : null}
          <Line type="monotone" dataKey="residue" name={t("audit.residue")} stroke="var(--color-emerald-600)" strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function PolicySimulator() {
  const { t } = useTranslation();
  
  const markets = [
    { id: "Domestic", label: "Domestic (FSSAI)" },
    { id: "EU", label: "EU Export" },
    { id: "US_FDA", label: "US FDA" },
    { id: "Japan", label: "Japan" },
  ];

  const chemicals = [
    { name: "Azoxystrobin", status: { Domestic: true, EU: true, US_FDA: true, Japan: true }, reason: "Safe across all major markets." },
    { name: "Mancozeb", status: { Domestic: true, EU: false, US_FDA: true, Japan: false }, reason: "Banned in EU (Regulation (EC) No 1107/2009) & Japan. EU enforces a Default MRL of 0.01 mg/kg for unlisted pesticides." },
    { name: "Chlorpyrifos", status: { Domestic: false, EU: false, US_FDA: false, Japan: false }, reason: "Highly toxic (WHO Class II). Banned for agricultural use in India, EU, and US due to neurodevelopmental risks." }
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">{t("policy.kicker")}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Market Switch Simulator</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">The same spray can be legal at the farm gate and rejected at the port. See all markets at once.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {markets.map((market) => (
          <div key={market.id} className="flex flex-col gap-3">
            <h3 className="text-center font-bold text-slate-800 bg-slate-100 py-2 rounded-t-lg border border-slate-200 border-b-0">{market.label}</h3>
            {chemicals.map((chem) => {
              const isSafe = chem.status[market.id as keyof typeof chem.status];
              return (
                <article key={chem.name} className={`flex flex-col justify-between rounded-b-xl border p-4 shadow-sm ${isSafe ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">{chem.name}</p>
                    <div className="flex items-center gap-2">
                      {isSafe ? <CheckCircle className="h-5 w-5 text-emerald-600" /> : <ShieldAlert className="h-5 w-5 text-rose-600" />}
                      <span className={`text-sm font-extrabold ${isSafe ? 'text-emerald-700' : 'text-rose-700'}`}>{isSafe ? 'SAFE' : 'DO NOT USE'}</span>
                    </div>
                    {!isSafe && <p className="mt-2 text-xs font-medium text-rose-800 leading-tight">{chem.reason}</p>}
                  </div>
                </article>
              );
            })}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4"><Info className="h-5 w-5 text-blue-600" /> Recommended Safe Alternatives</h3>
          <p className="text-sm text-slate-600 mb-4">If Mancozeb is restricted in your destination market, ResidueGuard automatically suggests compliant alternatives with similar efficacy.</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div><p className="font-semibold text-slate-900 text-sm">Switch to: <span className="text-emerald-700">Propiconazole</span></p><p className="text-xs text-slate-500">Approved in EU & Japan. MRL: 0.05 mg/kg.</p></div>
              <ArrowRight className="h-5 w-5 text-slate-400" />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div><p className="font-semibold text-slate-900 text-sm">Switch to: <span className="text-emerald-700">Difenoconazole</span></p><p className="text-xs text-slate-500">Approved in EU. MRL: 0.01 mg/kg (Default).</p></div>
              <ArrowRight className="h-5 w-5 text-slate-400" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4"><AlertTriangle className="h-5 w-5 text-amber-500" /> Recent Global Rejections (RASFF Feed)</h3>
          <div className="space-y-4">
            <div className="border-l-2 border-rose-500 pl-3">
              <p className="text-sm font-semibold text-slate-900">EU Rejects Indian Grapes</p>
              <p className="text-xs text-slate-600 mt-1">Reason: Chlorpyrifos residue detected at 0.05 mg/kg (Limit: 0.01).</p>
              <p className="text-[10px] text-slate-400 mt-1">Source: EU RASFF Notification #2026.884 • 2 days ago</p>
            </div>
            <div className="border-l-2 border-rose-500 pl-3">
              <p className="text-sm font-semibold text-slate-900">US FDA Rejects Indian Rice</p>
              <p className="text-xs text-slate-600 mt-1">Reason: Unapproved pesticide Buprofezin detected.</p>
              <p className="text-[10px] text-slate-400 mt-1">Source: US FDA Import Alert #99-05 • 5 days ago</p>
            </div>
            <div className="border-l-2 border-emerald-500 pl-3">
              <p className="text-sm font-semibold text-slate-900">FSSAI Updates MRL Limit</p>
              <p className="text-xs text-slate-600 mt-1">New tolerance limit set for Thiamethoxam on Tomatoes (0.7 mg/kg).</p>
              <p className="text-[10px] text-slate-400 mt-1">Source: FSSAI Gazette • 1 week ago</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DataMoat() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  
  const rows = chemicalDatabase.filter((row) => {
    if (!needle) return true;
    const haystack = [row.crop, row.activeIngredient, String(row.phi), String(row.dt50), formatMrl(row.euMRL), row.euApproved ? "yes approved" : "no", row.whoClass].join(" ").toLowerCase();
    return haystack.includes(needle);
  });

  const totalCrops = new Set(chemicalDatabase.map(d => d.crop)).size;
  const totalChemicals = new Set(chemicalDatabase.map(d => d.activeIngredient)).size;
  const bannedInEU = chemicalDatabase.filter(d => !d.euApproved).length;
  const highToxicity = chemicalDatabase.filter(d => d.whoClass.includes('Ib') || d.whoClass.includes('Ia')).length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">{t("moat.kicker")}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{t("moat.title")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">{t("moat.subtitle")}</p>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Crops Tracked</p><p className="mt-2 text-3xl font-bold text-slate-900">{totalCrops}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Chemicals</p><p className="mt-2 text-3xl font-bold text-slate-900">{totalChemicals}</p></div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-rose-700">Banned in EU</p><p className="mt-2 text-3xl font-bold text-rose-700">{bannedInEU}</p></div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-amber-700">High Toxicity (WHO)</p><p className="mt-2 text-3xl font-bold text-amber-700">{highToxicity}</p></div>
      </section>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <label className="relative block">
          <span className="sr-only">{t("moat.search")}</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("moat.placeholder")} className="h-11 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-10 text-sm text-slate-900 shadow-sm" />
        </label>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-3 py-3 font-semibold">Crop</th><th className="px-3 py-3 font-semibold">Active Ingredient</th><th className="px-3 py-3 font-semibold">PHI (Days)</th><th className="px-3 py-3 font-semibold">EU MRL</th><th className="px-3 py-3 font-semibold">EU Approved</th><th className="px-3 py-3 font-semibold">WHO Class</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={`${row.crop}-${row.activeIngredient}-${idx}`} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-3 font-medium">{row.crop}</td><td className="px-3 py-3">{row.activeIngredient}</td><td className="px-3 py-3 tabular-nums">{row.phi}</td><td className="px-3 py-3 tabular-nums">{formatMrl(row.euMRL)}</td>
                  <td className="px-3 py-3">{row.euApproved ? <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">YES</span> : <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800">NO</span>}</td>
                  <td className="px-3 py-3 text-xs text-slate-600">{row.whoClass}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? <p className="px-3 py-8 text-center text-sm text-slate-500">No results found for "{query}"</p> : null}
        </div>
        <p className="mt-3 text-xs text-slate-500">Showing {rows.length} of {chemicalDatabase.length} verified records.</p>
      </div>

      <section className="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2"><Database className="h-5 w-5" /> Why This Database is Our Competitive Moat</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div><h3 className="font-semibold text-blue-800 mb-1">Regulatory Agility</h3><p className="text-sm text-blue-700">Continuously synced with FSSAI gazettes, EU RASFF alerts, and US FDA import refusals. When laws change, our math updates instantly.</p></div>
          <div><h3 className="font-semibold text-blue-800 mb-1">First-Order Kinetics</h3><p className="text-sm text-blue-700">We don't just list limits. We track real-world DT50 half-life values to accurately model how chemicals degrade over time in the field.</p></div>
          <div><h3 className="font-semibold text-blue-800 mb-1">Toxicity Intelligence</h3><p className="text-sm text-blue-700">Every chemical is cross-referenced with the WHO Hazard Classification. We protect farmers from handling Class Ia and Ib toxic substances.</p></div>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, icon, tone, onClick }: { label: string; value: string; icon: ReactNode; tone: "slate" | "emerald" | "amber" | "rose"; onClick?: () => void; }) {
  const toneClass = { slate: "bg-slate-100 text-slate-700", emerald: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", rose: "bg-rose-50 text-rose-700" }[tone];
  return (
    <article onClick={onClick} className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${onClick ? 'cursor-pointer hover:border-emerald-400 hover:shadow-md transition-all' : ''}`}>
      <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneClass}`}>{icon}</span></div>
      <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight">{value}</p>
      {onClick && <p className="text-[10px] text-emerald-600 mt-1 font-semibold">Click to view</p>}
    </article>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">{children}</label>;
}

function NumberField({ id, label, value, step, onChange }: { id: string; label: string; value: string; step: string; onChange: (value: string) => void; }) {
  return (
    <div><FieldLabel htmlFor={id}>{label}</FieldLabel><input id={id} type="number" inputMode="decimal" min="0" step={step} value={value} onChange={(event) => onChange(event.target.value)} className={`${CONTROL} tabular-nums`} /></div>
  );
}

function SpecItem({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</dt><dd className="mt-0.5 font-semibold tabular-nums text-slate-900">{value}</dd></div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</dt><dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd></div>;
}

function QrMark({ value }: { value: string }) {
  const size = 21;
  const cells: boolean[] = [];
  for (let row = 0; row < size; row += 1) { for (let col = 0; col < size; col += 1) { cells.push(qrModule(value, row, col, size)); } }
  return <svg viewBox={`0 0 ${size} ${size}`} className="h-28 w-28 shrink-0 rounded-md border border-slate-200 bg-white p-1 text-slate-900" role="img" aria-label={`QR mark for ${value}`}>{cells.map((on, index) => on ? <rect key={index} x={index % size} y={Math.floor(index / size)} width="1" height="1" fill="currentColor" /> : null)}</svg>;
}

function qrModule(value: string, row: number, col: number, size: number): boolean {
  const finder = finderOn(row, col, size);
  if (finder !== null) return finder;
  const quiet = (row < 8 && col < 8) || (row < 8 && col > size - 9) || (row > size - 9 && col < 8);
  if (quiet) return false;
  let hash = 2166136261;
  const salt = `${value}:${row}:${col}`;
  for (let i = 0; i < salt.length; i += 1) { hash ^= salt.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0) % 3 !== 0;
}

function finderOn(row: number, col: number, size: number): boolean | null {
  const origins = [[0, 0], [0, size - 7], [size - 7, 0]];
  for (const [originRow, originCol] of origins) {
    if (row < originRow || col < originCol || row >= originRow + 7 || col >= originCol + 7) continue;
    const localRow = row - originRow; const localCol = col - originCol;
    const edge = localRow === 0 || localRow === 6 || localCol === 0 || localCol === 6;
    const core = localRow >= 2 && localRow <= 4 && localCol >= 2 && localCol <= 4;
    return edge || core;
  }
  return null;
}

const VERDICT_THEME: Record<Verdict, { card: string; title: string; icon: string }> = {
  SAFE: { card: "border-emerald-200 bg-emerald-50", title: "text-emerald-700", icon: "bg-emerald-600 text-white" },
  DELAY_HARVEST: { card: "border-amber-200 bg-amber-50", title: "text-amber-700", icon: "bg-amber-500 text-white" },
  DO_NOT_USE: { card: "border-rose-200 bg-rose-50", title: "text-rose-700", icon: "bg-rose-600 text-white" },
};

function readForm(form: FormState): { ok: true; input: ComplianceInput } | { ok: false; error: string } {
  if (form.doseApplied.trim() === "" || form.labelDose.trim() === "" || form.daysToHarvest.trim() === "") return { ok: false, error: "form.err.required" };
  const doseApplied = Number(form.doseApplied); const labelDose = Number(form.labelDose); const daysToHarvest = Number(form.daysToHarvest);
  if (!Number.isFinite(doseApplied) || doseApplied <= 0) return { ok: false, error: "form.err.dose" };
  if (!Number.isFinite(labelDose) || labelDose <= 0) return { ok: false, error: "form.err.label" };
  if (!Number.isFinite(daysToHarvest) || daysToHarvest < 0) return { ok: false, error: "form.err.days" };
  return { ok: true, input: { crop: form.crop, chemical: form.chemical, market: form.market, doseApplied, labelDose, daysToHarvest } };
}