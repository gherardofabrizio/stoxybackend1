import moment from 'moment'

import serializeNewsSource from './NewsSource'

// Types import
import { IProfileNewsSourcesListItem } from '_app/model/stoxy'

export default function serializeProfileNewsSourcesListItem(
  newsListItem: IProfileNewsSourcesListItem
): any {
  const { newsSourceId, newsSource, profileId, createdAt, updatedAt } = newsListItem

  const serializedNewsSource = newsSource
    ? serializeNewsSource(newsSource)
    : newsSourceId
    ? undefined
    : null
  if (serializedNewsSource && newsSource && !newsSource.isBuiltIn && newsListItem.title) {
    serializedNewsSource.title = newsListItem.title
  }

  return {
    _type: 'ProfileNewsSourcesListItem',
    profileId: profileId!.toString(),
    newsSourceId: newsSourceId!.toString(),
    newsSource: serializedNewsSource,
    createdAt: createdAt ? createdAt.toISOString() : null,
    updatedAt: updatedAt ? updatedAt.toISOString() : null
  }
}
