const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')
const mkdirp = require('mkdirp')
const appRoot = require('app-root-path').path

const dbFile = path.resolve(appRoot, './data/sqlite3.db')

let instance = null

/**
 * Class to control database-connections
 *
 * @returns {DB}
 * @constructor
 */
function DB (options = {}) {
  if (!(this instanceof DB)) {
    instance = instance || new DB(...arguments)
    return instance
  }
  this.options = Object.assign({
    path: dbFile,
    migrate: true,
    memory: false,
    readonly: false,
    fileMustExist: false,
    WAL: true
  }, options)
  // use memory when path is the string ':memory:'
  this.options.memory = options.memory === undefined ? options.path === ':memory:' : options.memory
  Object.defineProperty(this, 'open', { get: function () { return this.connection().open } })
  Object.defineProperty(this, 'inTransaction', { get: function () { return this.connection().inTransaction } })
  Object.defineProperty(this, 'name', { get: function () { return this.connection().name } })
  Object.defineProperty(this, 'memory', { get: function () { return this.connection().memory } })
  Object.defineProperty(this, 'readonly', { get: function () { return this.connection().readonly } })
}

DB.prototype.connection = function () {
  if (this.db) {
    return this.db
  }
  try {
    // create path if it doesn't exists
    mkdirp.sync(path.dirname(this.options.path))
    this.db = new Database(this.options.path, {
      memory: this.options.memory,
      readonly: this.options.readonly,
      fileMustExist: this.options.fileMustExist
    })
  } catch (e) {
    this.db = undefined
    throw e
  }
  if (this.options.WAL) {
    this.db.pragma('journal_mode = WAL')
  }
  if (this.options.migrate) {
    this.migrate(typeof this.options.migrate === 'object' ? this.options.migrate : {})
  }
  return this.db
}

DB.prototype.prepare = function (source) {
  return this.connection().prepare(source)
}

DB.prototype.transaction = function (source) {
  return this.connection().transaction(source)
}

DB.prototype.exec = function (source) {
  this.connection().exec(source)
  return this
}

DB.prototype.pragma = function (source, simplify = false) {
  return this.connection().pragma(source, simplify)
}

DB.prototype.checkpoint = function (databaseName) {
  this.connection().checkpoint(databaseName)
  return this
}

DB.prototype.loadExtension = function (...args) {
  this.connection().loadExtension(...args)
  return this
}

DB.prototype.function = function (...args) {
  this.connection().function(...args)
  return this
}

DB.prototype.aggregate = function (...args) {
  this.connection().aggregate(...args)
  return this
}

DB.prototype.backup = function (...args) {
  return this.connection().backup(...args)
}

DB.prototype.register = function (...args) {
  return this.connection().register(...args)
}

DB.prototype.close = function () {
  if (this.db) {
    this.db.close()
    this.db = undefined
  }
  return this
}

DB.prototype.defaultSafeIntegers = function (toggleState) {
  return this.connection().defaultSafeIntegers(toggleState)
}

/**
 * Executes the prepared statement. When execution completes it returns an info object describing any changes made. The info object has two properties:
 *
 * info.changes: The total number of rows that were inserted, updated, or deleted by this operation. Changes made by foreign key actions or trigger programs do not count.
 * info.lastInsertRowid: The rowid of the last row inserted into the database (ignoring those caused by trigger programs). If the current statement did not insert any rows into the database, this number should be completely ignored.
 *
 * If execution of the statement fails, an Error is thrown.
 * @see https://github.com/JoshuaWise/better-sqlite3/wiki/API#runbindparameters---object
 *
 * @param {Object} query the SQL-Query that should be run. Can contain placeholders for bind parameters.
 * @param {any} bindParameters You can specify bind parameters @see https://github.com/JoshuaWise/better-sqlite3/wiki/API#binding-parameters
 * @returns {object}
 */
DB.prototype.run = function (query, ...bindParameters) {
  return this.connection().prepare(query).run(...bindParameters)
}

/**
 * Returns all values of a query
 * @see https://github.com/JoshuaWise/better-sqlite3/wiki/API#allbindparameters---array-of-rows
 *
 * @param {Object} query the SQL-Query that should be run. Can contain placeholders for bind parameters.
 * @param {any} bindParameters You can specify bind parameters @see https://github.com/JoshuaWise/better-sqlite3/wiki/API#binding-parameters
 * @returns {array}
 */
DB.prototype.query = function (query, ...bindParameters) {
  return this.connection().prepare(query).all(...bindParameters)
}

