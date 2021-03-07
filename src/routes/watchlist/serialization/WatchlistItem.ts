import serializeTicker from './Ticker'

// Types import
import { IWatchlistItem } from '_app/model/stoxy'

export default function serializeProfile(item: IWatchlistItem): any {
  if (!item.id) {
    throw new Error('Cannot serialize WatchlistItem without id')
  }

  const { id, tickerId, ticker, isNotificationsEnabled, createdAt, updatedAt } = item

  return {
    _type: 'WatchlistItem',
    id: id.toString(),
    tickerId: ticker ? ticker.symbol : undefined,
    ticker: ticker ? serializeTicker(ticker) : undefined,
    isNotificationsEnabled: isNotificationsEnabled ? true : false,
    createdAt: createdAt ? createdAt.toISOString() : null,
    updatedAt: updatedAt ? updatedAt.toISOString() : null
  }
}
