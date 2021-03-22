/**
 * Config source: https://git.io/JesV9
 *
 * Feel free to let us know via PR, if you find something broken in this config
 * file.
 */

import Application from '@ioc:Adonis/Core/Application'
import Env from '@ioc:Adonis/Core/Env'
import { DatabaseConfig } from '@ioc:Adonis/Lucid/Database'
import { OrmConfig } from '@ioc:Adonis/Lucid/Orm'

const healthCheck = Env.get('DB_HEALTHCHECK', false)
const connection = Env.get('DB_CONNECTION', 'sqlite')

const databaseConfig: DatabaseConfig & { orm: Partial<OrmConfig> } = {
  /*
  |--------------------------------------------------------------------------
  | Connection
  |--------------------------------------------------------------------------
  |
  | The primary connection for making database queries across the application
  | You can use any key from the `connections` object defined in this same
  | file.
  |
  */
  connection,

  connections: {
    /*
    |--------------------------------------------------------------------------
    | Sqlite
    |--------------------------------------------------------------------------
    |
    | Configuration for the Sqlite database.  Make sure to install the driver
    | from npm when using this connection
    |
    | npm i sqlite3
    |
    */
    sqlite: {
      client: 'sqlite',
      connection: {
        filename: Application.tmpPath('db.sqlite3'),
      },
      useNullAsDefault: true,
      healthCheck: connection === 'sqlite' ? healthCheck : false,
      debug: false,
    },

    /*
    |--------------------------------------------------------------------------
    | Mysql config
    |--------------------------------------------------------------------------
    |
    | Configuration for Mysql database. Make sure to install the driver
    | from npm when using this connection
    |
    | npm i mysql
    |
    */
    mysql: {
      client: 'mysql',
      connection: {
        host: Env.get('DB_HOST', '127.0.0.1'),
        port: Number(Env.get('DB_PORT', 3306)),
        user: Env.get('DB_USER', 'lucid'),
        password: Env.get('DB_PASSWORD', 'lucid'),
        database: Env.get('DB_NAME', 'lucid'),
      },
      healthCheck: connection === 'mysql' ? healthCheck : false,
      debug: false,
    },

    /*
    |--------------------------------------------------------------------------
    | PostgreSQL config
    |--------------------------------------------------------------------------
    |
    | Configuration for PostgreSQL database. Make sure to install the driver
    | from npm when using this connection
    |
    | npm i pg
    |
    */
    pg: {
      client: 'pg',
      connection: {
        host: Env.get('DB_HOST', '127.0.0.1'),
        port: Env.get('DB_PORT', 5432),
        user: Env.get('DB_USER', 'lucid'),
        password: Env.get('DB_PASSWORD', 'lucid'),
        database: Env.get('DB_NAME', 'lucid'),
      },
      healthCheck: connection === 'pg' ? healthCheck : false,
      debug: false,
    },

    /*
    |--------------------------------------------------------------------------
    | OracleDB config
    |--------------------------------------------------------------------------
    |
    | Configuration for Oracle database. Make sure to install the driver
    | from npm when using this connection
    |
    | npm i oracledb
    |
    */
    oracle: {
      client: 'oracledb',
      connection: {
        host: Env.get('ORACLE_HOST'),
        port: Env.get('ORACLE_PORT'),
        user: Env.get('ORACLE_USER'),
        password: Env.get('ORACLE_PASSWORD', ''),
        database: Env.get('ORACLE_DB_NAME'),
      },
      healthCheck: connection === 'oracle' ? healthCheck : false,
      debug: false,
    },

    /*
    |--------------------------------------------------------------------------
    | MSSQL config
    |--------------------------------------------------------------------------
    |
    | Configuration for MSSQL database. Make sure to install the driver
    | from npm when using this connection
    |
    | npm i mssql
    |
    */
    mssql: {
      client: 'mssql',
      connection: {
        user: Env.get('MSSQL_USER'),
        port: Env.get('MSSQL_PORT'),
        server: Env.get('MSSQL_SERVER'),
        password: Env.get('MSSQL_PASSWORD', ''),
        database: Env.get('MSSQL_DB_NAME'),
      },
      healthCheck: connection === 'mssql' ? healthCheck : false,
      debug: false,
    },
  },

  /*
  |--------------------------------------------------------------------------
  | ORM Configuration
  |--------------------------------------------------------------------------
  |
  | Following are some of the configuration options to tweak the conventional
  | settings of the ORM. For example:
  |
  | - Define a custom function to compute the default table name for a given model.
  | - Or define a custom function to compute the primary key for a given model.
  |
  */
  orm: {},
}

export default databaseConfig
