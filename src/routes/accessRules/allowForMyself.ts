import { Request } from 'express'
import { AccessRule } from '@radx/radx-backend-auth'

const allowForMyself: AccessRule = {
  description: 'Allow for myself',
  priority: 'allow',
  condition: (req: Request) => req.user!.id!.toString() === req.params.profileId
}

export default allowForMyself
