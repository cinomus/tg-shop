const {Scenes, Telegraf, Markup} = require('telegraf')
const {Database} = require('../session')


const sendMessageToUsersScene = new Scenes.WizardScene('SEND_MESSAGE_TO_USERS',
    async (ctx) => {
        await ctx.reply(`Введите сообщение, которое будет отправлено всем пользователям: `,
            Markup.keyboard(['Назад в мэйн меню']).resize())
        await ctx.wizard.next();
    },
    async (ctx) => {
        ctx.scene.state.messageToUsers = {}
        ctx.scene.state.messageToUsers.text = ctx.message.text

        await ctx.reply(`${ctx.scene.state.messageToUsers.text}`,
            Markup.inlineKeyboard([
                Markup.button.callback('Отправить', 'SEND'),
                Markup.button.callback('Отменить', 'CANCEL'),
            ]))
        return ctx.wizard.next();
    },
)

sendMessageToUsersScene.hears('Назад в мэйн меню', async (ctx) => {
    await ctx.scene.enter('ADMIN_PANEL')
})

sendMessageToUsersScene.action('CANCEL', async (ctx) => {
    await ctx.answerCbQuery()
    ctx.reply(`Сообщение: \n${ctx.scene.state.messageToUsers.text}\n\nНовое сообщение:`)
    return ctx.wizard.selectStep(1)
})

sendMessageToUsersScene.action('SEND', async (ctx) => {
    await ctx.answerCbQuery()
    await ctx.deleteMessage()
    const arrayOfUserSessions = await getUserSessions();
    const result = await sendMessages(ctx, arrayOfUserSessions)
    await ctx.reply(`Сообщения отправлены! Доставлено ${result.messages} из ${result.users}.`)
    await ctx.scene.enter('ADMIN_PANEL')

    async function sendMessages(ctx, arrayOfUserSessions) {
        let users = arrayOfUserSessions.length;
        let messages = 0;
        for (let session of arrayOfUserSessions) {
            try {
                await ctx.telegram.sendMessage(session.data.user.id, `${ctx.scene.state.messageToUsers.text}`)
                messages++
            } catch (e) {
                if (e.response.error_code !== 403) console.log(e)
            }
        }
        return {users: users, messages: messages}

    }

    async function getUserSessions() {
        const collection = await Database.getCollection('sessions')
        return collection.find().toArray();
    }
})

module.exports = sendMessageToUsersScene
