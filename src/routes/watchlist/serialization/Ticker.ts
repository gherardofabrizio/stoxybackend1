import moment from 'moment'

// Types import
import { ITicker } from '_app/model/stoxy'

export default function serializeProfile(ticker: ITicker): any {
  if (!ticker.id) {
    throw new Error('Cannot serialize Ticker without id')
  }

  if (!ticker.symbol) {
    throw new Error('Cannot serialize Ticker without symbol')
  }

  const { symbol, description, displaySymbol, createdAt, updatedAt } = ticker

  return {
    _type: 'Ticker',
    id: symbol,
    symbol,
    description,
    displaySymbol,
    createdAt: createdAt ? createdAt.toISOString() : null,
    updatedAt: updatedAt ? updatedAt.toISOString() : null
  }
}
