/**
 * Variant: 'landing' | 'soft' | 'card'
 *  - landing: 3 large warm orbs across viewport (used on hero)
 *  - soft:    2 muted orbs (used on history/profile pages)
 *  - card:    2 stronger orbs (used on auth/onboarding/verified)
 */
export default function AmbientOrbs({ variant = 'soft' }) {
  return <div className={`ambient-orbs ambient-orbs--${variant}`} aria-hidden="true" />;
}