/**
 * Similar to .query(), but instead of returning every row together, an iterator is returned so you can retrieve the rows one by one.
 * @see https://github.com/JoshuaWise/better-sqlite3/wiki/API#iteratebindparameters---iterator
 *
 * @param {Object} query the SQL-Query that should be run. Can contain placeholders for bind parameters.
 * @param {any} bindParameters You can specify bind parameters @see https://github.com/JoshuaWise/better-sqlite3/wiki/API#binding-parameters
 * @returns {Iterator}
 */
DB.prototype.queryIterate = function (query, ...bindParameters) {
  return this.connection().prepare(query).iterate(...bindParameters)
}

/**
 * Returns the values of the first row of the query-result
 * @see https://github.com/JoshuaWise/better-sqlite3/wiki/API#getbindparameters---row
 *
 * @param {Object} query the SQL-Query that should be run. Can contain placeholders for bind parameters.
 * @param {any} bindParameters You can specify bind parameters @see https://github.com/JoshuaWise/better-sqlite3/wiki/API#binding-parameters
 * @returns {Object|null}
 */
DB.prototype.queryFirstRow = function (query, ...bindParameters) {
  return this.connection().prepare(query).get(...bindParameters)
}

/**
 * Returns the values of the first row of the query-result
 * @see https://github.com/JoshuaWise/better-sqlite3/wiki/API#getbindparameters---row
 * It returns always an object and thus can be used with destructuring assignment
 *
 * @example const {id, name} = DB().queryFirstRowObject(sql)
 * @param {Object} query the SQL-Query that should be run. Can contain placeholders for bind parameters.
 * @param {any} bindParameters You can specify bind parameters @see https://github.com/JoshuaWise/better-sqlite3/wiki/API#binding-parameters
 * @returns {Object}
 */
DB.prototype.queryFirstRowObject = function (query, ...bindParameters) {
  return this.connection().prepare(query).get(...bindParameters) || {}
}

/**
 * Returns the value of the first column in the first row of the query-result
 *
 * @param {Object} query the SQL-Query that should be run. Can contain placeholders for bind parameters.
 * @param {any} bindParameters You can specify bind parameters @see https://github.com/JoshuaWise/better-sqlite3/wiki/API#binding-parameters
 * @returns {any}
 */
DB.prototype.queryFirstCell = function (query, ...bindParameters) {
  return this.connection().prepare(query).pluck(true).get(...bindParameters)
}

/**
 * Returns an Array that only contains the values of the specified column
 *
 * @param {Object} column Name of the column
 * @param {Object} query the SQL-Query that should be run. Can contain placeholders for bind parameters.
 * @param {any} bindParameters You can specify bind parameters @see https://github.com/JoshuaWise/better-sqlite3/wiki/API#binding-parameters
 * @returns {array}
 */
DB.prototype.queryColumn = function (column, query, ...bindParameters) {
  return this.query(query, ...bindParameters).map(v => v[column])
}

/**
 * Returns a Object that get it key-value-combination from the result of the query
 *
 * @param {String} key Name of the column that values should be the key
 * @param {Object} column Name of the column that values should be the value for the object
 * @param {Object} query the SQL-Query that should be run. Can contain placeholders for bind parameters.
 * @param {any} bindParameters You can specify bind parameters @see https://github.com/JoshuaWise/better-sqlite3/wiki/API#binding-parameters
 * @returns {object}
 */
DB.prototype.queryKeyAndColumn = function (key, column, query, ...bindParameters) {
  return this.query(query, ...bindParameters).reduce((cur, v) => {
    cur[v[key]] = v[column]
    return cur
  }, {})
}

/**
 * Create an update statement; create more complex one with exec yourself.
 *
 * @param {String} table Name of the table
 * @param {Object} data a Object of data to set. Key is the name of the column. Value 'undefined' is filtered
 * @param {String|Array|Object} where required. array with a string and the replacements for ? after that. F.e. ['id > ? && name = ?', id, name]. Or an object with key values. F.e. {id: params.id}. Or simply an ID that will be translated to ['id = ?', id]
 * @param {undefined|Array} whiteList optional List of columns that can only be updated with "data"
 * @returns {Integer}
 */
