import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ModeToggle } from '@/components/ModeToggle'
import { ArrowLeft, Building2, Wallet, TrendingUp, BarChart3, PiggyBank, Home, Info } from 'lucide-react'
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
} from 'recharts'

// ─── Types ───────────────────────────────────────────────────────────────────

type LocationType = 'nue' | 'meublee' | 'colocation'
type RegimeFiscal = 'lmnp_reel' | 'micro_bic' | 'reel_foncier' | 'micro_foncier'

interface SimulatorInputs {
  prixBien: number
  surface: number
  travaux: number
  ameublement: number
  fraisNotaire: number
  apport: number
  tauxCredit: number
  dureeCredit: number
  assuranceEmprunteur: number
  loyerMensuel: number
  locationType: LocationType
  taxeFonciere: number
  chargesCopro: number        // charges non récupérables (€/mois)
  chargesCoproRecup: number   // charges récupérables (€/mois)
  assurancePNO: number        // €/an
  entretien: number           // €/an
  vacanceLocative: number     // semaines/an
  fraisGestion: number        // %
  regimeFiscal: RegimeFiscal
  tmi: number                 // tranche marginale d'imposition (%)
}

// ─── Defaults ────────────────────────────────────────────────────────────────

function getDefaults(prix: number, type: LocationType = 'meublee'): SimulatorInputs {
  const surface = Math.round(prix / 2500)
  const fraisNotaire = Math.round(prix * 0.08)
  const travaux = 0
  const ameublement = type !== 'nue' ? 5000 : 0
  const coutTotal = prix + fraisNotaire + travaux + ameublement
  const apport = Math.round(coutTotal * 0.10)
  const assuranceEmprunteur = Math.round((coutTotal - apport) * 0.004 / 12)
  const loyerMensuel = type === 'colocation' ? 390 * 3 : Math.round((prix * 0.07) / 12)
  return {
    prixBien: prix,
    surface,
    travaux,
    ameublement,
    fraisNotaire,
    apport,
    tauxCredit: 4,
    dureeCredit: 20,
    assuranceEmprunteur,
    loyerMensuel,
    locationType: type,
    taxeFonciere: Math.round(prix * 0.01),
    chargesCopro: 50,
    chargesCoproRecup: 100,
    assurancePNO: 150,
    entretien: 500,
    vacanceLocative: 4,
    fraisGestion: 0,
    regimeFiscal: 'lmnp_reel',
    tmi: 30,
  }
}

// ─── Calculations ─────────────────────────────────────────────────────────────

