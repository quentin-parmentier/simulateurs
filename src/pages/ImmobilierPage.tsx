import { useState, useMemo, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type LocationType = 'nue' | 'meublee' | 'colocation'

interface SimulatorInputs {
  prixBien: number
  surface: number
  travaux: number
  ameublement: number
  fraisNotaire: number
  apport: number
  tauxCredit: number
  dureeCredit: number
  loyerMensuel: number
  locationType: LocationType
  taxeFonciere: number
  chargesCopro: number
  chargesCoproRecup: number
  assurancePNO: number
  entretien: number
  vacanceLocative: number // en semaines
  fraisGestion: number // %
  assuranceEmprunteur: number
}

interface SimulatorResults {
  coutTotal: number
  mensualiteCredit: number
  chargesAnnuelles: number
  cashFlowBrut: number
  cashFlowNet: number
  amortissementBien: number
  amortissementMobilier: number
  baseImposableLMNP: number
  impots: number
}

function getDefaults(prix: number, type: LocationType = 'meublee'): SimulatorInputs {
  const surface = Math.round(prix / 2500)
  const fraisNotaire = Math.round(prix * 0.08)
  const travaux = 0
  const ameublement = type !== 'nue' ? 5000 : 0
  const coutTotal = prix + fraisNotaire + travaux + ameublement
  const apport = Math.round(coutTotal * 0.10)
  const tauxCredit = 4
  const dureeCredit = 20
  const assuranceEmprunteur = Math.round((coutTotal - apport) * 0.004 / 12) // 0,4% annuel / mois
  const loyerMensuel = type === 'colocation' ? 390 * 3 : Math.round((prix * 0.07) / 12)
  return {
    prixBien: prix,
    surface,
    travaux,
    ameublement,
    fraisNotaire,
    apport,
    tauxCredit,
    dureeCredit,
    loyerMensuel,
    locationType: type,
    taxeFonciere: Math.round(prix * 0.01), // 1% / an
    chargesCopro: 50,
    chargesCoproRecup: 100, // ex: chauffage, eau
    assurancePNO: 150,
    entretien: 500,
    vacanceLocative: 4, // 4 semaines / an
    fraisGestion: 0,
    assuranceEmprunteur,
  }
}

// Calcul des résultats détaillés
function calculateResults(inputs: SimulatorInputs): SimulatorResults {
  const coutTotal = inputs.prixBien + inputs.fraisNotaire + inputs.travaux + inputs.ameublement
  const capitalEmprunte = coutTotal - inputs.apport
  const mensualiteCredit = (() => {
    const r = inputs.tauxCredit / 100 / 12
    const n = inputs.dureeCredit * 12
    const mensualite = (capitalEmprunte * r) / (1 - Math.pow(1 + r, -n))
    return mensualite + inputs.assuranceEmprunteur
  })()

  // Charges annuelles
  const vacanceMensuelle = (inputs.loyerMensuel * 12 - (inputs.loyerMensuel / 52 * inputs.vacanceLocative)) // approx
  const chargesAnn = inputs.chargesCopro * 12 + inputs.taxeFonciere + inputs.assurancePNO + inputs.entretien + vacanceMensuelle + (inputs.loyerMensuel * inputs.fraisGestion / 100)
  const chargesAnnellesNonRecup = inputs.chargesCopro * 12 + inputs.taxeFonciere + inputs.assurancePNO + inputs.entretien

  // Amortissement
  const amortissementBien = inputs.prixBien * 0.015 / 12 // 1,5 %/an
  const amortissementMobilier = inputs.ameublement * 0.15 / 12 // 15 %/an

  // Cashflow brut = loyer - charges non récup
  const cashFlowBrut = inputs.loyerMensuel - (chargesAnnellesNonRecup / 12) - mensualiteCredit

  // Base imposable LMNP = (loyer - charges - amortissements)
  const baseImposableLMNP = inputs.loyerMensuel - (chargesAnnellesNonRecup / 12) - amortissementBien - amortissementMobilier

  // Impôt = 0 si base < 0
  const impots = baseImposableLMNP > 0 ? baseImposableLMNP * 0.3 : 0

  const cashFlowNet = cashFlowBrut - impots

  return {
    coutTotal,
    mensualiteCredit,
    chargesAnnuelles: chargesAnn,
    cashFlowBrut,
    cashFlowNet,
    amortissementBien,
    amortissementMobilier,
    baseImposableLMNP,
    impots,
  }
}

function Field({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="text-sm h-9"
      />
      {suffix && <span className="text-xs">{suffix}</span>}
    </div>
  )
}

export default function ImmobilierSimulator() {
  const [inputs, setInputs] = useState<SimulatorInputs>(() => getDefaults(150000, 'colocation'))
  const results = useMemo(() => calculateResults(inputs), [inputs])

  const updateField = useCallback((field: keyof SimulatorInputs) => (value: number) => {
    setInputs(prev => ({ ...prev, [field]: value }))
  }, [])

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Inputs projet</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Field label="Prix du bien" value={inputs.prixBien} onChange={updateField('prixBien')} suffix="€" />
          <Field label="Surface" value={inputs.surface} onChange={updateField('surface')} suffix="m²" />
          <Field label="Travaux" value={inputs.travaux} onChange={updateField('travaux')} suffix="€" />
          <Field label="Ameublement" value={inputs.ameublement} onChange={updateField('ameublement')} suffix="€" />
          <Field label="Frais de notaire" value={inputs.fraisNotaire} onChange={updateField('fraisNotaire')} suffix="€" />
          <Field label="Apport" value={inputs.apport} onChange={updateField('apport')} suffix="€" />
          <Field label="Taux crédit" value={inputs.tauxCredit} onChange={updateField('tauxCredit')} suffix="%" />
          <Field label="Durée crédit" value={inputs.dureeCredit} onChange={updateField('dureeCredit')} suffix="ans" />
          <Field label="Assurance emprunteur" value={inputs.assuranceEmprunteur} onChange={updateField('assuranceEmprunteur')} suffix="€/mois" />
          <Field label="Loyer mensuel" value={inputs.loyerMensuel} onChange={updateField('loyerMensuel')} suffix="€/mois" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Résultats détaillés</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p>Coût total projet : {results.coutTotal.toFixed(0)} €</p>
          <p>Mensualité crédit : {results.mensualiteCredit.toFixed(0)} €</p>
          <p>Charges annuelles non récupérables : {((inputs.chargesCopro * 12) + inputs.taxeFonciere + inputs.assurancePNO + inputs.entretien).toFixed(0)} €</p>
          <p>Amortissement bien : {results.amortissementBien.toFixed(0)} € / mois</p>
          <p>Amortissement mobilier : {results.amortissementMobilier.toFixed(0)} € / mois</p>
          <p>Cashflow brut (loyer - charges non récup - crédit) : {results.cashFlowBrut.toFixed(0)} € / mois</p>
          <p>Base imposable LMNP (cashflow fiscal) : {results.baseImposableLMNP.toFixed(0)} € / mois</p>
          <p>Impôt LMNP : {results.impots.toFixed(0)} € / mois</p>
          <p>Cashflow net : {results.cashFlowNet.toFixed(0)} € / mois</p>
        </CardContent>
      </Card>
    </div>
  )
}
