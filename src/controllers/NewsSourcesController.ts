import moment from 'moment'
import request from 'request'
import xmlParser from 'fast-xml-parser'
import parseHTML from 'node-html-parser'

// Types imports
import { Transaction } from 'objection'
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { KnexModule } from '@radx/radx-backend-knex'
import {
  StoxyModelModule,
  INewsSourcesList,
  INewsSource,
  IProfileNewsSourcesList
} from '_app/model/stoxy'

export default class NewsSourcesController {
  private runner: ExpressRunnerModule
  private database: KnexModule
  private stoxyModel: StoxyModelModule

  constructor(runner: ExpressRunnerModule, database: KnexModule, stoxyModel: StoxyModelModule) {
    this.runner = runner
    this.database = database
    this.stoxyModel = stoxyModel
  }

  async getNewsSourcesBySearchQuery(
    searchQuery: string,
    fetchOnlyBuiltIn: boolean,
    trx?: Transaction
  ): Promise<INewsSourcesList> {
    const { NewsSource } = this.stoxyModel

    const list = await NewsSource.query(trx)
      .where(whereBuilder => {
        return whereBuilder
          .where('title', 'LIKE', '%' + searchQuery + '%')
          .orWhere('siteURL', 'LIKE', '%' + searchQuery + '%')
      })
      .andWhere(whereBuilder => {
        if (fetchOnlyBuiltIn) {
          return whereBuilder.andWhere({ isBuiltIn: true })
        }
      })
      .orderByRaw(
        `
        CASE
        WHEN title = :searchQuery THEN 1
        WHEN siteURL = :searchQuery THEN 2

        WHEN title LIKE :q2 THEN 3
        
        WHEN title LIKE :q3 THEN 4
        
        WHEN title LIKE :q1 THEN 5
        WHEN siteURL LIKE :q1 THEN 6

        ELSE 100 END,
        title ASC
      `,
        {
          searchQuery: searchQuery,
          q2: searchQuery + '%',
          q3: '%' + searchQuery,
          q1: '%' + searchQuery + '%'
        }
      )
      .limit(100)

    return {
      data: list,
      hasMore: false
    }
  }

  async getBuiltInNewsSourcesList(trx?: Transaction): Promise<INewsSourcesList> {
    const { NewsSource } = this.stoxyModel

    const list = await NewsSource.query(trx).where({ isBuiltIn: true }).orderBy('title', 'ASC')

    return {
      data: list,
      hasMore: false
    }
  }

  async getNewsSourcesListForProfile(
    profileId: number,
    trx?: Transaction
  ): Promise<IProfileNewsSourcesList> {
    const { ProfileNewsSourcesListItem } = this.stoxyModel

    const data = await ProfileNewsSourcesListItem.query(trx)
      .where({
        profileId
      })
      .withGraphFetched('newsSource')

    return {
      data,
      hasMore: false
    }
  }

  async initNewsSourcesListForProfile(profileId: number, trx?: Transaction) {
    const { knex } = this.database

    const atLeastOneNewsSource = await (trx || knex)
      .select('*')
      .from('profile_news_sources')
      .where({
        profileId
      })
      .first()
    // Add built in news sources if list is empty
    if (!atLeastOneNewsSource) {
      const list = await this.getBuiltInNewsSourcesList(trx)

      // Add to list
      await Promise.all(
        list.data.map(async newsSource => {
          await (trx || knex)
            .insert({
              newsSourceId: newsSource.id!,
              profileId
            })
            .into('profile_news_sources')
        })
      )
    }
  }

  async addNewsSourceToListForProfile(newsSourceId: number, profileId: number, trx?: Transaction) {
    const { ProfileNewsSourcesListItem } = this.stoxyModel

    // Check for duplicate
    const possibleDuplicate = await ProfileNewsSourcesListItem.query(trx)
      .where({
        profileId,
        newsSourceId
      })
      .withGraphFetched('newsSource')
      .first()
    if (possibleDuplicate) {
      return possibleDuplicate
    }

    // Add to list
    await ProfileNewsSourcesListItem.query(trx).insert({
      newsSourceId,
      profileId
    })

    return ProfileNewsSourcesListItem.query(trx)
      .where({
        profileId,
        newsSourceId
      })
      .withGraphFetched('newsSource')
      .first()
  }

  async removeNewsSourceFromListForProfile(
    newsSourceId: number,
    profileId: number,
    trx?: Transaction
  ) {
    const { ProfileNewsSourcesListItem } = this.stoxyModel
    const { errors } = this.runner

    await ProfileNewsSourcesListItem.query(trx).delete().where({
      newsSourceId,
      profileId
    })

    // Check for at least one news source at list
    const atLeastOneNewsSource = await ProfileNewsSourcesListItem.query(trx)
      .where({
        profileId
      })
      .first()
    if (!atLeastOneNewsSource) {
      const error = errors.create(
        `You need to have at least one news source at list`,
        'newsSourcesList/canNotBeEmpty',
        {},
        400
      )
      throw error
    }
  }