function calculateResults(inputs: SimulatorInputs) {
  const {
    prixBien, fraisNotaire, travaux, ameublement, apport,
    tauxCredit, dureeCredit, assuranceEmprunteur, loyerMensuel,
    taxeFonciere, chargesCopro, assurancePNO, entretien,
    vacanceLocative, fraisGestion, regimeFiscal, tmi,
  } = inputs

  const coutTotal = prixBien + fraisNotaire + travaux + ameublement
  const capitalEmprunte = Math.max(0, coutTotal - apport)

  // Monthly loan payment (principal + interest, then add insurance separately)
  const r = tauxCredit / 100 / 12
  const n = dureeCredit * 12
  const mensualiteHorsAssurance = capitalEmprunte > 0 && tauxCredit > 0
    ? (capitalEmprunte * r) / (1 - Math.pow(1 + r, -n))
    : (n > 0 ? capitalEmprunte / n : 0)
  const mensualiteCredit = mensualiteHorsAssurance + assuranceEmprunteur

  // Vacancy cost
  const vacanceSemaines = Math.min(52, Math.max(0, vacanceLocative))
  const vacanceCout = loyerMensuel * 12 * vacanceSemaines / 52
  const loyerCollecte = loyerMensuel * 12 - vacanceCout
  const fraisGestionCout = loyerCollecte * fraisGestion / 100

  // Annual non-recoverable charges (paid by the owner)
  const chargesNonRecupAnnuel = taxeFonciere + chargesCopro * 12 + assurancePNO + entretien + vacanceCout + fraisGestionCout
  const chargesNonRecupMensuel = chargesNonRecupAnnuel / 12

  // Gross cash-flow: rent collected minus non-recoverable charges minus loan payment
  const cashFlowBrut = loyerMensuel - chargesNonRecupMensuel - mensualiteCredit

  // Depreciation (LMNP only)
  const amortissementBienAnnuel = prixBien * 0.015      // 1.5 %/an
  const amortissementMobilierAnnuel = ameublement * 0.15 // 15 %/an
  const amortissementBienMensuel = amortissementBienAnnuel / 12
  const amortissementMobilierMensuel = amortissementMobilierAnnuel / 12

  // Taxable income per regime
  const loyerBrut = loyerMensuel * 12
  let baseImposableAnnuelle = 0
  let abattement = 0
  let explicTax = ''

  if (regimeFiscal === 'lmnp_reel') {
    baseImposableAnnuelle = Math.max(0, loyerBrut - chargesNonRecupAnnuel - amortissementBienAnnuel - amortissementMobilierAnnuel)
    explicTax = 'Loyers − charges réelles − amortissements (bien + mobilier)'
  } else if (regimeFiscal === 'micro_bic') {
    abattement = loyerBrut * 0.50
    baseImposableAnnuelle = loyerBrut * 0.50
    explicTax = 'Abattement forfaitaire de 50 % sur les loyers bruts'
  } else if (regimeFiscal === 'reel_foncier') {
    baseImposableAnnuelle = Math.max(0, loyerBrut - chargesNonRecupAnnuel)
    explicTax = 'Loyers − charges réelles (pas d\'amortissement en location nue)'
  } else {
    // micro_foncier
    abattement = loyerBrut * 0.30
    baseImposableAnnuelle = loyerBrut * 0.70
    explicTax = 'Abattement forfaitaire de 30 % sur les loyers bruts'
  }

  // Tax = TMI + social contributions (17.2 %)
  const tauxEffectif = tmi / 100 + 0.172
  const impotsAnnuels = baseImposableAnnuelle * tauxEffectif
  const impotsMensuels = impotsAnnuels / 12

  // Net cash-flow
  const cashFlowNet = cashFlowBrut - impotsMensuels
  const effortEpargne = Math.max(0, -cashFlowNet)

  // Yields
  const rendementBrut = coutTotal > 0 ? (loyerBrut / coutTotal) * 100 : 0
  const rendementNet = coutTotal > 0 ? ((loyerBrut - chargesNonRecupAnnuel) / coutTotal) * 100 : 0

  // Patrimony over time
  const patrimoineData: { annee: number; patrimoineNet: number; capitalRestantDu: number }[] = []
  let capitalRestantDu = capitalEmprunte
  const tMensuel = tauxCredit / 100 / 12
  for (let annee = 0; annee <= dureeCredit; annee++) {
    patrimoineData.push({
      annee,
      patrimoineNet: Math.round(prixBien - capitalRestantDu),
      capitalRestantDu: Math.round(capitalRestantDu),
    })
    if (annee < dureeCredit) {
      for (let mois = 0; mois < 12; mois++) {
        if (capitalRestantDu <= 0) break
        const interets = capitalRestantDu * tMensuel
        const remboursementCapital = mensualiteHorsAssurance - interets
        capitalRestantDu = Math.max(0, capitalRestantDu - remboursementCapital)
      }
    }
  }

  // Monthly cost breakdown
  const coutsMensuels = {
    credit: Math.round(mensualiteCredit * 10) / 10,
    taxeFonciere: Math.round(taxeFonciere / 12 * 10) / 10,
    chargesCopro: chargesCopro,
    assurancePNO: Math.round(assurancePNO / 12 * 10) / 10,
    entretien: Math.round(entretien / 12 * 10) / 10,
    vacance: Math.round(vacanceCout / 12 * 10) / 10,
    fraisGestion: Math.round(fraisGestionCout / 12 * 10) / 10,
    impots: Math.round(impotsMensuels * 10) / 10,
  }

  return {
    coutTotal,
    capitalEmprunte,
    mensualiteCredit,
    chargesNonRecupAnnuel,
    chargesNonRecupMensuel,
    amortissementBienMensuel,
    amortissementMobilierMensuel,
    baseImposableAnnuelle,
    baseImposableMensuelle: baseImposableAnnuelle / 12,
    impotsMensuels,
    abattement,
    cashFlowBrut,
    cashFlowNet,
    effortEpargne,
    rendementBrut,
    rendementNet,
    explicTax,
    tauxEffectif: tauxEffectif * 100,
    patrimoineData,
    coutsMensuels,
    loyerBrut,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number, decimals = 0): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: decimals,
  }).format(v)
}

