require('dotenv').config()
const TelegramBot = require('node-telegram-bot-api')
const {MongoClient} = require('mongodb')

const MY_CHANNEL = process.env.TELEGRAM_CHANNEL
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {polling: true})

MongoClient.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .catch(err => {
    console.error(err.stack)
    process.exit(1)
  })
  .then(client => {
    let votes = client.db('small-reddit').collection('votes')

    async function render_vote(message_id) {
      const messages_vote = await votes.findOne({message_id: message_id})
      let vote_count = 0

      if (messages_vote) {
        vote_count = messages_vote.count
      }

      bot.editMessageReplyMarkup(
        {
          inline_keyboard: [
            [
              {text: '👍', callback_data: '+'},
              {text: vote_count, callback_data: 'test'},
              {text: '👎', callback_data: '-'},
            ],
          ],
        },
        {
          chat_id: MY_CHANNEL,
          message_id: message_id,
        },
      )
    }

    async function vote(isUp, message_id, user_id) {
      const messages_vote = await votes.findOne({message_id: message_id})

      if (messages_vote) {
        const userVoted = messages_vote.users.find(user => user.id === user_id)

        if (userVoted) {
          let new_vote = messages_vote
          if (userVoted.isUp === isUp) {
            return false
          }
          let new_users = new_vote.users.map(user =>
            user.id === user_id ? {...user, isUp: isUp} : user,
          )

          new_vote.users = new_users
          new_vote.count = isUp ? new_vote.count + 2 : new_vote.count - 2

          await votes.updateOne({message_id: message_id}, {$set: new_vote})
        } else {
          let users = [...messages_vote.users, {id: user_id, isUp: isUp}]
          await votes.updateOne(
            {message_id: message_id},
            {
              $set: {
                users: users,
                count: isUp ? messages_vote.count + 1 : messages_vote.count - 1,
              },
            },
          )
        }
      } else {
        await votes.insertOne({
          message_id: message_id,
          users: [{id: user_id, isUp: isUp}],
          count: isUp ? 1 : -1,
        })
      }

      return true
    }

    bot.on('channel_post', msg => {
      render_vote(msg.message_id)
    })

    bot.on('callback_query', async function(data) {
      if (data.data === '+') {
        if (await vote(true, data.message.message_id, data.from.id)) {
          await render_vote(data.message.message_id)
        }
      }
      if (data.data === '-') {
        if (await vote(false, data.message.message_id, data.from.id)) {
          await render_vote(data.message.message_id)
        }
      }
      bot.answerCallbackQuery(data.id)
    })

    bot.on('polling_error', error => {
      console.log(error) // => 'EFATAL'
    })
  })

module.exports = bot