DB.prototype.update = function (table, data, where, whiteList) {
  if (!where) {
    throw new Error('Where is missing for the update command of DB()')
  }
  if (!table) {
    throw new Error('Table is missing for the update command of DB()')
  }
  if (typeof data !== 'object' || !Object.keys(data).length) {
    return 0
  }

  // Build start of where query
  let sql = `UPDATE \`${table}\` SET `
  let parameter = []

  // Build data part of the query
  let setStringBuilder = []
  for (let keyOfData in data) {
    const value = data[keyOfData]
    // don't set undefined and only values in an optional whitelist
    if (value !== undefined && (!whiteList || whiteList.includes(keyOfData))) {
      parameter.push(value)
      setStringBuilder.push(`\`${keyOfData}\` = ?`)
    }
  }
  if (!setStringBuilder.length) {
    // nothing to update
    return 0
  }
  sql += setStringBuilder.join(', ')

  // Build where part of query
  sql += ' WHERE '
  if (Array.isArray(where)) {
    let [whereTerm, ...whereParameter] = where
    sql += whereTerm
    parameter = [...parameter, ...whereParameter]
  } else if (typeof where === 'object') {
    let whereStringBuilder = []
    for (let keyOfWhere in where) {
      const value = where[keyOfWhere]
      if (value !== undefined) {
        parameter.push(value)
        whereStringBuilder.push(`\`${keyOfWhere}\` = ?`)
      }
    }
    if (!whereStringBuilder.length) {
      throw new Error('Where is not constructed for the update command of DB()')
    }
    sql += whereStringBuilder.join(' AND ')
  } else {
    sql += 'id = ?'
    parameter.push(where)
  }

  return (this.run(
    sql,
    ...parameter
  )).changes
}

/**
 * Create an update statement; create more complex one with exec yourself.
 *
 * @param {String} table Name of the table
 * @param {Object} data a Object of data to set. Key is the name of the column. Value 'undefined' is filtered
 * @param {String|Array|Object} where required. array with a string and the replacements for ? after that. F.e. ['id > ? && name = ?', id, name]. Or an object with key values. F.e. {id: params.id}. Or simply an ID that will be translated to ['id = ?', id]
 * @param {undefined|Array} whiteBlackList optional List of columns that can not be updated with "data" (blacklist)
 * @returns {Integer}
 */
DB.prototype.updateWithBlackList = function (table, data, where, blackList) {
  return this.update(table, data, where, createWhiteListByBlackList.bind(this)(table, blackList))
}

/**
 * Create an insert statement; create more complex one with exec yourself.
 *
 * @param {String} table Name of the table
 * @param {Object|Array} data a Object of data to set. Key is the name of the column. Can be an array of objects.
 * @param {undefined|Array} whiteList optional List of columns that only can be updated with "data"
 * @returns {Integer}
 */
DB.prototype.insert = function (table, data, whiteList) {
  return (this.run(
    ...createInsertOrReplaceStatement('INSERT', table, data, whiteList)
  )).lastInsertRowid
}

/**
 * Create an insert statement; create more complex one with exec yourself.
 *
 * @param {String} table Name of the table
 * @param {Object|Array} data a Object of data to set. Key is the name of the column. Can be an array of objects.
 * @param {undefined|Array} whiteBlackList optional List of columns that can not be updated with "data" (blacklist)
 * @returns {Integer}
 */
DB.prototype.insertWithBlackList = function (table, data, blackList) {
  return this.insert(table, data, createWhiteListByBlackList.bind(this)(table, blackList))
}

/**
 * Create an replace statement; create more complex one with exec yourself.
 *
 * @param {String} table Name of the table
 * @param {Object|Array} data a Object of data to set. Key is the name of the column. Can be an array of objects.
 * @param {undefined|Array} whiteList optional List of columns that only can be updated with "data"
 * @returns {Integer}
 */
DB.prototype.replace = function (table, data, whiteList) {
  return (this.run(
    ...createInsertOrReplaceStatement('REPLACE', table, data, whiteList)
  )).lastInsertRowid
}

/**
 * Create an replace statement; create more complex one with exec yourself.
 *
 * @param {String} table Name of the table
 * @param {Object|Array} data a Object of data to set. Key is the name of the column. Can be an array of objects.
 * @param {undefined|Array} whiteBlackList optional List of columns that can not be updated with "data" (blacklist)
 * @returns {Integer}
 */
DB.prototype.replaceWithBlackList = function (table, data, blackList) {
  return this.replace(table, data, createWhiteListByBlackList.bind(this)(table, blackList))
}

function createWhiteListByBlackList (table, blackList) {
  let whiteList
  if (Array.isArray(blackList)) {
    // get all avaible columns
    whiteList = this.queryColumn('name', `PRAGMA table_info('${table}')`)
    // get only those not in the whiteBlackList
    whiteList = whiteList.filter(v => !blackList.includes(v))
  }
  return whiteList
}

