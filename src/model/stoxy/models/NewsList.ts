import { INews } from '..'

export interface NewsList {
  data: Array<INews>
  hasMore: boolean
}
