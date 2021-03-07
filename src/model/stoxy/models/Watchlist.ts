import { WatchlistItemModel } from './WatchlistItem'

export interface Watchlist {
  data: Array<WatchlistItemModel>
  hasMore: boolean
  totalCount?: number
}
