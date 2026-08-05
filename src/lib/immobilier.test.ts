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
  chargesCoproRecup: 100,
  assurancePNO: 150,
  entretien: 500,
  vacanceLocative: 2,
  fraisGestion: 0,
  regimeFiscal: 'lmnp_reel',
  tmi: 30,
}

describe('calculateMensualite', () => {
  it('retourne 0 si capital est 0', () => {
    expect(calculateMensualite(0, 3.25, 25)).toBe(0)
  })

  it('retourne capital / (durée × 12) si taux est 0', () => {
    expect(calculateMensualite(100000, 0, 25)).toBeCloseTo(100000 / (25 * 12), 2)
  })

  it('retourne 0 si durée est 0', () => {
    expect(calculateMensualite(100000, 3.25, 0)).toBe(0)
  })

  it('calcule correctement la mensualité', () => {
    const mensualite = calculateMensualite(100000, 3.25, 25)
    expect(mensualite).toBeCloseTo(487.32, 0)
  })
})

describe('calculateResults - vacance locative', () => {
  it('vacance 0 semaines : aucun coût de vacance', () => {
    const results = calculateResults({ ...baseInputs, vacanceLocative: 0 })
    expect(results.chargesAnnuelles).toBeCloseTo(2750, 0)
  })

  it('vacance 52 semaines : le coût de vacance égale le loyer annuel', () => {
    const loyerAnnuel = baseInputs.loyerMensuel * 12
    const results = calculateResults({ ...baseInputs, vacanceLocative: 52 })
    const expected = 1500 + 600 + 150 + 500 + loyerAnnuel
    expect(results.chargesAnnuelles).toBeCloseTo(expected, 0)
  })

  it('vacance 26 semaines (6 mois) : le coût est la moitié du loyer annuel', () => {
    const loyerAnnuel = baseInputs.loyerMensuel * 12
    const results = calculateResults({ ...baseInputs, vacanceLocative: 26 })
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

describe('calculateResults - fiscalité', () => {
  it('LMNP réel : base imposable = loyers - charges - intérêts d\'emprunt - amortissements', () => {
    const results = calculateResults({ ...baseInputs, regimeFiscal: 'lmnp_reel' })
    const loyerAnnuel = baseInputs.loyerMensuel * 12
    const amortBien = baseInputs.prixBien * 0.015
    const amortMobilier = baseInputs.ameublement * 0.15
    const expected = Math.max(0, loyerAnnuel - results.chargesAnnuelles - results.interetsAnnuels - amortBien - amortMobilier)
    expect(results.baseImposableAnnuelle).toBeCloseTo(expected, 1)
  })

  it('Micro-BIC : base imposable = 50% des loyers', () => {
    const results = calculateResults({ ...baseInputs, regimeFiscal: 'micro_bic' })
    const expected = baseInputs.loyerMensuel * 12 * 0.50
    expect(results.baseImposableAnnuelle).toBeCloseTo(expected, 1)
  })

  it('Réel foncier : base imposable = loyers - charges - intérêts d\'emprunt (pas d\'amortissement)', () => {
    const results = calculateResults({ ...baseInputs, regimeFiscal: 'reel_foncier', locationType: 'nue', ameublement: 0 })
    const loyerAnnuel = baseInputs.loyerMensuel * 12
    const expected = Math.max(0, loyerAnnuel - results.chargesAnnuelles - results.interetsAnnuels)
    expect(results.baseImposableAnnuelle).toBeCloseTo(expected, 1)
  })

  it('Micro-foncier : base imposable = 70% des loyers', () => {
    const results = calculateResults({ ...baseInputs, regimeFiscal: 'micro_foncier', locationType: 'nue' })
    const expected = baseInputs.loyerMensuel * 12 * 0.70
    expect(results.baseImposableAnnuelle).toBeCloseTo(expected, 1)
  })

  it('impôts = base imposable × (TMI + 17.2%)', () => {
    const results = calculateResults(baseInputs)
    const tauxEffectif = baseInputs.tmi / 100 + 0.172
    const expected = results.baseImposableAnnuelle * tauxEffectif
    expect(results.impotsAnnuels).toBeCloseTo(expected, 1)
  })

  it('TMI 0% : seuls les prélèvements sociaux s\'appliquent', () => {
    const results = calculateResults({ ...baseInputs, tmi: 0 })
    const expected = results.baseImposableAnnuelle * 0.172
    expect(results.impotsAnnuels).toBeCloseTo(expected, 1)
  })
})

describe('calculateResults - cash-flow', () => {
  it('cash-flow brut = loyer - charges mensuelles - crédit', () => {
    const results = calculateResults(baseInputs)
    const expected = baseInputs.loyerMensuel - results.chargesNonRecupMensuel - results.mensualiteCredit
    expect(results.cashFlowBrut).toBeCloseTo(expected, 2)
  })

  it('cash-flow net = cash-flow brut - impôts mensuels', () => {
    const results = calculateResults(baseInputs)
    const expected = results.cashFlowBrut - results.impotsMensuels
    expect(results.cashFlowNet).toBeCloseTo(expected, 2)
  })

  it('cash-flow après crédit est supérieur au cash-flow pendant le crédit', () => {
    const results = calculateResults(baseInputs)
    expect(results.cashFlowNetApresCredit).toBeGreaterThan(results.cashFlowNet)
  })

  it('effort épargne = 0 quand cash-flow net positif', () => {
    const results = calculateResults({ ...baseInputs, loyerMensuel: 5000, vacanceLocative: 0 })
    expect(results.cashFlowNet).toBeGreaterThan(0)
    expect(results.effortEpargne).toBe(0)
  })

  it("effort épargne = -cashFlowNet quand cash-flow net négatif", () => {
    const results = calculateResults({ ...baseInputs, loyerMensuel: 100 })
    expect(results.cashFlowNet).toBeLessThan(0)
    expect(results.effortEpargne).toBeCloseTo(-results.cashFlowNet, 5)
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

  it('les frais de gestion sont calculés sur le loyer effectif (après vacance)', () => {
    const fraisGestion = 8
    const vacanceLocative = 4
    const loyerAnnuel = baseInputs.loyerMensuel * 12
    const vacanceLocativeCout = loyerAnnuel * vacanceLocative / 52
    const expectedFraisGestionCout = (loyerAnnuel - vacanceLocativeCout) * fraisGestion / 100
    const results = calculateResults({ ...baseInputs, fraisGestion, vacanceLocative })
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
  it('capital emprunté = coût total - apport (minimum 0)', () => {
    const results = calculateResults(baseInputs)
    const expected = Math.max(0, results.coutTotalProjet - baseInputs.apport)
    expect(results.capitalEmprunte).toBe(expected)
  })

  it('apport supérieur au coût total : capital emprunté = 0, mensualité = 0 (pas d\'assurance sans crédit)', () => {
    const results = calculateResults({ ...baseInputs, apport: 999999 })
    expect(results.capitalEmprunte).toBe(0)
    expect(results.mensualiteHorsAssurance).toBe(0)
    expect(results.mensualiteCredit).toBe(0)
  })
})

describe('calculateResults - timeline étendue', () => {
  it('la timeline contient toujours 35 ans de données', () => {
    const results = calculateResults(baseInputs)
    expect(results.timelineData.length).toBe(35 + 1)
  })

  it('sans crédit : la timeline contient toujours 35 ans de données', () => {
    const results = calculateResults({ ...baseInputs, apport: 999999 })
    expect(results.dureeEffective).toBe(0)
    expect(results.timelineData.length).toBe(35 + 1)
  })

  it('le capital restant dû à la fin du crédit est proche de 0', () => {
    const results = calculateResults(baseInputs)
    const pointFinCredit = results.timelineData[baseInputs.dureeCredit]
    expect(pointFinCredit.capitalRestantDu).toBeLessThanOrEqual(1)
  })

  it('le patrimoine net augmente au fil du temps', () => {
    const results = calculateResults(baseInputs)
    expect(results.timelineData[10].patrimoineNet).toBeGreaterThan(results.timelineData[0].patrimoineNet)
    expect(results.timelineData[25].patrimoineNet).toBeGreaterThan(results.timelineData[10].patrimoineNet)
  })

  it('le gain net annuel après crédit est supérieur à pendant le crédit', () => {
    const results = calculateResults(baseInputs)
    const gainPendantCredit = results.timelineData[1].gainNetAnnuel
    const gainApresCredit = results.timelineData[baseInputs.dureeCredit + 1].gainNetAnnuel
    expect(gainApresCredit).toBeGreaterThan(gainPendantCredit)
  })

  it('le cash-flow cumulé net croît dans les années après le crédit', () => {
    const results = calculateResults(baseInputs)
    const idx = baseInputs.dureeCredit + 5
    expect(results.timelineData[idx].cashFlowCumulNet).toBeGreaterThan(
      results.timelineData[baseInputs.dureeCredit].cashFlowCumulNet
    )
  })

  it('le coût du crédit cumulé reste stable après la fin du crédit', () => {
    const results = calculateResults(baseInputs)
    const coutFinCredit = results.timelineData[baseInputs.dureeCredit].remboursementsCumules
    const coutApres = results.timelineData[baseInputs.dureeCredit + 5].remboursementsCumules
    expect(coutApres).toBe(coutFinCredit)
  })

  it('gainNetCumulTotal démarre à -apport à l\'année 0', () => {
    const results = calculateResults(baseInputs)
    expect(results.timelineData[0].gainNetCumulTotal).toBe(-baseInputs.apport)
  })

  it('gainNetCumulTotal croît au fil du temps (cashFlow positif)', () => {
    const results = calculateResults({ ...baseInputs, loyerMensuel: 5000, vacanceLocative: 0 })
    const t0 = results.timelineData[0].gainNetCumulTotal
    const t10 = results.timelineData[10].gainNetCumulTotal
    expect(t10).toBeGreaterThan(t0)
  })

  it('gainNetCumulTotal = cashFlowCumulNet - apport', () => {
    const results = calculateResults(baseInputs)
    for (const point of results.timelineData) {
      expect(point.gainNetCumulTotal).toBeCloseTo(point.cashFlowCumulNet - baseInputs.apport, 0)
    }
  })

  it('aucune année post-crédit n\'est traitée comme pendant crédit malgré un résidu flottant', () => {
    // Use parameters that are likely to produce a floating-point residue
    const inputs: SimulatorInputs = {
      ...baseInputs,
      prixBien: 150000,
      fraisNotaire: 12000,
      travaux: 3000,
      ameublement: 2000,
      apport: 17000,
      tauxCredit: 2.75,
      dureeCredit: 20,
    }
    const results = calculateResults(inputs)
    const duree = inputs.dureeCredit

    // After dureeCredit, remboursementsCumules should not increase
    for (let i = duree + 1; i < results.timelineData.length; i++) {
      expect(results.timelineData[i].remboursementsCumules).toBe(
        results.timelineData[duree].remboursementsCumules
      )
    }

    // capitalRestantDu should be exactly 0 at dureeCredit
    expect(results.timelineData[duree].capitalRestantDu).toBe(0)
  })
})
