export interface TickerPriceInfo {
  tickerSymbol: string
  openPrice: number | null
  highPrice: number | null
  lowPrice: number | null
  currentPrice: number | null
  previousClose: number | null
  priceChange: number | null
  pricePercentageChange: number | null
  fetchedAt: Date | null
  updatedAt: Date
}
