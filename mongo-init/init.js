db.auth(process.env.MONGO_INITDB_ROOT_USERNAME, process.env.MONGO_INITDB_ROOT_PASSWORD)

db = db.getSiblingDB(process.env.MONGO_INITDB_DATABASE)

// Create a user for the specific database
db.createUser({
  user: process.env.MONGO_INITDB_ROOT_USERNAME,
  pwd: process.env.MONGO_INITDB_ROOT_PASSWORD,
  roles: [
    {
      role: "readWrite",
      db: process.env.MONGO_INITDB_DATABASE
    }
  ]
})
