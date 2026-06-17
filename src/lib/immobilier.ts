export type LocationType = 'nue' | 'meublee' | 'colocation'
export type RegimeFiscal = 'lmnp_reel' | 'micro_bic' | 'reel_foncier' | 'micro_foncier'

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
  chargesCoproRecup: number
  assurancePNO: number
  entretien: number
  vacanceLocative: number
  fraisGestion: number
  regimeFiscal: RegimeFiscal
  tmi: number
}

export function calculateMensualite(capital: number, tauxAnnuel: number, dureeAns: number): number {
  if (capital <= 0 || dureeAns <= 0) return 0
  if (tauxAnnuel <= 0) return capital / (dureeAns * 12)
  const t = tauxAnnuel / 100 / 12
  const n = dureeAns * 12
  return (capital * t) / (1 - Math.pow(1 + t, -n))
}

export interface TimelinePoint {
  annee: number
  patrimoineNet: number
  capitalRestantDu: number
  cashFlowCumulNet: number
  remboursementsCumules: number
  gainNetAnnuel: number
  gainNetCumulTotal: number
}

export function calculateResults(inputs: SimulatorInputs) {
  const {
    prixBien, fraisNotaire, travaux, ameublement, apport,
    tauxCredit, dureeCredit, assuranceEmprunteur, loyerMensuel,
    taxeFonciere, chargesCopro, assurancePNO, entretien,
    fraisGestion, regimeFiscal, tmi,
  } = inputs

  // Clamp vacanceLocative to [0, 52] weeks
  const vacanceLocative = Math.min(Math.max(0, inputs.vacanceLocative), 52)

  const coutTotalProjet = prixBien + fraisNotaire + travaux + ameublement
  const capitalEmprunte = Math.max(0, coutTotalProjet - apport)

  // Monthly loan payment (principal + interest)
  const mensualiteHorsAssurance = calculateMensualite(capitalEmprunte, tauxCredit, dureeCredit)
  const mensualiteCredit = capitalEmprunte > 0 ? mensualiteHorsAssurance + assuranceEmprunteur : 0
  const totalInterets = mensualiteHorsAssurance * dureeCredit * 12 - capitalEmprunte

  // Vacancy cost
  const loyerAnnuel = loyerMensuel * 12
  const vacanceLocativeCout = loyerAnnuel * vacanceLocative / 52
  const loyerCollecte = loyerAnnuel - vacanceLocativeCout
  const fraisGestionCout = loyerCollecte * fraisGestion / 100

  // Annual non-recoverable charges
  const chargesAnnuelles = taxeFonciere + chargesCopro * 12 + assurancePNO + entretien + vacanceLocativeCout + fraisGestionCout
  const chargesNonRecupMensuel = chargesAnnuelles / 12

  // Depreciation (LMNP réel only)
  const amortissementBienAnnuel = prixBien * 0.015
  const amortissementMobilierAnnuel = ameublement * 0.15

  // Taxable income per regime
  let baseImposableAnnuelle = 0
  let abattement = 0
  let explicTax = ''

  if (regimeFiscal === 'lmnp_reel') {
    baseImposableAnnuelle = Math.max(0, loyerAnnuel - chargesAnnuelles - amortissementBienAnnuel - amortissementMobilierAnnuel)
    explicTax = 'Loyers − charges réelles − amortissements (bien + mobilier)'
  } else if (regimeFiscal === 'micro_bic') {
    abattement = loyerAnnuel * 0.50
    baseImposableAnnuelle = loyerAnnuel * 0.50
    explicTax = 'Abattement forfaitaire de 50 % sur les loyers bruts'
  } else if (regimeFiscal === 'reel_foncier') {
    baseImposableAnnuelle = Math.max(0, loyerAnnuel - chargesAnnuelles)
    explicTax = "Loyers − charges réelles (pas d'amortissement en location nue)"
  } else {
    // micro_foncier
    abattement = loyerAnnuel * 0.30
    baseImposableAnnuelle = loyerAnnuel * 0.70
    explicTax = 'Abattement forfaitaire de 30 % sur les loyers bruts'
  }

  // Tax = TMI + social contributions (17.2 %)
  const tauxEffectif = tmi / 100 + 0.172
  const impotsAnnuels = baseImposableAnnuelle * tauxEffectif
  const impotsMensuels = impotsAnnuels / 12

  // Cash-flow brut: rent − charges − loan payment (before tax)
  const cashFlowBrut = loyerMensuel - chargesNonRecupMensuel - mensualiteCredit
  // Cash-flow net: after tax
  const cashFlowNet = cashFlowBrut - impotsMensuels
  const effortEpargne = Math.max(0, -cashFlowNet)

  // Yields
  const rendementBrut = coutTotalProjet > 0 ? (loyerAnnuel / coutTotalProjet) * 100 : 0
  const revenuNetAnnuel = loyerAnnuel - chargesAnnuelles
  const rendementNet = coutTotalProjet > 0 ? (revenuNetAnnuel / coutTotalProjet) * 100 : 0

  const prixAuM2 = inputs.surface > 0 ? prixBien / inputs.surface : 0

  // Cash-flow net after loan (no credit payment, still have charges + tax)
  const cashFlowNetApresCredit = loyerMensuel - chargesNonRecupMensuel - impotsMensuels

  // Monthly cost breakdown
  const coutsMensuels = {
    credit: Math.round(mensualiteCredit * 10) / 10,
    taxeFonciere: Math.round(taxeFonciere / 12 * 10) / 10,
    chargesCopro: chargesCopro,
    assurancePNO: Math.round(assurancePNO / 12 * 10) / 10,
    entretien: Math.round(entretien / 12 * 10) / 10,
    vacance: Math.round(vacanceLocativeCout / 12 * 10) / 10,
    fraisGestion: Math.round(fraisGestionCout / 12 * 10) / 10,
    impots: Math.round(impotsMensuels * 10) / 10,
  }

  // Extended timeline: loan duration + 10 years after
  const anneesApresCredit = 10
  const dureeEffective = capitalEmprunte > 0 ? dureeCredit : 0
  const totalAnnees = dureeEffective + anneesApresCredit
  const timelineData: TimelinePoint[] = []
  let capitalRestantDu = capitalEmprunte
  const tMensuel = tauxCredit / 100 / 12
  let cashFlowCumulNet = 0
  let remboursementsCumules = 0
  let gainNetCumulTotal = -apport

  for (let annee = 0; annee <= totalAnnees; annee++) {
    // Apply epsilon: treat near-zero capital as fully repaid
    if (capitalRestantDu < 1e-6) capitalRestantDu = 0
    const pendantCredit = annee < dureeEffective && capitalRestantDu > 0
    const creditMensuel = pendantCredit ? mensualiteCredit : 0
    const gainNetMensuel = pendantCredit ? cashFlowNet : cashFlowNetApresCredit
    const gainNetAnnuel = gainNetMensuel * 12

    timelineData.push({
      annee,
      patrimoineNet: Math.round(prixBien - capitalRestantDu),
      capitalRestantDu: Math.round(capitalRestantDu),
      cashFlowCumulNet: Math.round(cashFlowCumulNet),
      remboursementsCumules: Math.round(remboursementsCumules),
      gainNetAnnuel: Math.round(gainNetAnnuel),
      gainNetCumulTotal: Math.round(gainNetCumulTotal),
    })

    if (annee < totalAnnees) {
      cashFlowCumulNet += gainNetAnnuel
      gainNetCumulTotal += gainNetAnnuel
      remboursementsCumules += creditMensuel * 12

      // Amortize capital for loan years
      if (pendantCredit && annee < dureeEffective) {
        for (let mois = 0; mois < 12; mois++) {
          if (capitalRestantDu <= 0) break
          const interets = capitalRestantDu * tMensuel
          const remboursementCapital = mensualiteHorsAssurance - interets
          capitalRestantDu = Math.max(0, capitalRestantDu - remboursementCapital)
        }
      }
    }
  }

  return {
    coutTotalProjet,
    capitalEmprunte,
    mensualiteCredit,
    mensualiteHorsAssurance,
    totalInterets,
    chargesAnnuelles,
    chargesNonRecupMensuel,
    revenuNetAnnuel,
    rendementBrut,
    rendementNet,
    cashFlowBrut,
    cashFlowNet,
    cashFlowNetApresCredit,
    effortEpargne,
    prixAuM2,
    baseImposableAnnuelle,
    baseImposableMensuelle: baseImposableAnnuelle / 12,
    amortissementBienAnnuel,
    amortissementMobilierAnnuel,
    impotsAnnuels,
    impotsMensuels,
    abattement,
    explicTax,
    tauxEffectif: tauxEffectif * 100,
    loyerBrut: loyerAnnuel,
    coutsMensuels,
    timelineData,
    dureeEffective,
  }
}
