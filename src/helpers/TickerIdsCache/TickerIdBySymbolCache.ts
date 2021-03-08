import LRU from 'lru-cache'

export default class TickerIdBySymbolCache {
  private cache = new LRU<string, number>(100000)

  setIdForSymbol(tickerId: number, tickerSymbol: string): void {
    this.cache.set(tickerSymbol, tickerId)
  }

  getIdForSymbol(tickerSymbol: string): number | undefined {
    return this.cache.get(tickerSymbol) || undefined
  }
}
