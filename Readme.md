# Stoxy

REST API for Stoxy application

## Run / Deploy scripts

For both deployment and local project running app uses [deplodockus](https://gitlab.f17y.com/deplodockus/deplodockus) scripts

Deployments scripts are situated in `./deploy` folder. Each ./deploy subfolder represents separate deployment target. Each target folder encrypted using **git-crypt** – except `_.local` template target

To get more information run ploy script at project root dir:

```
./ploy help
```

## Services used at application

- **Database**: MySQL 8 (AWS RDS)
- **Caching**: Redis (AWS ElastiCache)
- **File Storage**: AWS S3

## Local running

In order to run application locally you should:

1. Copy local target template `_.local`, and rename it to your own local target name. E.g `yourTarget.local`

2. Update settings at configuration file `./yourTarget.local/host-data/config.js`

   - Install locally MySQL

   - Setup database connections settings.

   - Update credentials for 3rd party services
     - AWS / S3
     - Firebase

3. Run ploy script at project root dir:

```
./ploy start yourTarget.local
```

## Production servers deployment

```
./ploy deploy prod
```
