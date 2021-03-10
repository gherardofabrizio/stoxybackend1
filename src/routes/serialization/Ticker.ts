import moment from 'moment'

// Types import
import { ITicker } from '_app/model/stoxy'

export default function serializeProfile(ticker: ITicker): any {
  if (!ticker.symbol) {
    throw new Error('Cannot serialize Ticker without symbol')
  }

  const { symbol, description, displaySymbol, stockMarketId, createdAt, updatedAt } = ticker

  return {
    _type: 'Ticker',
    id: symbol,
    symbol,
    description,
    displaySymbol,
    stockMarketId,
    mic: stockMarketId,
    createdAt: createdAt ? createdAt.toISOString() : null,
    updatedAt: updatedAt ? updatedAt.toISOString() : null
  }
}
