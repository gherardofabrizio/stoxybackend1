import serializeNews from './News'

// Types import
import { INewsList } from '_app/model/stoxy'

export default function serializeNewsList(newsList: INewsList): any {
  const { hasMore } = newsList

  let data = newsList.data.map(item => serializeNews(item))

  return {
    _type: 'NewsList',
    data,
    hasMore
  }
}
