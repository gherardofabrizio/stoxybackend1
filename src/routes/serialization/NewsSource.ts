import moment from 'moment'

// Types import
import { INewsSource } from '_app/model/stoxy'

export default function serializeNewsSource(news: INewsSource): any {
  if (!news.id) {
    throw new Error('Cannot serialize News Source without id')
  }

  const { id, title, siteURL, isDefault, lastParsedAt, createdAt, updatedAt } = news

  return {
    _type: 'NewsSource',
    id: id.toString(),
    title,
    siteURL,
    isDefault: isDefault ? true : false,
    lastParsedAt: lastParsedAt ? lastParsedAt.toISOString() : null,
    createdAt: createdAt ? createdAt.toISOString() : null,
    updatedAt: updatedAt ? updatedAt.toISOString() : null
  }
}
