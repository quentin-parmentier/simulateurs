import { describe, it, expect } from 'vitest'
import { calculateMensualite, calculateResults } from './immobilier'
import type { SimulatorInputs } from './immobilier'

const baseInputs: SimulatorInputs = {
  prixBien: 200000,
  surface: 50,
  fraisNotaire: 16000,
  travaux: 0,
  ameublement: 5000,
  apport: 22100,
  tauxCredit: 3.25,
  dureeCredit: 25,
  assuranceEmprunteur: 50,
  loyerMensuel: 1000,
  locationType: 'meublee',
  taxeFonciere: 1500,
  chargesCopro: 50,
  assurancePNO: 150,
  entretien: 500,
  vacanceLocative: 2,
  fraisGestion: 0,
}

describe('calculateMensualite', () => {
  it('retourne 0 si capital est 0', () => {
    expect(calculateMensualite(0, 3.25, 25)).toBe(0)
  })

  it('retourne 0 si taux est 0', () => {
    expect(calculateMensualite(100000, 0, 25)).toBe(0)
  })

  it('retourne 0 si durée est 0', () => {
    expect(calculateMensualite(100000, 3.25, 0)).toBe(0)
  })

  it('calcule correctement la mensualité', () => {
    // 100 000€ à 3.25% sur 25 ans
    const mensualite = calculateMensualite(100000, 3.25, 25)
    expect(mensualite).toBeCloseTo(487.32, 0)
  })
})

describe('calculateResults - vacance locative', () => {
  it('vacance 0 semaines : aucun coût de vacance', () => {
    const results = calculateResults({ ...baseInputs, vacanceLocative: 0 })
    // chargesAnnuelles = taxe + copro*12 + PNO + entretien + vacance + gestion
    // = 1500 + 600 + 150 + 500 + 0 + 0 = 2750
    expect(results.chargesAnnuelles).toBeCloseTo(2750, 0)
  })

  it('vacance 52 semaines : le coût de vacance égale le loyer annuel', () => {
    const loyerMensuel = baseInputs.loyerMensuel
    const loyerAnnuel = loyerMensuel * 12
    const results = calculateResults({ ...baseInputs, vacanceLocative: 52 })
    // chargesAnnuelles = 1500 + 600 + 150 + 500 + loyerAnnuel + 0
    const expected = 1500 + 600 + 150 + 500 + loyerAnnuel
    expect(results.chargesAnnuelles).toBeCloseTo(expected, 0)
  })

  it('vacance 26 semaines (6 mois) : le coût est la moitié du loyer annuel', () => {
    const loyerAnnuel = baseInputs.loyerMensuel * 12
    const results = calculateResults({ ...baseInputs, vacanceLocative: 26 })
    // vacanceLocativeCout = loyerAnnuel * 26 / 52 = loyerAnnuel / 2
    const expectedVacance = loyerAnnuel / 2
    const expectedCharges = 1500 + 600 + 150 + 500 + expectedVacance
    expect(results.chargesAnnuelles).toBeCloseTo(expectedCharges, 0)
  })

  it('vacance > 52 semaines est clampée à 52', () => {
    const r52 = calculateResults({ ...baseInputs, vacanceLocative: 52 })
    const r100 = calculateResults({ ...baseInputs, vacanceLocative: 100 })
    expect(r100.chargesAnnuelles).toBeCloseTo(r52.chargesAnnuelles, 0)
  })

  it('vacance négative est clampée à 0', () => {
    const r0 = calculateResults({ ...baseInputs, vacanceLocative: 0 })
    const rNeg = calculateResults({ ...baseInputs, vacanceLocative: -5 })
    expect(rNeg.chargesAnnuelles).toBeCloseTo(r0.chargesAnnuelles, 0)
  })
})

describe('calculateResults - cohérence revenuNet et cashFlow', () => {
  it('un cashFlow positif implique un revenu net positif', () => {
    // Avec un loyer très élevé par rapport aux charges et au crédit
    const inputs: SimulatorInputs = {
      ...baseInputs,
      loyerMensuel: 3000,
      vacanceLocative: 0,
    }
    const results = calculateResults(inputs)
    if (results.cashFlowMensuel > 0) {
      expect(results.revenuNetAnnuel).toBeGreaterThan(0)
    }
  })

  it('le revenu net annuel correspond au cash-flow mensuel × 12 plus les coûts du crédit', () => {
    const results = calculateResults(baseInputs)
    // revenuNetAnnuel = cashFlowMensuel * 12 + mensualiteCredit * 12 + assuranceEmprunteur * 12
    const creditAnnuel = (results.mensualiteCredit + baseInputs.assuranceEmprunteur) * 12
    expect(results.revenuNetAnnuel).toBeCloseTo(results.cashFlowMensuel * 12 + creditAnnuel, 0)
  })
})

