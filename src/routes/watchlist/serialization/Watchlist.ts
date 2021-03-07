import serializeWatchListItem from './WatchListItem'

// Types import
import { IWatchlist } from '_app/model/stoxy'

export default function serializeProfile(watchlist: IWatchlist): any {
  const { hasMore, totalCount } = watchlist

  let data = watchlist.data.map(item => serializeWatchListItem(item))

  return {
    _type: 'Watchlist',
    data
    // TODO - add pagination
    // hasMore,
    // totalCount
  }
}
