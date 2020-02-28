require('dotenv').config()
const {MongoClient} = require('mongodb')
MongoClient.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .catch(err => {
    console.error(err.stack)
    process.exit(1)
  })
  .then(client => {
    require('./bot')(client)
  })
