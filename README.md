# Simulateurs

Collection de simulateurs financiers interactifs déployés sur GitHub Pages.

🔗 **[Accéder aux simulateurs](https://quentin-parmentier.github.io/simulateurs/)**

## Simulateurs disponibles

- 🏠 **[Rentabilité Immobilière Locative](https://quentin-parmentier.github.io/simulateurs/immobilier)** — Calculez la rentabilité de votre investissement locatif : rendement brut/net, cash-flow mensuel, effort d'épargne, évolution du patrimoine.

## Stack technique

- **React 18** + **Vite** + **TypeScript**
- **Tailwind CSS** + **shadcn/ui** (design system)
- **React Router v6** (navigation multi-pages)
- **Recharts** (graphiques)
- **GitHub Pages** (hébergement statique)

## Développement local

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Déploiement

Le site est déployé automatiquement via GitHub Actions sur la branche `main`.

Workflow : `.github/workflows/deploy.yml`

## Architecture

```
src/
├── components/
│   ├── ui/           # Composants shadcn/ui
│   ├── ModeToggle    # Toggle dark/light mode
│   └── theme-provider
├── pages/
│   ├── HomePage      # Dashboard multi-simulateurs
│   └── ImmobilierPage # Simulateur immobilier locatif
└── lib/utils         # Utilitaires (cn)
```
