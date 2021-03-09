import serializeTicker from './Ticker'

// Types import
import { IWatchlistItem } from '_app/model/stoxy'

export default function serializeProfile(item: IWatchlistItem): any {
  if (!item.id) {
    throw new Error('Cannot serialize WatchlistItem without id')
  }

  const { ticker, isNotificationsEnabled, createdAt, updatedAt } = item
  const tickerId = ticker ? ticker.symbol : undefined

  return {
    _type: 'WatchlistItem',
    tickerId,
    ticker: ticker ? serializeTicker(ticker) : undefined,
    isNotificationsEnabled: isNotificationsEnabled ? true : false,
    createdAt: createdAt ? createdAt.toISOString() : null,
    updatedAt: updatedAt ? updatedAt.toISOString() : null
  }
}
