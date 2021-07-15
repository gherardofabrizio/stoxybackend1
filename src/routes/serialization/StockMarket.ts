import moment from 'moment'

// Types import
import { IStockMarket } from '_app/model/stoxy'

export default function serializeProfile(market: IStockMarket): any {
  if (!market.mic) {
    throw new Error('Cannot serialize StockMarket without MIC')
  }

  const { mic, operatingMic, name, acronym, countryCode, website, createdAt, updatedAt } = market

  return {
    _type: 'StockMarket',
    id: mic,
    mic,
    operatingMic,
    name,
    acronym,
    countryCode,
    website,
    createdAt: createdAt ? createdAt.toISOString() : null,
    updatedAt: updatedAt ? updatedAt.toISOString() : null
  }
}
