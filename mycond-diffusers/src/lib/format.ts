export const uah = (n: number) =>
  new Intl.NumberFormat("uk-UA", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n) + " грн";

export const eur = (n: number) =>
  new Intl.NumberFormat("uk-UA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " €";

export const num = (n: number, d = 2) =>
  new Intl.NumberFormat("uk-UA", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
