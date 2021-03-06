const TelegramBot = require('node-telegram-bot-api')

const MY_CHANNEL = '@' + process.env.TELEGRAM_CHANNEL
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {polling: true})

module.exports = client => {
  let votes = client.db('small-reddit2').collection('votes')

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
            {text: vote_count, callback_data: ' '},
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

  async function vote(isUp, message_id, user_id, date, username) {
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
        let users = [
          ...messages_vote.users,
          {id: user_id, isUp: isUp, username: username},
        ]
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
        date: date,
      })
    }

    return true
  }

  bot.on('message', async msg => {
    if (msg.text && msg.text === 'meme') {
      const now = Math.round(new Date().getTime() / 1000)

      const cursor = await votes.aggregate([
        {$addFields: {diff_date: {$subtract: [now, '$date']}}},
        {$match: {diff_date: {$lt: 60 * 60 * 24}}},
        {$sort: {count: -1}},
        {$limit: 2},
      ])
      const messages = await cursor.toArray()

      messages.forEach(message => {
        bot.sendMessage(
          '@' + process.env.TELEGRAM_CHANNEL2,
          `https://t.me/${process.env.TELEGRAM_CHANNEL}/${message.message_id}`,
        )
      })

      console.log(now - msg.date)
      console.log(msg)
    }
  })

  bot.on('photo', data => {
    if (
      data.from.username === 'jedimahdi' ||
      data.from.username === 'Remophix' ||
      data.from.username === 'academemeadmin' ||
      data.from.username === 'Shahinjafaridanesh'
    ) {
      bot
        .sendPhoto(MY_CHANNEL, data.photo[data.photo.length - 1].file_id, {
          caption: data.caption || '',
        })
        .then(msg => {
          render_vote(msg.message_id)
        })
    }
  })

  bot.on('callback_query', async function(data) {
    console.log(data)
    if (data.data === '+') {
      if (
        await vote(
          true,
          data.message.message_id,
          data.from.id,
          data.message.date,
          data.from.username,
        )
      ) {
        await render_vote(data.message.message_id)
      }
    }
    if (data.data === '-') {
      if (
        await vote(
          false,
          data.message.message_id,
          data.from.id,
          data.message.date,
          data.from.username,
        )
      ) {
        await render_vote(data.message.message_id)
      }
    }
    bot.answerCallbackQuery({
      callback_query_id: data.id,
      text: 'رای شما ثبت شد!',
    })
  })

  bot.on('polling_error', error => {
    console.log(error) // => 'EFATAL'
  })
}
