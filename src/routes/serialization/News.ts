import moment from 'moment'

import serializeTicker from './Ticker'
import serializeNewsSource from './NewsSource'

// Types import
import { INews } from '_app/model/stoxy'

export default function serializeNews(news: INews): any {
  if (!news.id) {
    throw new Error('Cannot serialize News without id')
  }

  const {
    id,
    newsSourceId,
    newsSource,
    publicationDate,
    title,
    description,
    link,
    tickers,
    createdAt,
    updatedAt
  } = news

  return {
    _type: 'News',
    id: id.toString(),
    newsSource: newsSourceId ? (newsSource ? serializeNewsSource(newsSource) : undefined) : null,
    publicationDate: publicationDate ? publicationDate.toISOString() : null,
    title,
    description,
    link,
    tickers: tickers!.map(ticker => serializeTicker(ticker)),
    createdAt: createdAt ? createdAt.toISOString() : null,
    updatedAt: updatedAt ? updatedAt.toISOString() : null
  }
}
