import { Link } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ModeToggle } from '@/components/ModeToggle'
import { Building2, TrendingUp, ArrowRight } from 'lucide-react'

const simulators = [
  {
    id: 'immobilier',
    path: '/immobilier',
    icon: Building2,
    title: 'Rentabilité Immobilière',
    description: "Calculez la rentabilité de votre investissement locatif : rendement brut, net, cash-flow mensuel et effort d'épargne.",
    badge: 'Disponible',
    badgeVariant: 'default' as const,
    color: 'from-blue-500/20 to-indigo-500/20',
    iconColor: 'text-blue-400',
    disabled: false,
  },
  {
    id: 'bourse',
    path: '#',
    icon: TrendingUp,
    title: 'Simulateur Bourse',
    description: "Simulez l'évolution de votre portefeuille boursier avec différents scénarios de rendement.",
    badge: 'Bientôt',
    badgeVariant: 'secondary' as const,
    color: 'from-emerald-500/20 to-teal-500/20',
    iconColor: 'text-emerald-400',
    disabled: true,
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <span className="text-primary font-bold text-sm">S</span>
            </div>
            <span className="font-semibold text-lg">Simulateurs</span>
          </div>
          <ModeToggle />
        </div>
      </header>

      {/* Hero */}
      <main className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4 px-3 py-1 text-xs font-medium">
            Plateforme de simulation financière
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4 bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
            Simulateurs Financiers
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Des outils interactifs pour simuler et optimiser vos investissements financiers.
            Prenez des décisions éclairées avec des calculs précis.
          </p>
        </div>

        {/* Simulators Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {simulators.map((sim) => {
            const Icon = sim.icon
            const card = (
              <Card
                key={sim.id}
                className={`group relative overflow-hidden border border-border/50 transition-all duration-300 ${
                  sim.disabled
                    ? 'opacity-60 cursor-not-allowed'
                    : 'hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 cursor-pointer'
                }`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${sim.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                <CardHeader className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-background border border-border/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Icon className={`w-6 h-6 ${sim.iconColor}`} />
                    </div>
                    <Badge variant={sim.badgeVariant}>{sim.badge}</Badge>
                  </div>
                  <CardTitle className="text-xl">{sim.title}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {sim.description}
                  </CardDescription>
                </CardHeader>
                {!sim.disabled && (
                  <CardContent className="relative">
                    <div className="flex items-center text-sm text-primary font-medium gap-1 group-hover:gap-2 transition-all duration-200">
                      Accéder au simulateur
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </CardContent>
                )}
              </Card>
            )

            return sim.disabled ? (
              <div key={sim.id}>{card}</div>
            ) : (
              <Link key={sim.id} to={sim.path} className="block">
                {card}
              </Link>
            )
          })}
        </div>
      </main>
    </div>
  )
}
