import moment from 'moment'

import serializeTicker from './Ticker'

// Types import
import { INews } from '_app/model/stoxy'

export default function serializeNews(news: INews): any {
  if (!news.id) {
    throw new Error('Cannot serialize News without id')
  }

  const {
    id,
    publicationDate,
    title,
    description,
    link,
    tickers,
    notificationsWasSent,
    createdAt,
    updatedAt
  } = news

  return {
    _type: 'News',
    id: id.toString(),
    publicationDate: publicationDate ? publicationDate.toISOString() : null,
    title,
    description,
    link,
    tickers,
    notificationsWasSent: notificationsWasSent ? true : false,
    createdAt: createdAt ? createdAt.toISOString() : null,
    updatedAt: updatedAt ? updatedAt.toISOString() : null
  }
}
