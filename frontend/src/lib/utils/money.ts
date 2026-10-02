const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

/** "$34.00" — dollars, two decimals, as every amount in the product is shown. */
export function formatMoney(amount: number): string {
  return money.format(amount)
}
