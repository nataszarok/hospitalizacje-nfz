import styles from "./Article.module.css";

export type PersonKind = "woman" | "man";

/**
 * Piktogram osoby w artykule (bez twarzy, DESIGN.md 8): sylwetka w kole, kobieta — dłuższe włosy, mężczyzna — krótkie.
 * `older`: siwe włosy i okulary. Ikona dekoracyjna (`aria-hidden`), imię i wiek są w tekście obok.
 */
export function PersonIcon({ kind, older = false, size = 48 }: { kind: PersonKind; older?: boolean; size?: number }) {
  const hair = older ? styles.personHairGray : styles.personHair;
  return <svg className={styles.person} width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false" data-person={kind}>
    <circle className={styles.personBg} cx="24" cy="24" r="24" />
    {kind === "woman" ? <path className={hair} d="M14 21a10 10 0 0 1 20 0v10H14z" /> : null}
    <path className={styles.personBody} d="M9 48c0-11 7-17 15-17s15 6 15 17z" />
    <circle className={styles.personBody} cx="24" cy="20" r="8" />
    {kind === "man" ? <path className={hair} d="M16 18.5a8 8 0 0 1 16 0c-3-2.5-13-2.5-16 0z" /> : <path className={hair} d="M16 18a8 8 0 0 1 16 0c-4-3.5-12-3.5-16 0z" />}
    {older ? <g className={styles.personGlasses}>
      <circle cx="20.5" cy="20.5" r="2.4" />
      <circle cx="27.5" cy="20.5" r="2.4" />
      <path d="M22.9 20.5h2.2" />
    </g> : null}
  </svg>;
}
