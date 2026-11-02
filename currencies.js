// currencies.js: country and currency choices for customer accounts

// [Country, ISO currency code]
const COUNTRY_CURRENCIES = [
  ["Afghanistan", "AFN"], ["Albania", "ALL"], ["Algeria", "DZD"], ["Angola", "AOA"],
  ["Argentina", "ARS"], ["Armenia", "AMD"], ["Australia", "AUD"], ["Austria", "EUR"],
  ["Azerbaijan", "AZN"], ["Bahamas", "BSD"], ["Bahrain", "BHD"], ["Bangladesh", "BDT"],
  ["Barbados", "BBD"], ["Belarus", "BYN"], ["Belgium", "EUR"], ["Benin", "XOF"],
  ["Bolivia", "BOB"], ["Bosnia and Herzegovina", "BAM"], ["Botswana", "BWP"], ["Brazil", "BRL"],
  ["Brunei", "BND"], ["Bulgaria", "BGN"], ["Burkina Faso", "XOF"], ["Cambodia", "KHR"],
  ["Cameroon", "XAF"], ["Canada", "CAD"], ["Chad", "XAF"], ["Chile", "CLP"],
  ["China", "CNY"], ["Colombia", "COP"], ["Congo", "XAF"], ["Costa Rica", "CRC"],
  ["Croatia", "EUR"], ["Cuba", "CUP"], ["Cyprus", "EUR"], ["Czech Republic", "CZK"],
  ["Denmark", "DKK"], ["Dominican Republic", "DOP"], ["Ecuador", "USD"], ["Egypt", "EGP"],
  ["El Salvador", "USD"], ["Estonia", "EUR"], ["Ethiopia", "ETB"], ["Fiji", "FJD"],
  ["Finland", "EUR"], ["France", "EUR"], ["Gabon", "XAF"], ["Gambia", "GMD"],
  ["Georgia", "GEL"], ["Germany", "EUR"], ["Ghana", "GHS"], ["Greece", "EUR"],
  ["Guatemala", "GTQ"], ["Guinea", "GNF"], ["Haiti", "HTG"], ["Honduras", "HNL"],
  ["Hong Kong", "HKD"], ["Hungary", "HUF"], ["Iceland", "ISK"], ["India", "INR"],
  ["Indonesia", "IDR"], ["Iran", "IRR"], ["Iraq", "IQD"], ["Ireland", "EUR"],
  ["Israel", "ILS"], ["Italy", "EUR"], ["Ivory Coast", "XOF"], ["Jamaica", "JMD"],
  ["Japan", "JPY"], ["Jordan", "JOD"], ["Kazakhstan", "KZT"], ["Kenya", "KES"],
  ["Kuwait", "KWD"], ["Laos", "LAK"], ["Latvia", "EUR"], ["Lebanon", "LBP"],
  ["Liberia", "LRD"], ["Lithuania", "EUR"], ["Luxembourg", "EUR"], ["Madagascar", "MGA"],
  ["Malawi", "MWK"], ["Malaysia", "MYR"], ["Mali", "XOF"], ["Malta", "EUR"],
  ["Mauritius", "MUR"], ["Mexico", "MXN"], ["Moldova", "MDL"], ["Mongolia", "MNT"],
  ["Morocco", "MAD"], ["Mozambique", "MZN"], ["Myanmar", "MMK"], ["Namibia", "NAD"],
  ["Nepal", "NPR"], ["Netherlands", "EUR"], ["New Zealand", "NZD"], ["Nicaragua", "NIO"],
  ["Niger", "XOF"], ["Nigeria", "NGN"], ["North Macedonia", "MKD"], ["Norway", "NOK"],
  ["Oman", "OMR"], ["Pakistan", "PKR"], ["Panama", "PAB"], ["Papua New Guinea", "PGK"],
  ["Paraguay", "PYG"], ["Peru", "PEN"], ["Philippines", "PHP"], ["Poland", "PLN"],
  ["Portugal", "EUR"], ["Qatar", "QAR"], ["Romania", "RON"], ["Russia", "RUB"],
  ["Rwanda", "RWF"], ["Saudi Arabia", "SAR"], ["Senegal", "XOF"], ["Serbia", "RSD"],
  ["Sierra Leone", "SLE"], ["Singapore", "SGD"], ["Slovakia", "EUR"], ["Slovenia", "EUR"],
  ["South Africa", "ZAR"], ["South Korea", "KRW"], ["Spain", "EUR"], ["Sri Lanka", "LKR"],
  ["Sweden", "SEK"], ["Switzerland", "CHF"], ["Taiwan", "TWD"], ["Tanzania", "TZS"],
  ["Thailand", "THB"], ["Togo", "XOF"], ["Trinidad and Tobago", "TTD"], ["Tunisia", "TND"],
  ["Turkey", "TRY"], ["Uganda", "UGX"], ["Ukraine", "UAH"], ["United Arab Emirates", "AED"],
  ["United Kingdom", "GBP"], ["United States", "USD"], ["Uruguay", "UYU"], ["Uzbekistan", "UZS"],
  ["Venezuela", "VES"], ["Vietnam", "VND"], ["Zambia", "ZMW"], ["Zimbabwe", "ZWL"]
];

// Format an amount in a currency code, e.g. formatMoney(120, "NGN") → ₦120.00
export function formatMoney(amount, code = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code || "USD" })
      .format(Number(amount || 0));
  } catch (error) {
    // Unknown code: show the number with the code after it
    return `${Number(amount || 0).toFixed(2)} ${code}`;
  }
}

// Fills a <select> with every country (sorted), showing its currency
export function populateCurrencySelect(select, selectedCode = "USD") {

  const sorted = [...COUNTRY_CURRENCIES].sort((a, b) => a[0].localeCompare(b[0]));

  select.innerHTML = sorted
    .map(([country, code]) =>
      `<option value="${code}" ${code === selectedCode ? "selected" : ""}>${country} · ${code}</option>`)
    .join("");

  // Make sure a code that isn't in the list still shows
  if (selectedCode && !sorted.some(([, code]) => code === selectedCode)) {
    select.insertAdjacentHTML("afterbegin",
      `<option value="${selectedCode}" selected>${selectedCode}</option>`);
  }

}
