import moment from 'moment'

// Types import
import { IUser } from '@radx/radx-backend-auth'
import { IProfile, UserWithProfile } from '_app/model/stoxy'

export default function serializeProfile(profile: IProfile): any {
  if (!profile.id) {
    throw new Error('Cannot serialize Profile without id')
  }

  const { id, firstName, lastName, createdAt, updatedAt } = profile

  const formattedBirthday = profile.birthday ? moment(profile.birthday).format('YYYY-MM-DD') : null

  return {
    _type: 'Profile',
    id: id.toString(),
    firstName,
    lastName,
    birthday: formattedBirthday,
    createdAt: createdAt ? createdAt.toISOString() : null,
    updatedAt: updatedAt ? updatedAt.toISOString() : null
  }
}

export function serializeUserWithProfile(serializedUser: any, user: IUser & UserWithProfile) {
  if (user.profile) {
    serializedUser.profile = serializeProfile(user.profile)
  } else {
    serializedUser.profile = null
  }

  return serializedUser
}
