// Types import
import { ISubscriptionInfo } from '_app/model/stoxy'
import { subscriptionStatusToString } from '../../model/stoxy/models/SubscriptionInfo'

export default function serializeSubscriptionInfo(info: ISubscriptionInfo): any {
  if (!info.id) {
    throw new Error('Cannot serialize SubscriptionInfo without id')
  }

  const { status, until } = info

  return {
    _type: 'SubscriptionInfo',
    status: subscriptionStatusToString(status),
    until: until ? until.toISOString() : null
  }
}
