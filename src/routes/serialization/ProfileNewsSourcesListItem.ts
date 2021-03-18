import moment from 'moment'

import serializeNewsSource from './NewsSource'

// Types import
import { IProfileNewsSourcesListItem } from '_app/model/stoxy'

export default function serializeProfileNewsSourcesListItem(
  newsListItem: IProfileNewsSourcesListItem
): any {
  const { newsSourceId, newsSource, profileId, createdAt, updatedAt } = newsListItem

  return {
    _type: 'ProfileNewsSourcesListItem',
    profileId: profileId!.toString(),
    newsSourceId: newsSourceId!.toString(),
    newsSource: newsSource ? serializeNewsSource(newsSource) : newsSourceId ? undefined : null,
    createdAt: createdAt ? createdAt.toISOString() : null,
    updatedAt: updatedAt ? updatedAt.toISOString() : null
  }
}
