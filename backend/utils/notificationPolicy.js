const DEFAULTS = Object.freeze({push_orders:true,push_messages:true,push_payments:true,push_promos:false,email_orders:true,email_messages:false,email_payments:true,email_promos:false});
const category = type => /message|chat/.test(type) ? 'messages' : /payment|wallet|deposit|withdrawal|payout|refund|subscription/.test(type) ? 'payments' : /promo|vendor_update/.test(type) ? 'promos' : /order|logistics|p2p/.test(type) ? 'orders' : null;
const notificationChannels = (profile, type) => {
  const group = category(String(type || ''));
  const prefs = {...DEFAULTS,...profile?.notification_preferences};
  return {
    push: (!group || prefs['push_'+group] !== false) && (profile?.role !== 'manager' || profile.manager_settings?.notify_push !== false),
    email: (!group || prefs['email_'+group] !== false) && (profile?.role !== 'manager' || profile.manager_settings?.notify_email !== false),
  };
};
module.exports = { DEFAULTS, notificationChannels };
