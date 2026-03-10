import { useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/ModeToggle'
import { ArrowLeft, TrendingUp, Plus, Trash2, Wallet, BarChart3, PiggyBank } from 'lucide-react'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'

interface InvestmentLine {
  id: number
  name: string
  allocation: number
  tauxRendement: number
}

let nextId = 1

function createLine(name = '', allocation = 10000, tauxRendement = 7): InvestmentLine {
  return { id: nextId++, name, allocation, tauxRendement }
}

function calculateResults(montantInitial: number, lines: InvestmentLine[], dureeAns: number) {
  const totalAllocation = lines.reduce((sum, l) => sum + l.allocation, 0)

  // Weighted average annual return
  const tauxMoyen = totalAllocation > 0
    ? lines.reduce((sum, l) => sum + l.tauxRendement * l.allocation, 0) / totalAllocation
    : 0

  // Year-by-year evolution
  const evolutionData = []
  let valeurPortefeuille = montantInitial

  for (let annee = 0; annee <= dureeAns; annee++) {
    const totalInvestiCumul = montantInitial + totalAllocation * annee
    const plusValue = valeurPortefeuille - totalInvestiCumul

    evolutionData.push({
      annee,
      valeurPortefeuille: Math.round(valeurPortefeuille),
      totalInvesti: Math.round(totalInvestiCumul),
      plusValue: Math.round(plusValue),
    })

    if (annee < dureeAns) {
      // Apply annual return on the current portfolio value
      valeurPortefeuille = valeurPortefeuille * (1 + tauxMoyen / 100)
      // Add annual contributions
      valeurPortefeuille += totalAllocation
    }
  }

  const valeurFinale = evolutionData[evolutionData.length - 1].valeurPortefeuille
  const totalInvestiFinal = montantInitial + totalAllocation * dureeAns
  const plusValueTotale = valeurFinale - totalInvestiFinal
  const rendementTotal = totalInvestiFinal > 0 ? ((valeurFinale / totalInvestiFinal) - 1) * 100 : 0

  return {
    tauxMoyen,
    totalInvestiFinal,
    valeurFinale,
    plusValueTotale,
    rendementTotal,
    evolutionData,
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

export default function BoursePage() {
  const [montantInitial, setMontantInitial] = useState(10000)
  const [dureeAns, setDureeAns] = useState(20)
  const [lines, setLines] = useState<InvestmentLine[]>([
    createLine('ETF Monde', 5000, 8),
    createLine('Obligations', 2000, 3),
  ])

  const results = useMemo(() => calculateResults(montantInitial, lines, dureeAns), [montantInitial, lines, dureeAns])

  const addLine = useCallback(() => {
    setLines(prev => [...prev, createLine('', 1000, 7)])
  }, [])

  const removeLine = useCallback((id: number) => {
    setLines(prev => prev.filter(l => l.id !== id))
  }, [])

  const updateLine = useCallback((id: number, field: keyof Omit<InvestmentLine, 'id'>, value: string | number) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l))
  }, [])

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
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-sm">Simulateur Bourse</span>
            </div>
          </div>
          <ModeToggle />
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Left: Inputs */}
          <div className="space-y-6">
            {/* Paramètres généraux */}
            <Card className="border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <PiggyBank className="w-4 h-4 text-emerald-400" />
                  Paramètres généraux
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Montant initial (€)</Label>
                  <div className="relative flex items-center mt-1.5">
                    <Input
                      type="number"
                      value={montantInitial}
                      onChange={e => setMontantInitial(parseFloat(e.target.value) || 0)}
                      step={1000}
                      min={0}
                      className="pr-8 font-semibold h-11 text-lg"
                    />
                    <span className="absolute right-3 text-sm text-muted-foreground pointer-events-none">€</span>
                  </div>
                  <p className="text-xs text-muted-foreground/60 mt-1">Capital de départ pour votre investissement</p>
                </div>
                <Field
                  label="Durée d'investissement (ans)"
                  value={dureeAns}
                  onChange={setDureeAns}
                  suffix="ans"
                  min={1}
                  step={1}
                  hint={`Horizon de placement : ${dureeAns} an${dureeAns > 1 ? 's' : ''}`}
                />
              </CardContent>
            </Card>

            {/* Lignes d'investissement */}
            <Card className="border-border/50">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-400" />
                    Versements mensuels par ligne
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={addLine} className="h-8 text-xs gap-1">
                    <Plus className="w-3 h-3" />
                    Ajouter
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Ajoutez des lignes avec le montant mensuel et le taux de rendement annuel espéré</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {lines.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucune ligne d&apos;investissement. Cliquez sur &quot;Ajouter&quot; pour commencer.
                  </p>
                )}
                {lines.map((line) => (
                  <div key={line.id} className="border border-border/50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 mr-2">
                        <Label className="text-xs text-muted-foreground">Nom</Label>
                        <Input
                          type="text"
                          value={line.name}
                          onChange={e => updateLine(line.id, 'name', e.target.value)}
                          placeholder="Ex: ETF Monde"
                          className="text-sm h-9 mt-1"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLine(line.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-red-400 mt-4"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field
                        label="Versement mensuel (€)"
                        value={line.allocation}
                        onChange={v => updateLine(line.id, 'allocation', v)}
                        suffix="€/mois"
                        step={100}
                        min={0}
                      />
                      <Field
                        label="Rendement annuel (%)"
                        value={line.tauxRendement}
                        onChange={v => updateLine(line.id, 'tauxRendement', v)}
                        suffix="%"
                        step={0.5}
                        min={-100}
                      />
                    </div>
                  </div>
                ))}
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
                  title="Valeur finale"
                  value={formatEuro(results.valeurFinale)}
                  subtitle={`Après ${dureeAns} an${dureeAns > 1 ? 's' : ''}`}
                  icon={<TrendingUp className="w-4 h-4" />}
                  variant="positive"
                />
                <KPICard
                  title="Total investi"
                  value={formatEuro(results.totalInvestiFinal)}
                  subtitle={`Capital + versements`}
                  icon={<Wallet className="w-4 h-4" />}
                />
                <KPICard
                  title="Plus-value"
                  value={formatEuro(results.plusValueTotale)}
                  subtitle="Gains totaux"
                  icon={<BarChart3 className="w-4 h-4" />}
                  variant={results.plusValueTotale > 0 ? 'positive' : results.plusValueTotale === 0 ? 'default' : 'negative'}
                />
                <KPICard
                  title="Rendement total"
                  value={formatPercent(results.rendementTotal)}
                  subtitle={`Taux moyen pondéré : ${formatPercent(results.tauxMoyen)}/an`}
                  icon={<TrendingUp className="w-4 h-4" />}
                  variant={results.rendementTotal > 0 ? 'positive' : results.rendementTotal === 0 ? 'default' : 'negative'}
                />
              </div>
            </div>

            {/* Evolution chart */}
            <Card className="border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Évolution du portefeuille</CardTitle>
                <p className="text-xs text-muted-foreground">Valeur du portefeuille et montant total investi sur {dureeAns} ans</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={results.evolutionData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="annee" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `${v}a`} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} width={50} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
                      formatter={(value: number, name: string) => {
                        const labels: Record<string, string> = {
                          valeurPortefeuille: 'Valeur portefeuille',
                          totalInvesti: 'Total investi',
                        }
                        return [formatEuro(value), labels[name] || name]
                      }}
                      labelFormatter={(v) => `Année ${v}`}
                    />
                    <Area type="monotone" dataKey="valeurPortefeuille" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} strokeWidth={2} name="valeurPortefeuille" />
                    <Area type="monotone" dataKey="totalInvesti" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground))" fillOpacity={0.05} strokeWidth={2} strokeDasharray="4 4" name="totalInvesti" />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 mt-2 justify-center">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-4 h-0.5 bg-primary rounded" />
                    Valeur portefeuille
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-4 h-0.5 bg-muted-foreground rounded" />
                    Total investi
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Details */}
            <Card className="border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Détails par année</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left text-xs text-muted-foreground font-medium py-2 pr-4">Année</th>
                        <th className="text-right text-xs text-muted-foreground font-medium py-2 px-2">Investi</th>
                        <th className="text-right text-xs text-muted-foreground font-medium py-2 px-2">Valeur</th>
                        <th className="text-right text-xs text-muted-foreground font-medium py-2 pl-2">+/- Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.evolutionData.map(({ annee, valeurPortefeuille, totalInvesti, plusValue }) => (
                        <tr key={annee} className="border-b border-border/30 last:border-0">
                          <td className="py-2 pr-4 text-muted-foreground">{annee}</td>
                          <td className="py-2 px-2 text-right tabular-nums">{formatEuro(totalInvesti)}</td>
                          <td className="py-2 px-2 text-right tabular-nums font-medium">{formatEuro(valeurPortefeuille)}</td>
                          <td className={`py-2 pl-2 text-right tabular-nums ${plusValue >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {plusValue >= 0 ? '+' : ''}{formatEuro(plusValue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Summary badges */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">
                📊 {lines.length} ligne{lines.length > 1 ? 's' : ''} d&apos;investissement
              </Badge>
              <Badge variant="outline" className="text-xs">
                📅 Horizon {dureeAns} an{dureeAns > 1 ? 's' : ''}
              </Badge>
              <Badge variant="outline" className="text-xs">
                📈 Taux moyen {formatPercent(results.tauxMoyen)}/an
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
