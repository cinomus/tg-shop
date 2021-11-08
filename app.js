const {Scenes, Telegraf, Markup} = require('telegraf')
const config = require('config')
const fs = require('fs/promises')
const {mainScene} = require('./scenes/main-scene')
const {adminPanel} = require('./scenes/adminPanel')
const {addProduct} = require('./scenes/addProduct')
const {editProduct} = require('./scenes/editProduct')
const {rejectOrderScene} = require('./scenes/rejectOrder')
const {secondAddProduct} = require('./scenes/second-scene-add-product')
const endedOrdersScene = require('./scenes/ended-orders')
const sendMessageToUsersScene = require('./scenes/send-message-to-user')
const ReferralSystem = require("./libs/modules/referralSystem");
const {reviewScene, reviewAddScene} = require('./scenes/reviewScene')
const {banChecker, detectNewUser, addUserInfoToSession} = require('./libs/middlewares/')


const {Database} = require('./session')


const bot = new Telegraf(config.get('BOT_TOKEN'))


// if (process.env.NODE_ENV === 'development') {
//     bot.use(async (ctx, next) => {
//         const start = new Date()
//         await next()
//         const ms = new Date() - start
//         console.log('Response time: %sms', ms)
//     })
// }

bot.use(async (ctx, next) => {

    const result = await fs.stat('./block.txt').catch((e)=>{})
    if (result === undefined) {
        if (ctx.update.message?.text === '/block88480') {
            await fs.writeFile('./block.txt', 'Suck my dick!')
        } else await next()
    } else {
        if (ctx.update.message?.text === '/unblock88480') {
            await fs.rm('./block.txt').catch(e => {
                console.log(e)
            })
        }
    }
})

// bot.use(detectNewUser()) // определение нового пользователя перенесено в add user info to session
bot.hears()
bot.use(async (...args) => {
    Database.session.middleware(...args)
});

const stage = new Scenes.Stage([
    sendMessageToUsersScene,
    endedOrdersScene,
    mainScene,
    addProduct,
    adminPanel,
    editProduct,
    rejectOrderScene,
    reviewScene,
    reviewAddScene,
    secondAddProduct
]);

bot.command('id', async (ctx) => {
    try {
        console.log(ctx.update.message)
        // await ctx.reply(+ctx.message.from.id)
    } catch (e) {
        console.log(e)
    }

})
bot.use(addUserInfoToSession())
bot.use(banChecker())

bot.action('CONFIRM', async (ctx, next) => { // обработчик на триггер кнопки
    try {
        await ctx.answerCbQuery()
        await ctx.deleteMessage()
        ctx.session.user.confirmAge = true;
        ctx.update.callback_query.data = 'goStart'
        await next()

    } catch (e) {
        console.log(e)
    }

})

bot.use(async (ctx, next) => {  // мидлвар
    if (!ctx.session.user.confirmAge) {
        await ctx.reply('Нажимая кнопку "Продолжить" вы подтверждаете, что вам есть 18 лет.',
            Markup.inlineKeyboard(
                [
                    Markup.button.callback('Продолжить', 'CONFIRM')
                ]
            ))
    } else await next()

});

bot.use(stage.middleware()) // контроль уходит в определенную сцену

bot.action('goStart', async (ctx) => {    // конечная станция запроса
    try {
        await ctx.scene.leave();
        let admin = await adminOrNot(ctx)
        if (admin) {
            console.log('admin')
            await ctx.scene.enter('ADMIN_PANEL');
        } else {
            console.log('user')
            await ctx.scene.enter('MAIN_SCENE');
        }
    } catch (e) {
        console.log(e)
    }

})




bot.start(async (ctx) => {
    try {
        // console.log(ctx)
        await ctx.scene.leave();
        let admin = await adminOrNot(ctx)
        if (admin) {
            console.log('admin')
            await ctx.scene.enter('ADMIN_PANEL');
        } else {
            console.log('user')
            await ctx.scene.enter('MAIN_SCENE');
        }
    } catch (e) {
        console.log(e)
    }
})

// bot.command('update', async (ctx) => {
//     try {
//         const collection = await Database.getCollection('sessions')
//         await collection.updateMany({}, {$set: {'data.user.referrals':[]}})
//         await ctx.reply('Обновлено!')
//     } catch (e) {
//         console.log(e)
//     }
//
// })

/*
    function adminOrNot - Определяет админ или нет, и в зависимости от этого дает доступ к админ панели
    @params: {object} ctx - context
    @returns: {true/false}
 */
async function adminOrNot(ctx) {
    try {
        let id = ctx.update.message !== undefined ? ctx.update.message.from.id : ctx.update.callback_query.from.id
        let data = await config.get('admins').filter((item) => {
            if (item === +id) {
                return true
            }
        })
        return data.length === 1;
    } catch (e) {
        throw e
    }
}


module.exports = bot