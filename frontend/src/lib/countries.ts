export const COUNTRY_CODES = [
  { code: '+1', label: 'US/CA (+1)', placeholder: '(234) 567-8900' },
  { code: '+44', label: 'UK (+44)', placeholder: '7400 123456' },
  { code: '+61', label: 'AU (+61)', placeholder: '400 123 456' },
  { code: '+91', label: 'IN (+91)', placeholder: '98765 43210' },
  { code: '+86', label: 'CN (+86)', placeholder: '139 1234 5678' },
  { code: '+81', label: 'JP (+81)', placeholder: '90 1234 5678' },
  { code: '+49', label: 'DE (+49)', placeholder: '151 23456789' },
  { code: '+33', label: 'FR (+33)', placeholder: '6 12 34 56 78' },
  { code: '+39', label: 'IT (+39)', placeholder: '312 345 6789' },
  { code: '+7', label: 'RU (+7)', placeholder: '912 345-67-89' },
  { code: '+55', label: 'BR (+55)', placeholder: '11 91234-5678' },
  { code: '+52', label: 'MX (+52)', placeholder: '55 1234 5678' },
  { code: '+34', label: 'ES (+34)', placeholder: '612 345 678' },
  { code: '+62', label: 'ID (+62)', placeholder: '812 3456 7890' },
  { code: '+90', label: 'TR (+90)', placeholder: '501 234 56 78' },
  { code: '+82', label: 'KR (+82)', placeholder: '10-1234-5678' },
  { code: '+63', label: 'PH (+63)', placeholder: '912 345 6789' },
  { code: '+84', label: 'VN (+84)', placeholder: '912 345 678' },
  { code: '+66', label: 'TH (+66)', placeholder: '81 234 5678' },
  { code: '+27', label: 'ZA (+27)', placeholder: '60 123 4567' },
  { code: '+234', label: 'NG (+234)', placeholder: '801 234 5678' },
  { code: '+20', label: 'EG (+20)', placeholder: '100 123 4567' },
  { code: '+92', label: 'PK (+92)', placeholder: '300 1234567' },
  { code: '+65', label: 'SG (+65)', placeholder: '8123 4567' },
  { code: '+64', label: 'NZ (+64)', placeholder: '21 123 4567' },
  { code: '+971', label: 'AE (+971)', placeholder: '50 123 4567' },
];

export const getPlaceholderForCountryCode = (code: string) => {
  const match = COUNTRY_CODES.find(c => c.code === code);
  return match ? match.placeholder : '234 567 8900';
};
