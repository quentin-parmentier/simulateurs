export type LocationType = 'nue' | 'meublee' | 'colocation'

export interface SimulatorInputs {
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

export function calculateMensualite(capital: number, tauxAnnuel: number, dureeAns: number): number {
  if (capital <= 0 || tauxAnnuel <= 0 || dureeAns <= 0) return 0
  const t = tauxAnnuel / 100 / 12
  const n = dureeAns * 12
  return (capital * t) / (1 - Math.pow(1 + t, -n))
}

export function calculateResults(inputs: SimulatorInputs) {
  const { prixBien, fraisNotaire, travaux, ameublement, apport, tauxCredit, dureeCredit,
    assuranceEmprunteur, loyerMensuel, taxeFonciere, chargesCopro, assurancePNO,
    entretien, fraisGestion } = inputs

  // Clamp vacanceLocative to [0, 52] weeks
  const vacanceLocative = Math.min(Math.max(0, inputs.vacanceLocative), 52)

  const coutTotalProjet = prixBien + fraisNotaire + travaux + ameublement
  const montantEmprunte = Math.max(0, coutTotalProjet - apport)
  const mensualiteCredit = calculateMensualite(montantEmprunte, tauxCredit, dureeCredit)
  const totalInterets = mensualiteCredit * dureeCredit * 12 - montantEmprunte

  const loyerAnnuel = loyerMensuel * 12
  // Vacancy cost: rent lost for the weeks the property is empty
  // vacanceLocative weeks out of 52 weeks per year × annual rent
  const vacanceLocativeCout = loyerAnnuel * vacanceLocative / 52
  const fraisGestionCout = loyerAnnuel * fraisGestion / 100
  const chargesAnnuelles = taxeFonciere + chargesCopro * 12 + assurancePNO + entretien + vacanceLocativeCout + fraisGestionCout

  const rendementBrut = coutTotalProjet > 0 ? (loyerAnnuel / coutTotalProjet) * 100 : 0
  // Revenu net d'exploitation: rental income minus operating charges (before debt service)
  const revenuNetAnnuel = loyerAnnuel - chargesAnnuelles
  const rendementNet = coutTotalProjet > 0 ? (revenuNetAnnuel / coutTotalProjet) * 100 : 0

  // Cash-flow: what's left after paying the loan and all charges each month
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
