import { Badge } from "@/components/ui/badge"

export default function HowItWorksPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Badge variant="outline" className="bg-muted/40 text-xs">
          Jak to funguje
        </Badge>
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
          Jednoduché hledání aut napříč českým internetem
        </h1>
        <p className="max-w-prose text-sm text-muted-foreground md:text-base">
          AutoTempest CZ nechce být další bazar. Je to tenká vrstva nad
          existujícími inzeráty, která vám ušetří čas a nervy.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-card/80 p-4 text-sm">
          <h2 className="mb-1 text-sm font-semibold">1. Zadáte jednoduché zadání</h2>
          <p className="text-muted-foreground">
            Na úvodní stránce vyberete značku, případně model, rozpočet a pár
            základních parametrů. Bez nutnosti registrace.
          </p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card/80 p-4 text-sm">
          <h2 className="mb-1 text-sm font-semibold">
            2. Prohledáme různé zdroje
          </h2>
          <p className="text-muted-foreground">
            V produkční verzi budeme napojeni na velké i menší české bazary a
            partnerské weby. Vše sjednotíme do jednoho čistého seznamu.
          </p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card/80 p-4 text-sm">
          <h2 className="mb-1 text-sm font-semibold">
            3. Inzerát otevřete u zdroje
          </h2>
          <p className="text-muted-foreground">
            Detail auta vždy otevřete přímo na původním webu. AutoTempest CZ
            slouží pouze jako chytrý vyhledávač a organizátor.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Proč je rozhraní tak jednoduché?</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          Cílem je, aby hledání auta připomínalo moderní SaaS nástroj, ne
          přeplácaný bazar. Minimum rušivých prvků, žádné blikající bannery, jen
          čistý seznam relevantních aut a pár chytrých filtrů.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Co přijde v dalších verzích?</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Napojení na reálné zdroje inzerce v ČR</li>
          <li>Pokročilé filtry (výbava, historie, karoserie, pohon)</li>
          <li>Chytré upozornění na nové inzeráty podle vašeho profilu</li>
          <li>Notifikace e-mailem nebo do prohlížeče</li>
        </ul>
      </section>
    </div>
  )
}

