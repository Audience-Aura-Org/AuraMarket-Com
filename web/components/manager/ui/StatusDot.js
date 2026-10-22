/** Status dot. Colour is never the only signal: `label` is announced and shown on hover. */
export default function StatusDot({ status = 'neutral', label }) {
  return <span role="img" aria-label={label} title={label} className={`m-dot m-dot-${status}`} />;
}

export const HEALTH_LABEL = {
  urgent: 'Needs attention now',
  attention: 'Has open tasks',
  ok: 'On track',
};
