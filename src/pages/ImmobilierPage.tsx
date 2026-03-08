import { useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ModeToggle } from '@/components/ModeToggle'
import { ArrowLeft, ChevronDown, TrendingUp, Home, Wallet, BarChart3 } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

type LocationType = 'nue' | 'meublee' | 'colocation'

interface SimulatorInputs {
  prixBien: number
  surface: number
  fraisNotaire: number
  travaux: number
  ameublement: number
  apport: number
  tauxCredit: number
  dureeCredit: number
  assuranceEmprunteur: number
  loyerMensuel: number
  locationType: LocationType
  taxeFonciere: number
  chargesCopro: number
  assurancePNO: number
  entretien: number
  vacanceLocative: number
  fraisGestion: number
}

function getDefaults(prix: number, locationType: LocationType = 'meublee'): SimulatorInputs {
  const surface = Math.round(prix / 2500)
  const fraisNotaire = Math.round(prix * 0.08)
  const travaux = 0
  const ameublement = locationType !== 'nue' ? 5000 : 0
  const coutTotal = prix + fraisNotaire + travaux + ameublement
  const apport = Math.round(coutTotal * 0.10)
  const capitalEmprunte = coutTotal - apport
  const tauxCredit = 3.25
  const dureeCredit = 25
  const assuranceEmprunteur = Math.round((capitalEmprunte * 0.003) / 12)
  const loyerMensuel = Math.round((prix * 0.07) / 12)
  const taxeFonciere = Math.round(prix * 0.01)
  const chargesCopro = 50
  const assurancePNO = 150
  const entretien = 500
  const vacanceLocative = 2
  const fraisGestion = 0

  return {
    prixBien: prix,
    surface,
    fraisNotaire,
    travaux,
    ameublement,
    apport,
    tauxCredit,
    dureeCredit,
    assuranceEmprunteur,
    loyerMensuel,
    locationType,
    taxeFonciere,
    chargesCopro,
    assurancePNO,
    entretien,
    vacanceLocative,
    fraisGestion,
  }
}

function calculateMensualite(capital: number, tauxAnnuel: number, dureeAns: number): number {
  if (capital <= 0 || tauxAnnuel <= 0 || dureeAns <= 0) return 0
  const t = tauxAnnuel / 100 / 12
  const n = dureeAns * 12
  return (capital * t) / (1 - Math.pow(1 + t, -n))
}

function calculateResults(inputs: SimulatorInputs) {
  const { prixBien, fraisNotaire, travaux, ameublement, apport, tauxCredit, dureeCredit,
    assuranceEmprunteur, loyerMensuel, taxeFonciere, chargesCopro, assurancePNO,
    entretien, vacanceLocative, fraisGestion } = inputs

  const coutTotalProjet = prixBien + fraisNotaire + travaux + ameublement
  const montantEmprunte = Math.max(0, coutTotalProjet - apport)
  const mensualiteCredit = calculateMensualite(montantEmprunte, tauxCredit, dureeCredit)
  const totalInterets = mensualiteCredit * dureeCredit * 12 - montantEmprunte

  const loyerAnnuel = loyerMensuel * 12
  // 4.33 = average weeks per month (52 weeks / 12 months)
  const vacanceLocativeCout = loyerMensuel * vacanceLocative / 52 * 4.33
  const fraisGestionCout = loyerAnnuel * fraisGestion / 100
  const chargesAnnuelles = taxeFonciere + chargesCopro * 12 + assurancePNO + entretien + vacanceLocativeCout + fraisGestionCout

  const rendementBrut = coutTotalProjet > 0 ? (loyerAnnuel / coutTotalProjet) * 100 : 0
  const revenuNetAnnuel = loyerAnnuel - chargesAnnuelles
  const rendementNet = coutTotalProjet > 0 ? (revenuNetAnnuel / coutTotalProjet) * 100 : 0

  const cashFlowMensuel = loyerMensuel - mensualiteCredit - assuranceEmprunteur - chargesAnnuelles / 12
  const effortEpargne = Math.max(0, -cashFlowMensuel)

  const prixAuM2 = inputs.surface > 0 ? prixBien / inputs.surface : 0

  // Patrimoine net over time
  const patrimoineData = []
  let capitalRestantDu = montantEmprunte
  const t = tauxCredit / 100 / 12
  for (let annee = 0; annee <= dureeCredit; annee++) {
    patrimoineData.push({
      annee,
      patrimoineNet: Math.round(prixBien - capitalRestantDu),
      capitalRestantDu: Math.round(capitalRestantDu),
    })
    if (annee < dureeCredit) {
      for (let mois = 0; mois < 12; mois++) {
        if (capitalRestantDu <= 0) break
        const interets = capitalRestantDu * t
        const remboursementCapital = mensualiteCredit - interets
        capitalRestantDu = Math.max(0, capitalRestantDu - remboursementCapital)
      }
    }
  }

  return {
    coutTotalProjet,
    montantEmprunte,
    mensualiteCredit,
    totalInterets,
    chargesAnnuelles,
    revenuNetAnnuel,
    rendementBrut,
    rendementNet,
    cashFlowMensuel,
    effortEpargne,
    prixAuM2,
    patrimoineData,
  }
}

