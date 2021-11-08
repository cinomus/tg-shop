const {Scenes, Telegraf, Markup} = require('telegraf')
const {Database} = require('../session');
const mongo = require('mongodb');
const Order = require("../libs/models/Order");
const Product = require("../libs/models/Product");
const {createXLSX} = require("../supportFunctions");

const {StatisticOfDay, getStatisticOfDay, getRemainingProducts} = require("../libs/modules/statistic");

const {filterOutOrders, addZero, sort, blockUser, addToRenderedMessages, deleteRenderedMessages} = require('../supportFunctions')
const adminPanel = new Scenes.BaseScene('ADMIN_PANEL')
// adminPanel.use(async (ctx, next) => {
//     const start = new Date()
//     await next()
//     const ms = new Date() - start
//     console.log('Response time: %sms', ms)
// })


adminPanel.enter(async (ctx) => {
        if (!ctx.session.brands) delete ctx.session.brands
        if (!ctx.session.product) delete ctx.session.product
        if (!ctx.session.products) delete ctx.session.products


        await ctx.reply('Панель администратора: ',
            Markup.keyboard([
                ['Товары', 'Сообщение пользователям'],
                ['Заказы', 'Завершенные заказы'],
                ['Black list', 'Отзывы'],
                ['Статистика', '(Как видит пользователь)']
            ]).resize()
        )
    }
)
adminPanel.hears('Товары', async (ctx) => {
    return ctx.reply('Выберите что вы хотите сделать:', Markup.keyboard(
        [
            ['Добавление товаров', 'Изменение товара'],
            ['Назад в мэйн меню']
        ])
        .resize()
    )
})

adminPanel.hears('Добавление товаров', async (ctx) => {
    await ctx.reply('Вы можете добавить товары 2 способами: ' +
        '\n1) добавляя вручную каждый товар.' +
        '\n2) добавив с помощью файла EXCEL в формате .xlsx.',
        Markup.keyboard([
            ['Добавить вручную', 'Добавить файлом'],
            ['Назад']
        ]).resize()
    )
})

adminPanel.hears('Добавить вручную', async (ctx) => {
    await ctx.scene.enter('ADD_PRODUCT')
})

adminPanel.hears('Назад в мэйн меню', async (ctx) => {
    await ctx.scene.enter('ADMIN_PANEL')
})

adminPanel.hears('Добавить файлом', async (ctx) => {
    await ctx.scene.enter('SECOND-SCENE-ADD-PRODUCT')
})

adminPanel.hears('Получить оставшиеся товары', async (ctx) => {
    await createXLSX();
    await ctx.replyWithDocument({source: './created_files/file.xlsx'})
})

adminPanel.hears('Статистика', async (ctx) => {
    let remainingProducts = await getRemainingProducts();
    let stats = await getStatisticOfDay();
    let str = await concatenationOfProductNamesToString(stats.purchasedProducts)
    await ctx.reply(`Оставшиеся товары: ${remainingProducts}
    \nНовых пользователей за день: ${stats.newUsers}
    \nЗаказов за день: ${stats.orders}
    \nПродаж за день: ${stats.dailySales}
    \nСумма продаж за день: ${stats.dailySalesAmount} руб.
    ${str === '' ?
        '' :
        `\nПроданные за день товары: ${str}`
        }
    `, Markup.keyboard(
        [
            ['Получить оставшиеся товары'],
            ['Назад в мэйн меню']
        ]).resize()
    )

    async function concatenationOfProductNamesToString(purchasedProducts) {
        const collection = await Database.getCollection('products')
        let str = ''
        for (let key in purchasedProducts) {
            const objectId = new mongo.ObjectID(key);
            let product = await collection.findOne(
                {_id: objectId} // критерий выборки
            )
            str += `\n  ${product.title} - ${purchasedProducts[key]}`
        }
        return str
    }
})

adminPanel.hears('Отзывы', async (ctx) => {
    const collection = await Database.getCollection('reviews')
    let reviews = await collection.find().sort({$natural: -1}).limit(10).toArray() // ??? Возможно потом надо будет ограничить количество отображаемых отзывов
    if (reviews.length === 0) return ctx.reply('Нет отзывов!')
    await ctx.reply('Последние отзывы:', Markup.keyboard(['Назад в мэйн меню']).resize())

    for await (let review of reviews) {
        await ctx.reply(`${review.sender.first_name}   <code>${await addZero(review.date.getDate())}.${await addZero(review.date.getMonth() + 1)}.${review.date.getFullYear()}</code>\n\n<em>${review.text}</em>`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard(
                    [
                        Markup.button.callback('Профиль', 'PROFILE|' + review.sender.id),
                        Markup.button.callback('Удалить', 'DELETE_REVIEW|' + review._id)

                    ]
                )
            }
        )
    }
})

adminPanel.hears('Назад', async (ctx) => {
    await ctx.reply('Выберите что вы хотите сделать:', Markup.keyboard(
        [
            ['Добавление товаров', 'Изменение товара'],
            ['Назад в мэйн меню']
        ]).resize()
    )
})

adminPanel.hears('Сообщение пользователям', async (ctx) => {
    return ctx.scene.enter('SEND_MESSAGE_TO_USERS')
})

