const payunitGateway = {
  id: 'payunit',
  label: 'PayUnit',
  description: 'Primary Cameroon payment gateway for MTN Mobile Money and Orange Money.',
  icon: 'phone',
  currencies: ['XAF'],
  regions: ['CM'],
  enabled: true,
  fields: [
    {
      name: 'phone',
      label: 'Mobile Money Number',
      type: 'tel',
      placeholder: '6XX XXX XXX',
      required: true,
    },
    {
      name: 'provider',
      label: 'Network',
      type: 'select',
      required: true,
      options: [
        { value: 'CM_MTNMOMO', label: 'MTN Mobile Money' },
        { value: 'CM_ORANGE', label: 'Orange Money' },
      ],
    },
  ],
};

module.exports = payunitGateway;
