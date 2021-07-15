import { INewsSource } from '..'

export interface NewsSourcesList {
  data: Array<INewsSource>
  hasMore: boolean
}
