
const parseNumber = (val) => {
  if (!val && val !== 0) return 0;
  
  let clean = String(val).trim().replace(/[$%\s]/g, '');
  if (!clean) return 0;

  const dots = (clean.match(/\./g) || []).length;
  const commas = (clean.match(/,/g) || []).length;
  
  if (dots > 1) return parseFloat(clean.replace(/\./g, ''));
  if (commas > 1) return parseFloat(clean.replace(/,/g, ''));
  
  if (dots === 1 && commas === 1) {
    const dotIdx = clean.indexOf('.');
    const commaIdx = clean.indexOf(',');
    if (dotIdx < commaIdx) {
      return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
    } else {
      return parseFloat(clean.replace(/,/g, ''));
    }
  }
  
  if (dots === 1) {
    const parts = clean.split('.');
    if (parts[1].length === 3) return parseFloat(clean.replace(/\./g, ''));
    return parseFloat(clean);
  }
  
  if (commas === 1) {
    const parts = clean.split(',');
    if (parts[1].length === 3) return parseFloat(clean.replace(/,/g, ''));
    return parseFloat(clean.replace(',', '.'));
  }

  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
};

console.log("Número nativo 2.602 ->", parseNumber(2.602)); // Simulando lo que envía GAS
console.log("String '2.602' ->", parseNumber("2.602"));
console.log("Legítimo decimal 2.5 ->", parseNumber(2.5));
console.log("Total (50 + 2.602) ->", parseNumber(50) + parseNumber(2.602));
