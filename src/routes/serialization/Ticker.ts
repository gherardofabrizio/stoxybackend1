import moment from 'moment'

import serializeStockMarket from './StockMarket'

// Types import
import { ITicker } from '_app/model/stoxy'

export default function serializeProfile(ticker: ITicker): any {
  if (!ticker.symbol) {
    throw new Error('Cannot serialize Ticker without symbol')
  }

  const {
    symbol,
    description,
    displaySymbol,
    stockMarketId,
    stockMarket,
    createdAt,
    updatedAt
  } = ticker

  return {
    _type: 'Ticker',
    id: symbol,
    symbol,
    description,
    displaySymbol,
    stockMarketId,
    stockMarket: stockMarket ? serializeStockMarket(stockMarket) : undefined,
    mic: stockMarketId,
    createdAt: createdAt ? createdAt.toISOString() : null,
    updatedAt: updatedAt ? updatedAt.toISOString() : null
  }
}