function formatEuro(value: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`
}

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
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative flex items-center">
        <Input
          type="number"
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
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

export default function ImmobilierPage() {
  const [inputs, setInputs] = useState<SimulatorInputs>(() => getDefaults(200000))
  const [detailsOpen, setDetailsOpen] = useState(false)

  const results = useMemo(() => calculateResults(inputs), [inputs])

  const updateField = useCallback((field: keyof SimulatorInputs) => (value: number) => {
    setInputs(prev => ({ ...prev, [field]: value }))
  }, [])

  const handlePrixChange = useCallback((prix: number) => {
    setInputs(prev => getDefaults(prix, prev.locationType))
  }, [])

  const cashFlowVariant = results.cashFlowMensuel > 0 ? 'positive' : results.cashFlowMensuel > -100 ? 'warning' : 'negative'
  const coutTotalInputs = inputs.prixBien + inputs.fraisNotaire + inputs.travaux + inputs.ameublement

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Separator orientation="vertical" className="h-5" />
            <div className="flex items-center gap-2">
              <Home className="w-4 h-4 text-blue-400" />
              <span className="font-semibold text-sm">Rentabilité Immobilière Locative</span>
            </div>
          </div>
          <ModeToggle />
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Left: Inputs */}
          <div className="space-y-6">
            {/* Le bien */}
            <Card className="border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Home className="w-4 h-4 text-blue-400" />
                  Le bien
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Prix du bien (€)</Label>
                  <div className="relative flex items-center mt-1.5">
                    <Input
                      type="number"
                      value={inputs.prixBien}
                      onChange={e => handlePrixChange(parseFloat(e.target.value) || 0)}
                      step={1000}
                      min={0}
                      className="pr-8 font-semibold h-11 text-lg"
                    />
                    <span className="absolute right-3 text-sm text-muted-foreground pointer-events-none">€</span>
                  </div>
                  <p className="text-xs text-muted-foreground/60 mt-1">Champ principal — les autres champs se recalculent automatiquement</p>
                </div>
                <Field label="Surface (m²)" value={inputs.surface} onChange={updateField('surface')} suffix="m²" />
                <Field label="Frais de notaire (€)" value={inputs.fraisNotaire} onChange={updateField('fraisNotaire')} suffix="€" step={100} hint={`~${inputs.prixBien > 0 ? ((inputs.fraisNotaire / inputs.prixBien) * 100).toFixed(1) : '0'}% du prix`} />
                <Field label="Travaux (€)" value={inputs.travaux} onChange={updateField('travaux')} suffix="€" step={500} />
                <Field label="Ameublement (€)" value={inputs.ameublement} onChange={updateField('ameublement')} suffix="€" step={100} />
              </CardContent>
            </Card>

            {/* Le financement */}
            <Card className="border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-purple-400" />
                  Le financement
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <Field
                  label="Apport (€)"
                  value={inputs.apport}
                  onChange={updateField('apport')}
                  suffix="€"
                  step={1000}
                  hint={`${coutTotalInputs > 0 ? ((inputs.apport / coutTotalInputs) * 100).toFixed(1) : '0'}% du coût total`}
                />
                <Field label="Taux du crédit (%)" value={inputs.tauxCredit} onChange={updateField('tauxCredit')} suffix="%" step={0.05} />
                <Field label="Durée du crédit (ans)" value={inputs.dureeCredit} onChange={updateField('dureeCredit')} suffix="ans" min={1} />
                <Field label="Assurance emprunteur (€/mois)" value={inputs.assuranceEmprunteur} onChange={updateField('assuranceEmprunteur')} suffix="€/mois" step={5} />
              </CardContent>
            </Card>

            {/* Les revenus */}
            <Card className="border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Les revenus
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field
                  label="Loyer mensuel hors charges (€)"
                  value={inputs.loyerMensuel}
                  onChange={updateField('loyerMensuel')}
                  suffix="€/mois"
                  step={10}
                  hint={`Rendement brut indicatif : ${coutTotalInputs > 0 ? ((inputs.loyerMensuel * 12 / coutTotalInputs) * 100).toFixed(2) : '0.00'}%`}
                />
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Type de location</Label>
                  <Select value={inputs.locationType} onValueChange={(v) => {
                    const newType = v as LocationType
                    setInputs(prev => ({
                      ...prev,
                      locationType: newType,
                      ameublement: newType !== 'nue' ? (prev.ameublement || 5000) : 0,
                    }))
                  }}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nue">Location nue</SelectItem>
                      <SelectItem value="meublee">Location meublée</SelectItem>
                      <SelectItem value="colocation">Colocation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Les charges */}
            <Card className="border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-orange-400" />
                  Les charges
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <Field label="Taxe foncière (€/an)" value={inputs.taxeFonciere} onChange={updateField('taxeFonciere')} suffix="€/an" step={50} />
                <Field label="Charges copro (€/mois)" value={inputs.chargesCopro} onChange={updateField('chargesCopro')} suffix="€/mois" step={10} />
                <Field label="Assurance PNO (€/an)" value={inputs.assurancePNO} onChange={updateField('assurancePNO')} suffix="€/an" step={10} />
                <Field label="Entretien / imprévus (€/an)" value={inputs.entretien} onChange={updateField('entretien')} suffix="€/an" step={100} />
                <Field label="Vacance locative (semaines/an)" value={inputs.vacanceLocative} onChange={updateField('vacanceLocative')} suffix="sem." step={1} />
                <Field label="Frais de gestion (%)" value={inputs.fraisGestion} onChange={updateField('fraisGestion')} suffix="%" step={0.5} hint="0% = gestion perso" />
              </CardContent>
            </Card>
          </div>

          {/* Right: Results */}
          <div className="space-y-6">
            {/* KPI Cards */}
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Indicateurs clés</h2>
              <div className="grid grid-cols-2 gap-4">
                <KPICard
                  title="Rendement brut"
                  value={formatPercent(results.rendementBrut)}
                  subtitle="Loyer annuel / coût total"
                  icon={<TrendingUp className="w-4 h-4" />}
                  variant={results.rendementBrut >= 6 ? 'positive' : results.rendementBrut >= 4 ? 'warning' : 'negative'}
                />
                <KPICard
                  title="Rendement net"
                  value={formatPercent(results.rendementNet)}
                  subtitle="Avant impôt"
                  icon={<TrendingUp className="w-4 h-4" />}
                  variant={results.rendementNet >= 4 ? 'positive' : results.rendementNet >= 2 ? 'warning' : 'negative'}
                />
                <KPICard
                  title="Cash-flow mensuel"
                  value={formatEuro(results.cashFlowMensuel)}
                  subtitle="Avant impôt"
                  icon={<Wallet className="w-4 h-4" />}
                  variant={cashFlowVariant}
                />
                <KPICard
                  title="Effort d'épargne"
                  value={formatEuro(results.effortEpargne)}
                  subtitle="À sortir de poche / mois"
                  icon={<BarChart3 className="w-4 h-4" />}
                  variant={results.effortEpargne === 0 ? 'positive' : results.effortEpargne < 200 ? 'warning' : 'negative'}
                />
              </div>
            </div>

            {/* Patrimoine chart */}
            <Card className="border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Évolution du patrimoine net</CardTitle>
                <p className="text-xs text-muted-foreground">Capital restant dû vs valeur du bien sur {inputs.dureeCredit} ans</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={results.patrimoineData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="annee" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `${v}a`} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} width={45} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
                      formatter={(value: number, name: string) => [formatEuro(value), name === 'patrimoineNet' ? 'Patrimoine net' : 'Capital restant dû']}
                      labelFormatter={(v) => `Année ${v}`}
                    />
                    <Line type="monotone" dataKey="patrimoineNet" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="patrimoineNet" />
                    <Line type="monotone" dataKey="capitalRestantDu" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} name="capitalRestantDu" strokeDasharray="4 4" />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 mt-2 justify-center">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-4 h-0.5 bg-primary rounded" />
                    Patrimoine net
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-4 h-0.5 bg-destructive rounded" />
                    Capital restant dû
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Details collapsible */}
            <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
              <Card className="border-border/50">
                <CollapsibleTrigger asChild>
                  <CardHeader className="pb-4 cursor-pointer hover:bg-accent/20 rounded-t-lg transition-colors">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Détails du projet</CardTitle>
                      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${detailsOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-3">
                    {[
                      { label: 'Coût total du projet', value: formatEuro(results.coutTotalProjet) },
                      { label: 'Montant emprunté', value: formatEuro(results.montantEmprunte) },
                      { label: 'Mensualité de crédit', value: formatEuro(results.mensualiteCredit) + '/mois' },
                      { label: 'Total des intérêts', value: formatEuro(Math.max(0, results.totalInterets)) },
                      { label: 'Total charges annuelles', value: formatEuro(results.chargesAnnuelles) },
                      { label: 'Revenu net annuel avant impôt', value: formatEuro(results.revenuNetAnnuel) },
                      { label: 'Prix au m²', value: formatEuro(results.prixAuM2) + '/m²' },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                        <span className="text-sm text-muted-foreground">{label}</span>
                        <span className="text-sm font-semibold tabular-nums">{value}</span>
                      </div>
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Summary badges */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">
                {inputs.locationType === 'nue' ? '📋 Location nue' : inputs.locationType === 'meublee' ? '🛋️ Location meublée' : '🏠 Colocation'}
              </Badge>
              <Badge variant="outline" className="text-xs">
                📅 Crédit sur {inputs.dureeCredit} ans
              </Badge>
              <Badge variant="outline" className="text-xs">
                📐 {inputs.surface} m²
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
