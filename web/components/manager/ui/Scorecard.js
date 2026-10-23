import StatCard from '@/components/layout/StatCard';
const colors = { good: 'emerald', accent: 'primary', indigo: 'indigo', warn: 'amber', bad: 'rose' };
export default function Scorecard({ label, value, unit, icon, tone = 'accent', tag, delta, hint, progress }) {
  const change = delta?.text && delta.text !== '\u2014' ? delta.text : null;
  return <StatCard label={label} value={value} unit={unit} icon={icon} color={colors[tone] || 'primary'}
    sub={tag} progress={progress == null ? undefined : Math.min(1, Math.max(0, Number(progress) || 0)) * 100}
    footer={[change, hint].filter(Boolean).join(' \u00b7 ')} />;
}
