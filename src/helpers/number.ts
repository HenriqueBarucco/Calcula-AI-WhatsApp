export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function parseCurrencyToNumber(raw: string): number | undefined {
  if (!raw) return undefined
  let value = raw.trim()
  value = value.replace(/[R$\s]/gi, '')
  if (value.includes(',') && value.includes('.')) {
    value = value.replace(/\./g, '').replace(',', '.')
  } else if (value.includes(',')) {
    value = value.replace(',', '.')
  }
  const cleaned = value.replace(/[^0-9.-]/g, '')
  const num = parseFloat(cleaned)
  if (Number.isNaN(num)) return undefined
  return num
}

export function parseInteger(raw: string): number | undefined {
  const cleaned = raw.replace(/[^0-9-]/g, '')
  if (!cleaned) return undefined
  const num = parseInt(cleaned, 10)
  if (Number.isNaN(num)) return undefined
  return num
}
