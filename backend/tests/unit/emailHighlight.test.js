import { describe, it, expect } from 'vitest';
import templates from '../../utils/emailTemplates';

const { withNotificationHighlight, notificationSubject, orderNotificationFallback, wrap } = templates;

describe('notification email highlight', () => {
  it('puts the message in the inbox preview and a quoted block, with the sender in bold', () => {
    const { html } = orderNotificationFallback({ title: 'Order #AB12CD34', message: 'Amina: Is size 42 still available?' });
    const out = withNotificationHighlight(html, { message: 'Amina: Is size 42 still available?' });
    expect(out).not.toContain('<!--AURA_PREHEADER-->');
    expect(out).toMatch(/display:none[^>]*>Amina: Is size 42 still available\?/);
    expect(out).toContain('>Amina</p>');
    expect(out).toContain('>Is size 42 still available?</p>');
  });

  it('escapes user content so chat text cannot inject HTML', () => {
    const message = 'Eve: <img src=x onerror=alert(1)> <a href="https://evil">click</a>';
    const out = withNotificationHighlight(orderNotificationFallback({ title: 'Order #1', message }).html, { message });
    expect(out).not.toContain('<img src=x');
    expect(out).not.toContain('<a href="https://evil"');
    expect(out).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('does not repeat the message when the template already shows it', () => {
    const message = 'Shipment closed and settled.';
    const html = wrap('t', 'h', `<p>${message}</p>`);
    const out = withNotificationHighlight(html, { message });
    expect(out.split(message).length - 1).toBe(2); // preheader + existing paragraph, no extra block
  });

  it('builds a subject that carries the gist, trimmed to a sensible length', () => {
    expect(notificationSubject('Order #AB12CD34', 'Amina: Is size 42 still available?')).toBe('Order #AB12CD34 · Amina: Is size 42 still available?');
    expect(notificationSubject('Payment received', 'Payment received')).toBe('Payment received');
    const long = notificationSubject('Order #1', 'x'.repeat(300));
    expect(long.length).toBeLessThanOrEqual(110);
    expect(long.endsWith('…')).toBe(true);
  });
});
