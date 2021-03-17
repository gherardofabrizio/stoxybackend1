import moment from 'moment'
import request from 'request'
import xmlParser from 'fast-xml-parser'
import parseHTML from 'node-html-parser'

// Types imports
import { Transaction } from 'objection'
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { KnexModule } from '@radx/radx-backend-knex'
import { INews, StoxyModelModule } from '_app/model/stoxy'
import { INewsSourcesList, INewsSource } from '_app/model/stoxy'

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
    trx?: Transaction
  ): Promise<INewsSourcesList> {
    const { NewsSource } = this.stoxyModel

    const list = await NewsSource.query(trx)
      .where('title', 'LIKE', '%' + searchQuery + '%')
      .orWhere('siteURL', 'LIKE', '%' + searchQuery + '%')
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
  ): Promise<INewsSourcesList> {
    const { NewsSource } = this.stoxyModel

    const data = await NewsSource.query(trx)
      .joinRaw(
        ' INNER JOIN `profile_news_sources` ON `profile_news_sources`.`newsSourceId` = `news_sources`.`id` '
      )
      .orderBy('title', 'ASC')

    return {
      data,
      hasMore: false
    }
  }

  async addNewsSourceToListForProfile(newsSourceId: number, profileId: number, trx?: Transaction) {
    const { knex } = this.database

    // Check for duplicate
    const possibleDuplicate = await (trx || knex)
      .select('*')
      .from('profile_news_sources')
      .where({
        newsSourceId,
        profileId
      })
      .first()
    if (possibleDuplicate) {
      return
    }

    // Add to list
    await (trx || knex)
      .insert({
        newsSourceId,
        profileId
      })
      .into('profile_news_sources')
  }

  async removeNewsSourceFromListForProfile(
    newsSourceId: number,
    profileId: number,
    trx?: Transaction
  ) {
    const { knex } = this.database
    const { errors } = this.runner

    await (trx || knex)
      .delete()
      .where({
        newsSourceId,
        profileId
      })
      .into('profile_news_sources')

    // Check for at least one news source at list
    const atLeastOneNewsSource = await (trx || knex)
      .select('*')
      .from('profile_news_sources')
      .where({
        newsSourceId,
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

  async addNewsSourceBySiteURL(siteURL: string, trx?: Transaction): Promise<INewsSource> {
    const { NewsSource } = this.stoxyModel
    const { errors } = this.runner

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
              reject(error)
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
          `Valid RSS Feed not found`,
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
}