function createInsertOrReplaceStatement (insertOrReplace, table, data, whiteList) {
  if (!table) {
    throw new Error(`Table is missing for the ${insertOrReplace} command of DB()`)
  }
  if (!Array.isArray(data)) {
    data = [data]
  }
  if (typeof data[0] !== 'object') {
    throw new Error(`data does not contain a object`)
  }

  let fields = Object.keys(data[0])

  if (Array.isArray(whiteList)) {
    fields = fields.filter(v => whiteList.includes(v))
  }

  // Build start of where query
  let sql = `${insertOrReplace} INTO \`${table}\` (\`${fields.join('`,`')}\`) VALUES `
  let parameter = []
  let addComma = false

  data.forEach(rowData => {
    addComma && (sql += ',')
    sql += '(' + Array.from({ length: fields.length }, () => '?').join(',') + ')'
    fields.forEach(field => parameter.push(rowData[field]))
    addComma = true
  })
  return [sql, ...parameter]
}

/**
 * Migrates database schema to the latest version
 */
DB.prototype.migrate = function ({ force, table = 'migrations', migrationsPath = './migrations' } = {}) {
  const location = path.resolve(appRoot, migrationsPath)

  // Get the list of migration files, for example:
  //   { id: 1, name: 'initial', filename: '001-initial.sql' }
  //   { id: 2, name: 'feature', fielname: '002-feature.sql' }
  const migrations = fs.readdirSync(location).map(x => x.match(/^(\d+).(.*?)\.sql$/))
    .filter(x => x !== null)
    .map(x => ({ id: Number(x[1]), name: x[2], filename: x[0] }))
    .sort((a, b) => Math.sign(a.id - b.id))

  if (!migrations.length) {
    // No migration files found
    return
  }

  // Ge the list of migrations, for example:
  //   { id: 1, name: 'initial', filename: '001-initial.sql', up: ..., down: ... }
  //   { id: 2, name: 'feature', fielname: '002-feature.sql', up: ..., down: ... }
  migrations.map(migration => {
    const filename = path.join(location, migration.filename)
    let data = fs.readFileSync(filename, 'utf-8')
    const [up, down] = data.split(/^--\s+?down\b/mi)
    if (!down) {
      const message = `The ${migration.filename} file does not contain '-- Down' separator.`
      throw new Error(message)
    } else {
      migration.up = up.replace(/^-- .*?$/gm, '').trim()// Remove comments
      migration.down = down.trim() // and trim whitespaces
    }
  })

  // Create a database table for migrations meta data if it doesn't exist
  this.exec(`CREATE TABLE IF NOT EXISTS "${table}" (
  id   INTEGER PRIMARY KEY,
  name TEXT    NOT NULL,
  up   TEXT    NOT NULL,
  down TEXT    NOT NULL
)`)

  // Get the list of already applied migrations
  let dbMigrations = this.query(
    `SELECT id, name, up, down FROM "${table}" ORDER BY id ASC`
  )

  // Undo migrations that exist only in the database but not in files,
  // also undo the last migration if the `force` option was set to `last`.
  const lastMigration = migrations[migrations.length - 1]
  for (const migration of dbMigrations.slice().sort((a, b) => Math.sign(b.id - a.id))) {
    if (!migrations.some(x => x.id === migration.id) ||
        (force === 'last' && migration.id === lastMigration.id)) {
      this.exec('BEGIN')
      try {
        this.exec(migration.down)
        this.run(`DELETE FROM "${table}" WHERE id = ?`, migration.id)
        this.exec('COMMIT')
        dbMigrations = dbMigrations.filter(x => x.id !== migration.id)
      } catch (err) {
        this.exec('ROLLBACK')
        throw err
      }
    } else {
      break
    }
  }

  // Apply pending migrations
  const lastMigrationId = dbMigrations.length ? dbMigrations[dbMigrations.length - 1].id : 0
  for (const migration of migrations) {
    if (migration.id > lastMigrationId) {
      this.exec('BEGIN')
      try {
        this.exec(migration.up)
        this.run(
          `INSERT INTO "${table}" (id, name, up, down) VALUES (?, ?, ?, ?)`,
          migration.id, migration.name, migration.up, migration.down
        )
        this.exec('COMMIT')
      } catch (err) {
        this.exec('ROLLBACK')
        throw err
      }
    }
  }

  return this
}

module.exports = DB
