import moment from 'moment'

// Types import
import { INewsSource } from '_app/model/stoxy'

export default function serializeNewsSource(news: INewsSource): any {
  if (!news.id) {
    throw new Error('Cannot serialize News Source without id')
  }

  const { id, title, siteURL, isBuiltIn, lastParsedAt, createdAt, updatedAt } = news

  return {
    _type: 'NewsSource',
    id: id.toString(),
    title,
    siteURL,
    isBuiltIn: isBuiltIn ? true : false,
    lastParsedAt: lastParsedAt ? lastParsedAt.toISOString() : null,
    createdAt: createdAt ? createdAt.toISOString() : null,
    updatedAt: updatedAt ? updatedAt.toISOString() : null
  }
}
