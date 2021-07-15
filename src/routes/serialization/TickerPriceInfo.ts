// Types import
import { ITickerPriceInfo } from '_app/model/stoxy'

export default function serializeTickerPriceInfo(info: ITickerPriceInfo): any {
  const {
    tickerSymbol,
    openPrice,
    highPrice,
    lowPrice,
    currentPrice,
    previousClose,
    priceChange,
    pricePercentageChange,
    updatedAt
  } = info

  return {
    _type: 'TickerPriceInfo',
    tickerSymbol,
    openPrice,
    highPrice,
    lowPrice,
    currentPrice,
    previousClose,
    priceChange,
    pricePercentageChange,
    updatedAt: updatedAt ? updatedAt.toISOString() : null
  }
}