adminPanel.hears('Black list', async (ctx) => {
    const collection = await Database.getCollection('sessions');
    let piples = await collection.find({'data.banned': true}).toArray()

    if (piples.length === 0) {
        return await ctx.reply('Нет заблокированных пользователей!')
    }
    for (let k in piples) {
        let message = '';
        for (let key in piples[k].data.user) {
            message += `${key}: <em>${piples[k].data.user[key]}</em>\n`
        }
        message += `Пользователь: <a href="tg:user?id=${piples[k].data.user.id}">Ссылка</a>`
        await ctx.reply(message, {
            parse_mode: 'HTML', ...Markup.inlineKeyboard(
                [
                    Markup.button.callback('Разблокировать', 'UNBLOCK|' + piples[k].data.user.id)
                ]
            )
        })
    }
})

adminPanel.hears('Изменение товара', async (ctx) => {
    await deleteRenderedMessages(ctx)
    const collection = await Database.getCollection('products');
    let products = await collection.find().toArray()


    ctx.scene.state.brands = {}
    let array = []

    for (let product of products) {
        if (!ctx.scene.state.brands[product.brand]) {
            ctx.scene.state.brands[product.brand] = [];
        }
        ctx.scene.state.brands[product.brand].push(product)

    }

    for (let k in ctx.scene.state.brands) {
        if (!array[0] || array[array.length - 1].length === 3) {
            let num = array.length
            array[num] = [];
            await array[num].push(Markup.button.callback(k, 'CHOICE|' + k));
        } else {
            array[array.length - 1].push(Markup.button.callback(k, 'CHOICE|' + k))
        }

        // await addToRenderedMessages(ctx, cb);
    }
    await ctx.reply(`Выберите нужный вам бренд:`,
        Markup.inlineKeyboard(array)
    )
})

adminPanel.hears('(Как видит пользователь)', async (ctx) => {
    await ctx.reply('Чтобы вернуться в админку набери /start!')
    return await ctx.scene.enter('MAIN_SCENE')
})

adminPanel.hears('Заказы', async (ctx) => {
    const collection = await Database.getCollection('orders');
    const orders = await collection.find({status: 'in process'}).toArray();
    if (orders.length === 0) return ctx.reply('Заказов нет!')
    for (let order of orders) {
        await Order.render({ctx, order, admin: true})
    }
})

adminPanel.hears('Завершенные заказы', async (ctx) => {
    await ctx.scene.enter('ENDED-ORDERS-SCENE');
})

adminPanel.on('callback_query', async (ctx) => {
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
            case 'END': {
                await ctx.answerCbQuery()
                let order = (await Order.endOrder({ctx, id: requiredId})).value;
                await ctx.deleteMessage()
                await StatisticOfDay.addDailySale()
                await StatisticOfDay.addDailySaleAmount(order.cart)
                await StatisticOfDay.addToPurchasedProducts(order.cart)
            }
                break;
            case 'REJECT': {
                let selectedOrder = await filterOutOrders(requiredId);

                await ctx.deleteMessage();
                await ctx.scene.enter('REJECT_ORDER', {id: requiredId})

                await Product.returnProductsToSclad(selectedOrder.cart)
            }
                break;
            case 'EDIT': {
                await deleteRenderedMessages(ctx)
                const col = await Database.getCollection('products');
                const object = new mongo.ObjectID(requiredId);
                let productToEdit = await col.findOne({_id: object});

                await ctx.scene.enter('EDIT_PRODUCT', {productToEdit: productToEdit})

                await ctx.answerCbQuery()
            }
                break;
            case 'DELETE': {
                const collection = await Database.getCollection('products')
                const object = new mongo.ObjectID(requiredId);
                await collection.deleteOne({_id: object})
                await ctx.deleteMessage();

                await ctx.answerCbQuery()
            }
                break;
            case 'UNBLOCK': {                                             // а здесь поставил id пользователя
                const collection = await Database.getCollection('sessions')
                await collection.findOneAndUpdate({key: `${requiredId}:${requiredId}`}, {$set: {'data.banned': false}})
                await ctx.editMessageText('Пользователь разблокирован!')
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
                break;                                              //я дурачок и поставил в блоке id от ордера
            case 'REMOVE_FROM_PUBLICATION': {
                await Product.removeFromPublication({ctx, id: requiredId});
                await ctx.answerCbQuery()
            }
                break;
            case 'ADD_TO_PUBLICATION': {
                await Product.addToPublication({ctx, id: requiredId})
                await ctx.answerCbQuery()
            }
                break;
            case 'DELETE_REVIEW': {
                const collection = await Database.getCollection('reviews')
                const object = new mongo.ObjectID(requiredId);
                await collection.findOneAndDelete(
                    {_id: object} // критерий выборки
                )
                await ctx.deleteMessage()
            }
                break;
            // profile принимает в id user id пользователя requiredId === user id
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
            case 'CHOICE': {
                await deleteRenderedMessages(ctx)
                let brand = ctx.scene.state.brands[requiredId];
                for (let product of brand) {
                    let cb = await Product.renderMessageWithProduct({ctx, product, trigger, admin: true})
                    await addToRenderedMessages(ctx, cb);
                }
                await ctx.answerCbQuery();
            }
                break;
        }
    } catch (e) {
        console.log(e)
    }
})



module.exports = {adminPanel}