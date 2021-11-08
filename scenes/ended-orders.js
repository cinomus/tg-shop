const Order = require("../libs/models/Order");
const mongo = require("mongodb");
const {blockUser} = require("../supportFunctions");
const {sort} = require("../supportFunctions");
const {filterOutOrders} = require("../supportFunctions");
const {addToRenderedMessages} = require("../supportFunctions");
const {deleteRenderedMessages} = require("../supportFunctions");
const {Scenes, Telegraf, Markup} = require('telegraf')
const {Database} = require('../session')

const {downloadFile, createProduct, parseXLSX, renderRequiredProductsFromExcel} = require('../supportFunctions')


const endedOrdersScene = new Scenes.BaseScene('ENDED-ORDERS-SCENE')
endedOrdersScene.enter(async (ctx) => {
    await ctx.reply('Завершенные заказы:',
        Markup.keyboard([[ 'Следующая страница'], ['Назад']])
            .resize()
    )
    const collection = await Database.getCollection('orders');
    ctx.scene.state.ordersFromDb = await collection.find({status: {$in: ['completed', 'canceled', 'rejected']}}).sort({$natural: -1}).toArray();
    if (ctx.scene.state.ordersFromDb.length === 0) return ctx.reply('Нет завершенных заказов!')
    ctx.scene.state.renderOptions = {start: 0, end: 5}
    let orders = ctx.scene.state.ordersFromDb.slice(ctx.scene.state.renderOptions.start, ctx.scene.state.renderOptions.end)

    await renderEndedOrders(ctx, orders)

})
endedOrdersScene.hears('Следующая страница', async (ctx) => {
    // await deleteRenderedMessages(ctx)
    ctx.scene.state.renderOptions.start += 5;
    ctx.scene.state.renderOptions.end += 5;
    let orders = ctx.scene.state.ordersFromDb.slice(ctx.scene.state.renderOptions.start, ctx.scene.state.renderOptions.end)
    await renderEndedOrders(ctx, orders)
})

// endedOrdersScene.hears('Предыдушая страница', async (ctx) => {
//     if (ctx.scene.state.renderOptions.start !== 0) {
//         await deleteRenderedMessages(ctx)
//         ctx.scene.state.renderOptions.start -= 5;
//         ctx.scene.state.renderOptions.end -= 5;
//         let orders = ctx.scene.state.ordersFromDb.slice(ctx.scene.state.renderOptions.start, ctx.scene.state.renderOptions.end)
//         await renderEndedOrders(ctx, orders)
//     }
//     console.log('prev')
// })

endedOrdersScene.hears('Назад', async (ctx) => {
    await ctx.scene.enter('ADMIN_PANEL')
})

endedOrdersScene.on('callback_query', async (ctx, next) => {
        try {
            let trigger = ctx.callbackQuery.data.split('|')[0]
            let requiredId = ctx.callbackQuery.data.split('|')[1];
            switch (trigger) {
                case 'MORE': {
                    let selectedOrder = await filterOutOrders(requiredId)
                    const col = await Database.getCollection('products');
                    let message = '';
                    let coast = 0;
                    let orders = []
                    for (let key in selectedOrder.cart) {
                        const object = new mongo.ObjectID(key);
                        orders.push({_id: object})
                    }
                    const products = await col.find({$or: orders}).toArray();
                    for (let product of products) {
                        coast += selectedOrder.cart[product._id] * product.cost
                        message += `${product.title}\nКоличество: ${selectedOrder.cart[product._id]}\n\n`
                    }
                    await Order.edit({
                        ctx,
                        order: selectedOrder,
                        trigger,
                        admin: true,
                        obj: {message: message, coast: coast}
                    })

                    await ctx.answerCbQuery()
                }
                    break;
                case 'LESS': {
                    let selectedOrder = await filterOutOrders(requiredId);
                    await Order.edit({ctx, order: selectedOrder, admin: true})
                    await ctx.answerCbQuery()
                }
                    break;
                case 'PROFILE': {
                    const collection = await Database.getCollection('orders')
                    let orders = await collection.find({'user.id': +requiredId}).toArray()
                    let statistics = await sort(orders)

                    const collection2 = await Database.getCollection('sessions')
                    let sessionOfUser = await collection2.findOne({'data.user.id': +requiredId})
                    let photo = (await ctx.telegram.getUserProfilePhotos(requiredId)).photos[0]
                    if (photo === undefined) photo = {url: 'https://picsum.photos/200/300/'}
                    else photo = photo[0]
                    let blockUnblockButton;
                    if (sessionOfUser.data.banned) {
                        blockUnblockButton = Markup.button.callback('Разблокировать', 'UNBLOCK|' + sessionOfUser.data.user.id)
                    } else {
                        blockUnblockButton = Markup.button.callback('Заблокировать', 'BLOCK|' + sessionOfUser.data.user.id)
                    }


                    let cb = await ctx.replyWithPhoto(photo.file_id || photo.url,
                        {
                            caption: `User id: ${sessionOfUser.data.user.id}\nName: ${sessionOfUser.data.user.first_name}\nUsername: ${sessionOfUser.data.user.username}\nЗаблокирован:${sessionOfUser.data.banned}\nLink: <a href="tg:user?id=${sessionOfUser.data.user.id}">Ссылка</a>\n⛔ Отклоненных заказов: ${statistics.rejected}\n❌ Отмененных заказов: ${statistics.canceled}\n✅ Завершенных заказов: ${statistics.completed}`,
                            parse_mode: 'HTML',
                            ...Markup.inlineKeyboard(
                                [
                                    blockUnblockButton,
                                    Markup.button.callback('Убрать', 'SKIP|')
                                ]
                            )
                        }
                    )
                    await ctx.answerCbQuery()
                    await addToRenderedMessages(ctx, cb)
                }
                    break;

                case 'SKIP': {
                    await deleteRenderedMessages(ctx);
                    await ctx.answerCbQuery();
                }
                break;

                case 'UNBLOCK': {                                             // а здесь поставил id пользователя
                    const collection = await Database.getCollection('sessions')
                    await collection.findOneAndUpdate({key: `${requiredId}:${requiredId}`}, {$set: {'data.banned': false}})
                    await ctx.deleteMessage();
                    await ctx.reply('Пользователь разблокирован!')
                }
                    break;
                case 'BLOCK': {
                    const collection = await Database.getCollection('orders')
                    await collection.updateMany({'user.id': +requiredId, status: 'in process'}, {
                        $set: {
                            status: 'rejected',
                            reason: 'Ban'
                        }
                    })
                    await ctx.deleteMessage();
                    await blockUser(ctx, requiredId);
                }
                break;
                default: {
                    next()
                }
            }
        } catch (e) {
            console.log(e)
        }
    }
)

async function renderEndedOrders(ctx, orders) {
    for (let order of orders) {
        await Order.render({ctx, order, admin: true})
    }
}

module.exports = endedOrdersScene