describe('calculateResults - rendements', () => {
  it('le rendement brut est loyer annuel / coût total', () => {
    const results = calculateResults(baseInputs)
    const expected = (baseInputs.loyerMensuel * 12 / results.coutTotalProjet) * 100
    expect(results.rendementBrut).toBeCloseTo(expected, 5)
  })

  it('le rendement net est inférieur ou égal au rendement brut', () => {
    const results = calculateResults(baseInputs)
    expect(results.rendementNet).toBeLessThanOrEqual(results.rendementBrut)
  })

  it('le rendement net correspond au revenu net annuel / coût total', () => {
    const results = calculateResults(baseInputs)
    const expected = (results.revenuNetAnnuel / results.coutTotalProjet) * 100
    expect(results.rendementNet).toBeCloseTo(expected, 5)
  })

  it('le rendement net peut être positif même si le cash-flow est négatif (financement coûteux)', () => {
    // Standard property: positive NOI but credit costs make cash-flow negative
    const results = calculateResults(baseInputs)
    // revenuNetAnnuel > 0 (property earns more than charges)
    expect(results.revenuNetAnnuel).toBeGreaterThan(0)
    // rendementNet is based on NOI, so it should also be positive
    expect(results.rendementNet).toBeGreaterThan(0)
    // But cash-flow can still be negative due to credit costs
    // (this is the key difference vs the old cash-flow-based definition)
  })

  it('les frais de gestion sont calculés sur le loyer effectif (après vacance)', () => {
    const fraisGestion = 8
    const vacanceLocative = 4 // 4 semaines
    const loyerAnnuel = baseInputs.loyerMensuel * 12
    const vacanceLocativeCout = loyerAnnuel * vacanceLocative / 52
    const expectedFraisGestionCout = (loyerAnnuel - vacanceLocativeCout) * fraisGestion / 100
    const results = calculateResults({ ...baseInputs, fraisGestion, vacanceLocative })
    // chargesAnnuelles = taxe + copro*12 + PNO + entretien + vacance + fraisGestion
    const baseCharges = 1500 + 600 + 150 + 500
    const expectedCharges = baseCharges + vacanceLocativeCout + expectedFraisGestionCout
    expect(results.chargesAnnuelles).toBeCloseTo(expectedCharges, 1)
  })

  it('coût total = prix + notaire + travaux + ameublement', () => {
    const results = calculateResults(baseInputs)
    const expected = baseInputs.prixBien + baseInputs.fraisNotaire + baseInputs.travaux + baseInputs.ameublement
    expect(results.coutTotalProjet).toBe(expected)
  })
})

describe('calculateResults - financement', () => {
  it('montant emprunté = coût total - apport (minimum 0)', () => {
    const results = calculateResults(baseInputs)
    const expected = Math.max(0, results.coutTotalProjet - baseInputs.apport)
    expect(results.montantEmprunte).toBe(expected)
  })

  it('apport supérieur au coût total : montant emprunté = 0 et mensualité = 0', () => {
    const results = calculateResults({ ...baseInputs, apport: 999999 })
    expect(results.montantEmprunte).toBe(0)
    expect(results.mensualiteCredit).toBe(0)
  })

  it('effort épargne = 0 quand cash-flow positif', () => {
    const results = calculateResults({ ...baseInputs, loyerMensuel: 5000, vacanceLocative: 0 })
    expect(results.cashFlowMensuel).toBeGreaterThan(0)
    expect(results.effortEpargne).toBe(0)
  })

  it("effort épargne = -cashFlow quand cash-flow négatif", () => {
    const results = calculateResults({ ...baseInputs, loyerMensuel: 100 })
    expect(results.cashFlowMensuel).toBeLessThan(0)
    expect(results.effortEpargne).toBeCloseTo(-results.cashFlowMensuel, 5)
  })
})

describe('calculateResults - patrimoine', () => {
  it('le patrimoine initial (année 0) = prix - montant emprunté', () => {
    const results = calculateResults(baseInputs)
    const expected = baseInputs.prixBien - results.montantEmprunte
    expect(results.patrimoineData[0].patrimoineNet).toBe(expected)
  })

  it('le capital restant dû à la fin du crédit est 0', () => {
    const results = calculateResults(baseInputs)
    const dernierPoint = results.patrimoineData[baseInputs.dureeCredit]
    expect(dernierPoint.capitalRestantDu).toBeLessThanOrEqual(1) // close to 0 due to rounding
  })

  it('le patrimoine net augmente au fil du temps', () => {
    const results = calculateResults(baseInputs)
    expect(results.patrimoineData[10].patrimoineNet).toBeGreaterThan(results.patrimoineData[0].patrimoineNet)
    expect(results.patrimoineData[25].patrimoineNet).toBeGreaterThan(results.patrimoineData[10].patrimoineNet)
  })
})
