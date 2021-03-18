import serializeProfileNewsSourcesListItem from './ProfileNewsSourcesListItem'

// Types import
import { IProfileNewsSourcesList } from '_app/model/stoxy'

export default function serializeProfileNewsSourcesList(list: IProfileNewsSourcesList): any {
  let data = list.data.map(item => serializeProfileNewsSourcesListItem(item))

  return {
    _type: 'ProfileNewsSourcesList',
    data
  }
}