  private urlWithoutProtocol(siteURL: string) {
    let urlWithoutProtocol = siteURL.replace(/(^\w+:|^)\/\//, '')
    if (urlWithoutProtocol.charAt(urlWithoutProtocol.length - 1) === '/') {
      urlWithoutProtocol = urlWithoutProtocol.substring(0, urlWithoutProtocol.length - 1)
    }

    return urlWithoutProtocol
  }

  async addNewsSourceBySiteURL(rawSiteURL: string, trx?: Transaction): Promise<INewsSource> {
    const { NewsSource } = this.stoxyModel
    const { errors } = this.runner
    let siteURL = rawSiteURL.slice().trim() // copy original siteURL

    const siteURLWithoutProtocol = this.urlWithoutProtocol(siteURL)

    let duplicate: INewsSource | undefined
    const possibleDuplicates = await NewsSource.query(trx).where(
      'siteURL',
      'LIKE',
      `%${siteURLWithoutProtocol}%`
    )
    possibleDuplicates.forEach(newsSource => {
      if (
        newsSource.siteURL &&
        this.urlWithoutProtocol(newsSource.siteURL) === siteURLWithoutProtocol
      ) {
        duplicate = newsSource
        return
      }
    })
    if (duplicate) {
      return duplicate
    }

    if (siteURLWithoutProtocol === siteURL) {
      siteURL = 'https://' + siteURL
    }

    // Try to get RSS feed from provided siteURL
    try {
      let rssFeedURL: string | undefined
      let rssParsed = false
      let title = ''

      const siteRawSource: any = await new Promise<void>(async (resolve, reject) => {
        request.get(
          {
            url: siteURL
          },
          function (error, response, body) {
            if (error) {
              const formattedError = errors.create(
                `We cannot use ${rawSiteURL} as a news source. No response from the server.`,
                'customNewsSource/noResponse',
                {},
                400
              )
              reject(formattedError)
            } else {
              resolve(body)
            }
          }
        )
      })

      let siteParsedSource = parseHTML(siteRawSource, {
        lowerCaseTagName: true
      })

      if (siteParsedSource) {
        siteParsedSource.childNodes.forEach(htmlNode => {
          if ((htmlNode as any).rawTagName === 'html') {
            htmlNode.childNodes.forEach(headNode => {
              if ((headNode as any).rawTagName === 'head') {
                headNode.childNodes.forEach(linkNode => {
                  if (
                    // !rssFeedURL &&
                    (linkNode as any).rawTagName === 'link' &&
                    linkNode.toString().indexOf('application/rss+xml') >= 0
                  ) {
                    const regexp = /href=["']([^"']*)["']/g
                    const matches = regexp.exec(linkNode.toString())
                    rssFeedURL = matches && matches.length > 1 ? matches[1] : undefined
                  }

                  if ((linkNode as any).rawTagName === 'title') {
                    title = linkNode.text
                  }
                })
              }
            })
          }
        })
      }

      if (rssFeedURL) {
        const rssRaw: any = await new Promise<void>(async (resolve, reject) => {
          request.get(
            {
              url: rssFeedURL!
            },
            function (error, response, body) {
              if (error) {
                reject(error)
              } else {
                resolve(body)
              }
            }
          )
        })

        let rssObj = xmlParser.parse(rssRaw, {})

        const newsItems =
          rssObj['rss'] && rssObj['rss']['channel'] && rssObj['rss']['channel']['item']
            ? rssObj['rss']['channel']['item']
            : []

        rssParsed = newsItems.length > 0
      }

      if (rssParsed) {
        const addedNewsSource = await NewsSource.query(trx).insert({
          isBuiltIn: false,
          title,
          siteURL,
          rssFeedURL
        })

        return NewsSource.query(trx).where({ id: addedNewsSource.id! }).first()
      } else {
        const error = errors.create(
          `We cannot use ${rawSiteURL} as a news source. Website doesn’t provide RSS feed.`,
          'customNewsSource/rssNotFound',
          {},
          400
        )
        throw error
      }
    } catch (e) {
      throw e
    }
  }

  async batchUpdateNewsSourcesForProfile(
    profileId: number,
    newsSources: Array<{
      newsSourceId: number
    }>,
    trx?: Transaction
  ): Promise<IProfileNewsSourcesList> {
    const { errors } = this.runner
    const { ProfileNewsSourcesListItem } = this.stoxyModel

    // Check for at least one ticker at watchlist
    if (newsSources.length === 0) {
      const error = errors.create(
        `You need to have at least one news source at list`,
        'newsSourcesList/canNotBeEmpty',
        {},
        400
      )
      throw error
    }

    await ProfileNewsSourcesListItem.query(trx).delete().where({
      profileId
    })

    await Promise.all(
      newsSources.map(async newsSource => {
        await ProfileNewsSourcesListItem.query(trx).insert({
          profileId,
          newsSourceId: newsSource.newsSourceId
        })
      })
    )

    return this.getNewsSourcesListForProfile(profileId, trx)
  }
}
