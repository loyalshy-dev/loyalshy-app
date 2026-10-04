import Link from "next/link"
import { Photo } from "./photo"

// Doors to other pages: a picture, a title, one line. The whole card is
// the link; the title underlines on hover like any other link.

export type LinkCard = { href: string; title: string; lead: string; photo: string; alt: string }

export function LinkCards({ cards }: { cards: LinkCard[] }) {
  return (
    <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3" role="list">
      {cards.map((card) => (
        <li key={card.href}>
          <Link href={card.href} className="group block focus-visible:outline-none">
            <Photo id={card.photo} alt={card.alt} ratio="4/3" sizes="(min-width: 1024px) 30vw, (min-width: 640px) 48vw, 100vw" />
            <h3 className="mk-title-4 mt-4 underline-offset-4 group-hover:underline group-focus-visible:underline" style={{ color: "var(--mk-text)" }}>
              {card.title}
            </h3>
            <p className="mk-body-sm mt-1 max-w-[40ch]" style={{ color: "var(--mk-text-muted)" }}>
              {card.lead}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  )
}
