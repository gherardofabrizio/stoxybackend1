import serializeNewsSource from './NewsSource'

// Types import
import { INewsSourcesList } from '_app/model/stoxy'

export default function serializeNewsSourcesList(newsSourcesList: INewsSourcesList): any {
  const { hasMore } = newsSourcesList

  let data = newsSourcesList.data.map(item => serializeNewsSource(item))

  return {
    _type: 'NewsSourcesList',
    data
    // hasMore
  }
}
