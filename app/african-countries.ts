// List of 54 African countries with ISO codes
// Used for delivery agent assignment based on geographic zones

export interface AfricanCountry {
  code: string;
  name: string;
  nameFr: string;
}

export const AFRICAN_COUNTRIES: AfricanCountry[] = [
  { code: "DZ", name: "Algeria", nameFr: "Algérie" },
  { code: "AO", name: "Angola", nameFr: "Angola" },
  { code: "BJ", name: "Benin", nameFr: "Bénin" },
  { code: "BW", name: "Botswana", nameFr: "Botswana" },
  { code: "BF", name: "Burkina Faso", nameFr: "Burkina Faso" },
  { code: "BI", name: "Burundi", nameFr: "Burundi" },
  { code: "CV", name: "Cabo Verde", nameFr: "Cap-Vert" },
  { code: "CM", name: "Cameroon", nameFr: "Cameroun" },
  { code: "CF", name: "Central African Republic", nameFr: "République Centrafricaine" },
  { code: "TD", name: "Chad", nameFr: "Tchad" },
  { code: "KM", name: "Comoros", nameFr: "Comores" },
  { code: "CG", name: "Congo", nameFr: "Congo" },
  { code: "CD", name: "DR Congo", nameFr: "RD Congo" },
  { code: "CI", name: "Côte d'Ivoire", nameFr: "Côte d'Ivoire" },
  { code: "DJ", name: "Djibouti", nameFr: "Djibouti" },
  { code: "EG", name: "Egypt", nameFr: "Égypte" },
  { code: "GQ", name: "Equatorial Guinea", nameFr: "Guinée Équatoriale" },
  { code: "ER", name: "Eritrea", nameFr: "Érythrée" },
  { code: "SZ", name: "Eswatini", nameFr: "Eswatini" },
  { code: "ET", name: "Ethiopia", nameFr: "Éthiopie" },
  { code: "GA", name: "Gabon", nameFr: "Gabon" },
  { code: "GM", name: "Gambia", nameFr: "Gambie" },
  { code: "GH", name: "Ghana", nameFr: "Ghana" },
  { code: "GN", name: "Guinea", nameFr: "Guinée" },
  { code: "GW", name: "Guinea-Bissau", nameFr: "Guinée-Bissau" },
  { code: "KE", name: "Kenya", nameFr: "Kenya" },
  { code: "LS", name: "Lesotho", nameFr: "Lesotho" },
  { code: "LR", name: "Liberia", nameFr: "Libéria" },
  { code: "LY", name: "Libya", nameFr: "Libye" },
  { code: "MG", name: "Madagascar", nameFr: "Madagascar" },
  { code: "MW", name: "Malawi", nameFr: "Malawi" },
  { code: "ML", name: "Mali", nameFr: "Mali" },
  { code: "MR", name: "Mauritania", nameFr: "Mauritanie" },
  { code: "MU", name: "Mauritius", nameFr: "Maurice" },
  { code: "MA", name: "Morocco", nameFr: "Maroc" },
  { code: "MZ", name: "Mozambique", nameFr: "Mozambique" },
  { code: "NA", name: "Namibia", nameFr: "Namibie" },
  { code: "NE", name: "Niger", nameFr: "Niger" },
  { code: "NG", name: "Nigeria", nameFr: "Nigeria" },
  { code: "RW", name: "Rwanda", nameFr: "Rwanda" },
  { code: "ST", name: "São Tomé and Príncipe", nameFr: "Sao Tomé-et-Principe" },
  { code: "SN", name: "Senegal", nameFr: "Sénégal" },
  { code: "SC", name: "Seychelles", nameFr: "Seychelles" },
  { code: "SL", name: "Sierra Leone", nameFr: "Sierra Leone" },
  { code: "SO", name: "Somalia", nameFr: "Somalie" },
  { code: "ZA", name: "South Africa", nameFr: "Afrique du Sud" },
  { code: "SS", name: "South Sudan", nameFr: "Soudan du Sud" },
  { code: "SD", name: "Sudan", nameFr: "Soudan" },
  { code: "TZ", name: "Tanzania", nameFr: "Tanzanie" },
  { code: "TG", name: "Togo", nameFr: "Togo" },
  { code: "TN", name: "Tunisia", nameFr: "Tunisie" },
  { code: "UG", name: "Uganda", nameFr: "Ouganda" },
  { code: "ZM", name: "Zambia", nameFr: "Zambie" },
  { code: "ZW", name: "Zimbabwe", nameFr: "Zimbabwe" },
];

export const getCountryByCode = (code: string): AfricanCountry | undefined => {
  return AFRICAN_COUNTRIES.find((c) => c.code === code);
};

export const getCountryName = (code: string, lang: "fr" | "en" = "fr"): string => {
  const country = getCountryByCode(code);
  if (!country) return code;
  return lang === "fr" ? country.nameFr : country.name;
};