// ─── Field Component ──────────────────────────────────────────────────────────

interface FieldProps {
  label: string
  value: number
  onChange: (v: number) => void
  suffix?: string
  step?: number
  min?: number
  hint?: string
}

function Field({ label, value, onChange, suffix, step = 1, min = 0, hint }: FieldProps) {
  const [display, setDisplay] = useState(String(value))
  const lastEmitted = useRef(value)

  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value
      setDisplay(String(value))
    }
  }, [value])

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative flex items-center">
        <Input
          type="number"
          value={display}
          onChange={e => {
            const raw = e.target.value
            setDisplay(raw)
            const parsed = parseFloat(raw)
            const v = isNaN(parsed) ? 0 : parsed
            lastEmitted.current = v
            onChange(v)
          }}
          step={step}
          min={min}
          className="pr-10 text-sm h-9"
        />
        {suffix && (
          <span className="absolute right-3 text-xs text-muted-foreground pointer-events-none">{suffix}</span>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground/60">{hint}</p>}
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KPICardProps {
  title: string
  value: string
  subtitle?: string
  variant?: 'default' | 'positive' | 'warning' | 'negative'
  icon: React.ReactNode
}

function KPICard({ title, value, subtitle, variant = 'default', icon }: KPICardProps) {
  const variantStyles = {
    default: 'border-border/50',
    positive: 'border-emerald-500/30 bg-emerald-500/5',
    warning: 'border-orange-500/30 bg-orange-500/5',
    negative: 'border-red-500/30 bg-red-500/5',
  }
  const valueStyles = {
    default: 'text-foreground',
    positive: 'text-emerald-400',
    warning: 'text-orange-400',
    negative: 'text-red-400',
  }
  return (
    <Card className={`${variantStyles[variant]} transition-all duration-200`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</span>
          <div className="text-muted-foreground/50">{icon}</div>
        </div>
        <div className={`text-2xl font-bold tabular-nums ${valueStyles[variant]}`}>{value}</div>
        {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
      </CardContent>
    </Card>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ImmobilierSimulator() {
  const [inputs, setInputs] = useState<SimulatorInputs>(() => getDefaults(150000, 'meublee'))
  const results = useMemo(() => calculateResults(inputs), [inputs])

  const updateNum = useCallback((field: keyof SimulatorInputs) => (value: number) => {
    setInputs(prev => ({ ...prev, [field]: value }))
  }, [])

  const update = useCallback(<K extends keyof SimulatorInputs>(field: K, value: SimulatorInputs[K]) => {
    setInputs(prev => ({ ...prev, [field]: value }))
  }, [])

  const setLocationType = useCallback((type: LocationType) => {
    setInputs(prev => ({
      ...prev,
      locationType: type,
      ameublement: type !== 'nue' ? (prev.ameublement || 5000) : 0,
      regimeFiscal: type === 'nue' ? 'reel_foncier' : 'lmnp_reel',
    }))
  }, [])

  // Cost breakdown for the bar chart
  const breakdownItems = [
    { name: 'Crédit', value: results.coutsMensuels.credit, color: '#3b82f6' },
    { name: 'Taxe foncière', value: results.coutsMensuels.taxeFonciere, color: '#f59e0b' },
    { name: 'Charges copro', value: results.coutsMensuels.chargesCopro, color: '#8b5cf6' },
    { name: 'Assurance PNO', value: results.coutsMensuels.assurancePNO, color: '#06b6d4' },
    { name: 'Entretien', value: results.coutsMensuels.entretien, color: '#10b981' },
    { name: 'Vacance', value: results.coutsMensuels.vacance, color: '#f97316' },
    { name: 'Gestion', value: results.coutsMensuels.fraisGestion, color: '#ec4899' },
    { name: 'Impôts', value: results.coutsMensuels.impots, color: '#ef4444' },
  ].filter(d => d.value > 0).sort((a, b) => b.value - a.value)

  const totalCoutsMensuels = breakdownItems.reduce((s, d) => s + d.value, 0)

  const cashFlowVariant = results.cashFlowNet > 0 ? 'positive' : results.cashFlowNet < -200 ? 'negative' : 'warning'

  const regimesDisponibles = inputs.locationType !== 'nue'
    ? ([
      { value: 'lmnp_reel', label: 'LMNP Réel', desc: 'Charges + amortissements' },
      { value: 'micro_bic', label: 'Micro-BIC', desc: 'Abattement 50 %' },
    ] as const)
    : ([
      { value: 'reel_foncier', label: 'Réel foncier', desc: 'Charges déductibles' },
      { value: 'micro_foncier', label: 'Micro-foncier', desc: 'Abattement 30 %' },
    ] as const)

  return (
    <div className="min-h-screen bg-background">

      {/* ── Header ── */}
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Separator orientation="vertical" className="h-5" />
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-400" />
              <span className="font-semibold text-sm">Simulateur Immobilier Locatif</span>
            </div>
          </div>
          <ModeToggle />
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

          {/* ══════════════════════════════════════════════
              LEFT COLUMN — INPUTS
          ══════════════════════════════════════════════ */}
          <div className="space-y-6">

            {/* Type de location & régime fiscal */}
            <Card className="border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Home className="w-4 h-4 text-blue-400" />
                  Type de location &amp; fiscalité
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">

                {/* Location type */}
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'meublee', label: 'Meublée', sub: 'LMNP' },
                    { value: 'nue', label: 'Nue', sub: 'Foncier' },
                    { value: 'colocation', label: 'Colocation', sub: 'LMNP' },
                  ] as const).map(({ value, label, sub }) => (
                    <button
                      key={value}
                      onClick={() => setLocationType(value)}
                      className={`p-3 rounded-lg border text-center transition-all ${
                        inputs.locationType === value
                          ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                          : 'border-border/50 hover:border-border text-muted-foreground'
                      }`}
                    >
                      <div className="text-sm font-medium">{label}</div>
                      <div className="text-xs opacity-70">{sub}</div>
                    </button>
                  ))}
                </div>

                {/* Fiscal regime */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Régime fiscal</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {regimesDisponibles.map(({ value, label, desc }) => (
                      <button
                        key={value}
                        onClick={() => update('regimeFiscal', value)}
                        className={`p-2.5 rounded-lg border text-left transition-all ${
                          inputs.regimeFiscal === value
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-border/50 hover:border-border'
                        }`}
                      >
                        <div className={`text-xs font-medium ${inputs.regimeFiscal === value ? 'text-blue-400' : 'text-foreground'}`}>{label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* TMI */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Tranche Marginale d'Imposition (TMI)</Label>
                  <div className="grid grid-cols-5 gap-1">
                    {[0, 11, 30, 41, 45].map(taux => (
                      <button
                        key={taux}
                        onClick={() => update('tmi', taux)}
                        className={`py-1.5 rounded-lg border text-xs font-medium transition-all ${
                          inputs.tmi === taux
                            ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                            : 'border-border/50 hover:border-border text-muted-foreground'
                        }`}
                      >
                        {taux}%
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground/60">
                    + prélèvements sociaux 17,2 % → taux effectif {results.tauxEffectif.toFixed(1)} %
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Le bien */}
            <Card className="border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-400" />
                  Le bien
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <Field label="Prix d'achat" value={inputs.prixBien} onChange={updateNum('prixBien')} suffix="€" step={5000} />
                <Field label="Surface" value={inputs.surface} onChange={updateNum('surface')} suffix="m²" />
                <Field label="Travaux" value={inputs.travaux} onChange={updateNum('travaux')} suffix="€" step={1000} />
                {inputs.locationType !== 'nue' && (
                  <Field label="Ameublement" value={inputs.ameublement} onChange={updateNum('ameublement')} suffix="€" step={500} />
                )}
                <Field
                  label="Frais de notaire"
                  value={inputs.fraisNotaire}
                  onChange={updateNum('fraisNotaire')}
                  suffix="€"
                  step={1000}
                  hint={`${inputs.prixBien > 0 ? ((inputs.fraisNotaire / inputs.prixBien) * 100).toFixed(1) : '0'} % du prix`}
                />
              </CardContent>
            </Card>

            {/* Financement */}
            <Card className="border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-indigo-400" />
                  Financement
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <Field
                  label="Apport personnel"
                  value={inputs.apport}
                  onChange={updateNum('apport')}
                  suffix="€"
                  step={5000}
                  hint={`${results.coutTotal > 0 ? ((inputs.apport / results.coutTotal) * 100).toFixed(0) : '0'} % du projet`}
                />
                <Field label="Taux crédit" value={inputs.tauxCredit} onChange={updateNum('tauxCredit')} suffix="%" step={0.1} min={0} />
                <Field label="Durée crédit" value={inputs.dureeCredit} onChange={updateNum('dureeCredit')} suffix="ans" step={1} min={1} />
                <Field label="Assurance emprunteur" value={inputs.assuranceEmprunteur} onChange={updateNum('assuranceEmprunteur')} suffix="€/mois" />
              </CardContent>
            </Card>

            {/* Revenus */}
            <Card className="border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Revenus locatifs
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Field
                    label="Loyer mensuel (charges récupérables comprises)"
                    value={inputs.loyerMensuel}
                    onChange={updateNum('loyerMensuel')}
                    suffix="€/mois"
                    step={50}
                    hint={`Soit ${results.coutTotal > 0 ? ((inputs.loyerMensuel * 12 / results.coutTotal) * 100).toFixed(2) : '0'} % brut / an`}
                  />
                </div>
                <Field
                  label="Vacance locative"
                  value={inputs.vacanceLocative}
                  onChange={updateNum('vacanceLocative')}
                  suffix="sem/an"
                  step={1}
                  min={0}
                  hint={`${((inputs.vacanceLocative / 52) * 100).toFixed(0)} % du temps`}
                />
                <Field
                  label="Frais de gestion agence"
                  value={inputs.fraisGestion}
                  onChange={updateNum('fraisGestion')}
                  suffix="%"
                  step={0.5}
                  min={0}
                  hint="0 % si gestion directe"
                />
              </CardContent>
            </Card>

            {/* Charges */}
            <Card className="border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-orange-400" />
                  Charges &amp; dépenses
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <Field
                  label="Taxe foncière"
                  value={inputs.taxeFonciere}
                  onChange={updateNum('taxeFonciere')}
                  suffix="€/an"
                  step={100}
                  hint={`${(inputs.taxeFonciere / 12).toFixed(0)} €/mois`}
                />
                <Field
                  label="Charges copro (non récup.)"
                  value={inputs.chargesCopro}
                  onChange={updateNum('chargesCopro')}
                  suffix="€/mois"
                  step={10}
                  hint="Entretien, honoraires syndic..."
                />
                <Field
                  label="Charges récupérables"
                  value={inputs.chargesCoproRecup}
                  onChange={updateNum('chargesCoproRecup')}
                  suffix="€/mois"
                  step={10}
                  hint="Eau, chauffage collectif..."
                />
                <Field
                  label="Assurance PNO"
                  value={inputs.assurancePNO}
                  onChange={updateNum('assurancePNO')}
                  suffix="€/an"
                  step={50}
                  hint={`${(inputs.assurancePNO / 12).toFixed(0)} €/mois`}
                />
                <Field
                  label="Entretien / réparations"
                  value={inputs.entretien}
                  onChange={updateNum('entretien')}
                  suffix="€/an"
                  step={100}
                  hint={`${(inputs.entretien / 12).toFixed(0)} €/mois`}
                />
              </CardContent>
            </Card>

          </div>

          {/* ══════════════════════════════════════════════
              RIGHT COLUMN — RESULTS
          ══════════════════════════════════════════════ */}
          <div className="space-y-6">

            {/* KPI Cards */}
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Indicateurs clés</h2>
              <div className="grid grid-cols-2 gap-4">
                <KPICard
                  title="Cash-flow NET"
                  value={fmt(results.cashFlowNet)}
                  subtitle="par mois (après impôts)"
                  icon={<Wallet className="w-4 h-4" />}
                  variant={cashFlowVariant}
                />
                <KPICard
                  title="Cash-flow brut"
                  value={fmt(results.cashFlowBrut)}
                  subtitle="avant impôts"
                  icon={<TrendingUp className="w-4 h-4" />}
                  variant={results.cashFlowBrut >= 0 ? 'positive' : 'negative'}
                />
                <KPICard
                  title="Rendement brut"
                  value={`${results.rendementBrut.toFixed(2)} %`}
                  subtitle="Loyers / coût total"
                  icon={<BarChart3 className="w-4 h-4" />}
                />
                <KPICard
                  title="Rendement net"
                  value={`${results.rendementNet.toFixed(2)} %`}
                  subtitle="Après charges, avant crédit"
                  icon={<TrendingUp className="w-4 h-4" />}
                  variant={results.rendementNet > 0 ? 'positive' : 'default'}
                />
              </div>
            </div>

            {/* Résumé financier mensuel */}
            <Card className="border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <PiggyBank className="w-4 h-4 text-blue-400" />
                  Résumé financier mensuel
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">+ Loyer encaissé</span>
                  <span className="font-medium text-emerald-400">+{fmt(inputs.loyerMensuel)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">− Mensualité crédit (dont assurance)</span>
                  <span className="font-medium text-red-400">−{fmt(results.mensualiteCredit)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">− Charges non récupérables</span>
                  <span className="font-medium text-orange-400">−{fmt(results.chargesNonRecupMensuel)}</span>
                </div>
                <Separator className="border-border/30" />
                <div className="flex items-center justify-between font-medium">
                  <span>= Cash-flow brut</span>
                  <span className={results.cashFlowBrut >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {results.cashFlowBrut >= 0 ? '+' : ''}{fmt(results.cashFlowBrut)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    − Impôts ({
                      inputs.regimeFiscal === 'lmnp_reel' ? 'LMNP réel' :
                      inputs.regimeFiscal === 'micro_bic' ? 'Micro-BIC' :
                      inputs.regimeFiscal === 'reel_foncier' ? 'Réel foncier' : 'Micro-foncier'
                    })
                  </span>
                  <span className="font-medium text-red-400">−{fmt(results.impotsMensuels)}</span>
                </div>
                <Separator className="border-border/30" />
                <div className="flex items-center justify-between font-bold text-base">
                  <span>= Cash-flow NET</span>
                  <span className={results.cashFlowNet >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {results.cashFlowNet >= 0 ? '+' : ''}{fmt(results.cashFlowNet)}
                  </span>
                </div>
                {results.cashFlowNet < 0 && (
                  <div className="mt-1 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg text-xs text-orange-300">
                    💰 Effort d'épargne mensuel : <strong>{fmt(results.effortEpargne)}</strong>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pourquoi ces impôts ? */}
            <Card className="border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Info className="w-4 h-4 text-yellow-400" />
                  Pourquoi ces impôts ?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="p-3 rounded-lg bg-muted/30 space-y-2.5">
                  <div className="font-medium text-sm text-foreground">
                    Calcul de la base imposable ({
                      inputs.regimeFiscal === 'lmnp_reel' ? 'LMNP Réel' :
                      inputs.regimeFiscal === 'micro_bic' ? 'Micro-BIC' :
                      inputs.regimeFiscal === 'reel_foncier' ? 'Réel foncier' : 'Micro-foncier'
                    })
                  </div>
                  <p className="text-muted-foreground">{results.explicTax}</p>

                  <div className="space-y-1.5 text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Loyers bruts</span>
                      <span>{fmt(results.loyerBrut)}/an</span>
                    </div>

                    {(inputs.regimeFiscal === 'lmnp_reel' || inputs.regimeFiscal === 'reel_foncier') && (
                      <div className="flex justify-between text-red-400">
                        <span>− Charges réelles</span>
                        <span>−{fmt(results.chargesNonRecupAnnuel)}/an</span>
                      </div>
                    )}
                    {inputs.regimeFiscal === 'lmnp_reel' && (
                      <>
                        <div className="flex justify-between text-red-400">
                          <span>− Amortissement bien</span>
                          <span>−{fmt(results.amortissementBienMensuel * 12)}/an</span>
                        </div>
                        <div className="flex justify-between text-red-400">
                          <span>− Amortissement mobilier</span>
                          <span>−{fmt(results.amortissementMobilierMensuel * 12)}/an</span>
                        </div>
                      </>
                    )}
                    {(inputs.regimeFiscal === 'micro_bic' || inputs.regimeFiscal === 'micro_foncier') && (
                      <div className="flex justify-between text-red-400">
                        <span>− Abattement {inputs.regimeFiscal === 'micro_bic' ? '50 %' : '30 %'}</span>
                        <span>−{fmt(results.abattement)}/an</span>
                      </div>
                    )}

                    <Separator className="border-border/40" />
                    <div className="flex justify-between font-semibold text-foreground">
                      <span>= Base imposable</span>
                      <span>{fmt(results.baseImposableAnnuelle)}/an ({fmt(results.baseImposableMensuelle)}/mois)</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20">
                  <span className="text-muted-foreground">Taux d'imposition</span>
                  <span className="font-medium text-foreground">
                    TMI {inputs.tmi} % + PS 17,2 % = {results.tauxEffectif.toFixed(1)} %
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20">
                  <span className="text-muted-foreground">Impôts annuels</span>
                  <span className="font-medium text-red-400">
                    {fmt(results.impotsMensuels * 12)}/an ({fmt(results.impotsMensuels)}/mois)
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Ce qui coûte le plus cher */}
            <Card className="border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Ce qui coûte le plus cher</CardTitle>
                <p className="text-xs text-muted-foreground">Décomposition des coûts mensuels</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {breakdownItems.map(({ name, value, color }) => (
                  <div key={name} className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground truncate">{name}</span>
                        <span className="font-medium ml-2 flex-shrink-0">{fmt(value)}/mois</span>
                      </div>
                      <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${totalCoutsMensuels > 0 ? (value / totalCoutsMensuels) * 100 : 0}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right flex-shrink-0">
                      {totalCoutsMensuels > 0 ? ((value / totalCoutsMensuels) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                ))}
                <Separator className="border-border/30" />
                <div className="flex justify-between text-sm font-medium">
                  <span>Total dépenses</span>
                  <span>{fmt(totalCoutsMensuels)}/mois</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Loyer encaissé</span>
                  <span className="text-emerald-400">+{fmt(inputs.loyerMensuel)}/mois</span>
                </div>
              </CardContent>
            </Card>

            {/* Évolution du patrimoine */}
            <Card className="border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Évolution du patrimoine</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Patrimoine net et capital restant dû sur {inputs.dureeCredit} ans
                </p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={results.patrimoineData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="annee"
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(v) => `${v}a`}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                      width={50}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: 12,
                      }}
                      formatter={(value: number, name: string) => {
                        const labels: Record<string, string> = {
                          patrimoineNet: 'Patrimoine net',
                          capitalRestantDu: 'Capital restant dû',
                        }
                        return [fmt(value), labels[name] || name]
                      }}
                      labelFormatter={(v) => `Année ${v}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="patrimoineNet"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.15}
                      strokeWidth={2}
                      name="patrimoineNet"
                    />
                    <Area
                      type="monotone"
                      dataKey="capitalRestantDu"
                      stroke="hsl(var(--muted-foreground))"
                      fill="hsl(var(--muted-foreground))"
                      fillOpacity={0.05}
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      name="capitalRestantDu"
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 mt-2 justify-center">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-4 h-0.5 bg-blue-500 rounded" />
                    Patrimoine net
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-4 h-0.5 bg-muted-foreground rounded" />
                    Capital restant dû
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary badges */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">
                🏠 {inputs.surface} m² · {results.coutTotal > 0 && inputs.surface > 0 ? fmt(inputs.prixBien / inputs.surface) : '—'}/m²
              </Badge>
              <Badge variant="outline" className="text-xs">
                💰 Coût total : {fmt(results.coutTotal)}
              </Badge>
              <Badge variant="outline" className="text-xs">
                🏦 Emprunté : {fmt(results.capitalEmprunte)}
              </Badge>
              <Badge variant="outline" className="text-xs">
                📊 Mensualité : {fmt(results.mensualiteCredit)}/mois
              </Badge>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
