// Import models
import defineProfileModel, { ProfileModel } from './models/Profile'
import defineStockMarketModel, { StockMarketModel } from './models/StockMarket'
import defineTickerModel, { TickerModel } from './models/Ticker'
import defineWatchlistItemModel, { WatchlistItemModel } from './models/WatchlistItem'
import defineNewsSourceModel, { NewsSourceModel } from './models/NewsSource'
import defineNewsModel, { NewsModel } from './models/News'
import defineProfileNewsSourcesListItemModel, {
  ProfileNewsSourcesListItemModel
} from './models/ProfileNewsSourcesListItem'
import defineUserNotificationTopic, {
  UserNotificationTopicModel
} from './models/UserNotificationTopic'
import defineSubscriptionInfoModel, { SubscriptionInfoModel } from './models/SubscriptionInfo'

// Import migrations
import migration_0001_create_profiles from './migrations/0001_create_profiles'
import migration_0002_create_stock_markets from './migrations/0002_create_stock_markets'
import migration_0003_create_tickers from './migrations/0003_create_tickers'
import migration_0004_create_watchlist from './migrations/0004_create_watchlist'
import migration_0005_create_news_sources from './migrations/0005_create_news_sources'
import migration_0006_create_news from './migrations/0006_create_news'
import migration_0007_create_news_tickers from './migrations/0007_create_news_tickers'
import migration_0008_add_last_parsed_at_to_news_source from './migrations/0008_add_last_parsed_at_to_news_source'
import migration_0009_add_is_default_field_for_ticker from './migrations/0009_add_is_default_field_for_ticker'
import migration_0010_add_profile_news_sources from './migrations/0010_add_profile_news_sources'
import migration_0011_add_fulltext_index_for_news_sources from './migrations/0011_add_fulltext_index_for_news_sources'
import migration_0012_add_user_notification_topics from './migrations/0012_add_user_notification_topics'
import migration_0013_add_custom_title_for_news_source from './migrations/0013_add_custom_title_for_news_source'
import migration_0014_add_order_for_watchlist from './migrations/0014_add_order_for_watchlist'
import migration_0015_add_unique_key_at_watchlist from './migrations/0015_add_unique_key_at_watchlist'
import migration_0016_create_subscription_info from './migrations/0016_create_subscription_info'

// Type imports
import { Model } from 'objection'
import { KnexModule } from '@radx/radx-backend-knex'
import { AuthModule } from '@radx/radx-backend-auth'
import { ExpressRunnerModule } from '@radx/radx-backend-express'
import { Watchlist } from './models/Watchlist'
import { NewsList } from './models/NewsList'
import { NewsSourcesList } from './models/NewsSourcesList'
import { ProfileNewsSourcesList } from './models/ProfileNewsSourcesList'
import { TickerPriceInfo } from './models/TickerPriceInfo'

export interface UserWithProfile {
  profile?: IProfile
}

export interface StoxyModelConfig {}

export default function stoxyModelModule(
  runner: ExpressRunnerModule,
  database: KnexModule,
  auth: AuthModule,
  config: StoxyModelConfig
) {
  const Profile = defineProfileModel(runner, database.knex)

  const StockMarket = defineStockMarketModel(runner, database.knex)

  const Ticker = defineTickerModel(runner, database.knex, () => StockMarket)

  const WatchlistItem = defineWatchlistItemModel(runner, database.knex, () => Ticker)

  const NewsSource = defineNewsSourceModel(runner, database.knex)

  const ProfileNewsSourcesListItem = defineProfileNewsSourcesListItemModel(
    runner,
    database.knex,
    () => NewsSource
  )

  const News = defineNewsModel(
    runner,
    database.knex,
    () => NewsSource,
    () => Ticker
  )

  const UserNotificationTopic = defineUserNotificationTopic(runner, database.knex)

  const SubscriptionInfo = defineSubscriptionInfoModel(runner, database.knex)

  const migrations: any = {
    migration_0001_create_profiles,
    migration_0002_create_stock_markets,
    migration_0003_create_tickers,
    migration_0004_create_watchlist,
    migration_0005_create_news_sources,
    migration_0006_create_news,
    migration_0007_create_news_tickers,
    migration_0008_add_last_parsed_at_to_news_source,
    migration_0009_add_is_default_field_for_ticker,
    migration_0010_add_profile_news_sources,
    migration_0011_add_fulltext_index_for_news_sources,
    migration_0012_add_user_notification_topics,
    migration_0013_add_custom_title_for_news_source,
    migration_0014_add_order_for_watchlist,
    migration_0015_add_unique_key_at_watchlist,
    migration_0016_create_subscription_info
  }

  const migrationConfig = {
    tableName: 'knex_migrations_stoxy',
    migrationSource: {
      getMigrations: async () => Object.keys(migrations).sort(),
      getMigrationName: (migration: string) => migration,
      getMigration: (name: string) => migrations[name]
    }
  }
  database.registerMigration(
    {
      name: 'stoxy',
      version: 1,
      dependencies: [{ name: 'auth' }]
    },
    migrationConfig
  )

  // Install hooks

  auth.model.hooks.afterUserModelInitialized(User => {
    Object.assign(User.relationMappings, {
      profile: {
        relation: Model.HasOneRelation,
        modelClass: Profile,
        join: {
          from: 'users.id',
          to: 'profiles.id'
        }
      }
    })
  })

  auth.model.hooks.onDefaultUserFetchIncludes(includes => {
    Object.assign(includes.relationExpression, {
      profile: true
    })
    return includes
  })

  auth.model.hooks.onDefaultSessionFetchIncludes(includes => {
    const relationExpression = includes.relationExpression as any
    if (relationExpression.user === true) {
      relationExpression.user = {}
    }

    Object.assign(relationExpression.user, {
      profile: true
    })
    return includes
  })

  return {
    Profile,
    StockMarket,
    Ticker,
    WatchlistItem,
    NewsSource,
    ProfileNewsSourcesListItem,
    News,
    UserNotificationTopic,
    SubscriptionInfo
  }
}

export type IProfile = ProfileModel
export type IStockMarket = StockMarketModel
export type ITicker = TickerModel
export type IWatchlistItem = WatchlistItemModel
export type IWatchlist = Watchlist
export type INewsList = NewsList
export type INewsSource = NewsSourceModel
export type INewsSourcesList = NewsSourcesList
export type IProfileNewsSourcesListItem = ProfileNewsSourcesListItemModel
export type IProfileNewsSourcesList = ProfileNewsSourcesList
export type INews = NewsModel
export type ITickerPriceInfo = TickerPriceInfo
export type IUserNotificationTopic = UserNotificationTopicModel
export type ISubscriptionInfo = SubscriptionInfoModel

export type StoxyModelModule = ReturnType<typeof stoxyModelModule>
