import redis, { RedisClient } from 'redis'
import moment from 'moment'

export interface KeyValueCacheConfig {
  redis: {
    url?: string
  }
}

export default class KeyValueCache {
  private config: KeyValueCacheConfig
  private client: RedisClient

  constructor(config: KeyValueCacheConfig) {
    this.config = config
    this.client = redis.createClient(this.config.redis)
  }

  async setValueForKey(value: any, key: string, expirationTime?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.set(key, value, error => {
        if (error) {
          reject(error)
        } else {
          if (expirationTime) {
            this.client.expire(key, expirationTime)
          }
          resolve()
        }
      })
    })
  }

  async getValueForKey(key: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.get(key, (error, value) => {
        if (error) {
          reject(error)
        } else {
          resolve(value)
        }
      })
    })
  }

  async deleteValueForKey(key: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.del(key, (error, value) => {
        if (error) {
          reject(error)
        } else {
          resolve(value)
        }
      })
    })
  }

  async addDatedValue(setId: string, value: any, date: Date) {
    return new Promise((resolve, reject) => {
      const timestamp = moment(date).format('X')

      let args = [timestamp, value]

      this.client.zadd(setId, args, (error, response) => {
        if (error) {
          reject(error)
        } else {
          resolve(response)
        }
      })
    })
  }

  async getDatedValues(
    setId: string,
    minDate: Date,
    maxDate: Date,
    limit: number
  ): Promise<Array<string>> {
    return new Promise((resolve, reject) => {
      const maxTimestamp = moment(maxDate).format('X')
      const minTimestamp = moment(minDate).format('X')

      this.client.zrangebyscore(
        setId,
        minTimestamp,
        maxTimestamp,
        'LIMIT',
        0,
        limit,
        (error, response) => {
          if (error) {
            reject(error)
          } else {
            resolve(response)
          }
        }
      )
    })
  }

  async removeDatedValues(setId: string, values: Array<string>) {
    return new Promise((resolve, reject) => {
      this.client.zrem(setId, values, (error, response) => {
        if (error) {
          reject(error)
        } else {
          resolve(response)
        }
      })
    })
  }
}
