const {Scenes, Telegraf, Markup} = require('telegraf')
const {Database} = require('../session');
const mongo = require('mongodb');

const Order = require("../libs/models/Order");
const Product = require("../libs/models/Product");
const {StatisticOfDay} = require('../libs/modules/statistic')
const {render_cart} = require("../supportFunctions");
const {notifications} = require('../event_handlers/notifications')
const {banChecker, deleteRenderedMessages, addZero, addToRenderedMessages, editTotalMessage, filterOutProducts, calculateThePrice, calculateCostOfAll, filterOutOrders} = require('../supportFunctions')

const mainScene = new Scenes.BaseScene('MAIN_SCENE')

mainScene.use(async (ctx, next) => {
    /*
    фишка в том что таймаут срабатывает уже после всех мидлваров и получается так, что
    сообщения в телеграмме удаляются, но из renderedMessages в сессии удалиться не успевают
    т.к. сессия обновляется до завершения таймаута из за этого при сдедующем сообщении
    ,которое удаляет сообщения выбрасывается ошибка о том, что сообщения не найдены

     */
    if (ctx.session.timerId !== undefined) {
        clearTimeout(ctx.session.timerId)
    }
    let timerId = setTimeout(async () => {
        await deleteRenderedMessages(ctx)
    }, 60000)
    ctx.session.timerId = timerId[Symbol.toPrimitive]()

    await next()
})

mainScene.enter(async (ctx) => {
    await ctx.reply('Добро пожаловать в онлаин Vape Shop 🐗<a href="https://t.me/dimniykaban">"Дымный Кабан"</a>🐗\n' +
        '\n' +
        '🔥У нас вы можете приобрести жидкость на любой вкус по максимально приятной цене🔥\n' +
        '\n' +
        'Если вам показалось мало, то подпишись на ❤️<a href="https://t.me/dimniykaban"> наш канал </a>❤️ , в котором на данный момент проходит конкурс на 10 банок ЛЮБОЙ жидкости из нашего ассортимента и постоянные акции! 🛒\n' +
        '\n' +
        '✅Обязательно подпишись!✅',
        {
            parse_mode: "HTML",
            ...Markup.keyboard([
                ['💵 Ассортимент', '🛒 Корзина'],
                ['📝 Мои заказы', '📓 Контакты'],
                ['🔖 Отзывы']
            ])
                .resize()
                .selective()
        }
    )
})

mainScene.hears('📓 Контакты', async (ctx) => {
    await ctx.reply(`По любым интересующим вас вопросам вы можете обратиться к @Kr1sR`,
        {
            parse_mode: 'HTML'
        })
})

mainScene.hears('🔖 Отзывы', async (ctx) => {
    await ctx.scene.enter('REVIEW_SCENE')
})

mainScene.hears('📝 Мои заказы', async (ctx) => {
    const collection = await Database.getCollection('orders');
    const their_orders = await collection.find({'user.id': ctx.update.message.from.id}).sort({$natural: -1}).limit(5).toArray();
    for (let k in their_orders) {
        await Order.render({ctx, order: their_orders[k]})
    }
})

mainScene.hears('🛒 Корзина', async (ctx) => {
    let costOfAll = await render_cart({ctx});
});

mainScene.hears('💵 Ассортимент', async (ctx) => {
    try {
        await deleteRenderedMessages(ctx);
        const collection = await Database.getCollection('products');

        const products = await collection.find().toArray();
        ctx.scene.state.brands = {}
        let array = []

        for (let product of products) {
            if (product.publication === true) {
                if (!ctx.scene.state.brands[product.brand]) {
                    ctx.scene.state.brands[product.brand] = [];
                }
                ctx.scene.state.brands[product.brand].push(product)
            }
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
    } catch (e) {
        console.log(e)
    }
});

mainScene.action('ORDER', async (ctx) => {
    await deleteRenderedMessages(ctx, false);

    await ctx.telegram.editMessageText(ctx.scene.state.totalMessage.chatId, ctx.scene.state.totalMessage.id, [], 'Создание заказа...')
    let order = {}
    order.cart = JSON.parse(JSON.stringify(ctx.session.cart))
    order.user = ctx.update.callback_query.from
    order.status = 'in process' // 'canceled' - отменен 'rejected'- отклонен 'completed' - завершен
    order.date = new Date();
    let result = await check_the_number_of_items(order.cart)
    if (result.enough === true) {
        await Order.save(order)
        // await createNewOrder(order)
        await updateProducts(order.cart)
        ctx.session.cart = {};

        await StatisticOfDay.addOrderToStats();

        await ctx.telegram.editMessageText(ctx.scene.state.totalMessage.chatId, ctx.scene.state.totalMessage.id, [], 'Заказ создан. \nВ скором времени с вами свяжутся для уточнения деталей заказа.')

        process.env.NODE_ENV === 'production'? await notifications.emit('new_order', ctx): console.log('Новый заказ!');

        delete ctx.scene.state.totalMessage;
        await ctx.answerCbQuery();
    } else {

        await deleteRenderedMessages(ctx, true);
        await render_cart({ctx, brokenProducts: result.keysOfBrokenItems})

    }

    async function updateProducts(cart) {
        let coll = await Database.getCollection('products')
        for (let key in cart) {
            const object = new mongo.ObjectID(key);
            let product = await coll.findOne({$and: [{_id: object}]})
            product.quantity = +product.quantity - +cart[key]
            product.quantity === 0 ?
                coll.updateOne({_id: object}, {
                    $set: {
                        quantity: product.quantity,
                        publication: false
                    }
                }) : coll.updateOne({_id: object}, {$set: {quantity: product.quantity}})
        }
    }

    async function check_the_number_of_items(cart) {
        let coll = await Database.getCollection('products')
        let arrayOfSelectedProducts = [];
        for (let key in cart) {
            const object = new mongo.ObjectID(key);
            // let product = await coll.findOne({$and: [{_id: object}, {quantity: 1}]})
            let product1 = await coll.findOne({$and: [{_id: object}]})
            if (product1.quantity < cart[key]) {
                arrayOfSelectedProducts.push({key: key, quantity: product1.quantity})
            }
        }
        if (arrayOfSelectedProducts.length === 0) {         // всех товаров достаточно на складе
            return {enough: true};
        } else {
            return {enough: false, keysOfBrokenItems: arrayOfSelectedProducts}
        }
    }

})

mainScene.on('callback_query', async (ctx, next) => {
    try {
        let trigger = ctx.callbackQuery.data.split('|')[0]
        let requiredId = ctx.callbackQuery.data.split('|')[1];

        switch (trigger) {
            case 'MOREORDER': {
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

                await Order.edit({ctx, order: selectedOrder, trigger, obj: {message: message, coast: coast}})
                // await render(ctx, selectedOrder, trigger, true, false, {message: message, coast: coast})
                await ctx.answerCbQuery()
            }
                break;
            case 'LESSORDER': {
                let selectedOrder = await filterOutOrders(requiredId)
                await Order.edit({ctx, order: selectedOrder, trigger})
                await ctx.answerCbQuery()
            }
                break;
            case 'MORE': {
                let selectedProduct = await filterOutProducts(requiredId)
                await Product.editMessageWithProduct({ctx, product: selectedProduct, trigger})
                await ctx.answerCbQuery()
            }
                break;
            case 'LESS': {
                let selectedProduct = await filterOutProducts(requiredId);
                await Product.editMessageWithProduct({ctx, product: selectedProduct, trigger})
                // await render(ctx, selectedProduct, trigger, true)
                await ctx.answerCbQuery()
            }
                break;
            case 'BUY': {
                let selectedProduct = await filterOutProducts(requiredId);
                if (ctx.session.cart === undefined) {
                    ctx.session.cart = {};
                    ctx.session.cart[selectedProduct._id] = 1;
                } else {

                    if (ctx.session.cart[selectedProduct._id]) {
                        for (let item of ctx.scene.state.brands[ctx.scene.state.selectedBrand]) {
                            if (item._id == requiredId) {
                                if (item.quantity > ctx.session.cart[selectedProduct._id]) {
                                    ctx.session.cart[selectedProduct._id]++;
                                    await ctx.answerCbQuery(`${selectedProduct.title} - добавлено в корзину!`)
                                } else {
                                    await ctx.answerCbQuery(`Вы забираете последние ${ctx.session.cart[selectedProduct._id]} штуки. Товара больше нет!`)
                                }
                            }
                        }
                    } else {
                        ctx.session.cart[selectedProduct._id] = 1
                        await ctx.answerCbQuery(`${selectedProduct.title} - добавлено в корзину!`)
                    }

                }

                if (ctx.scene.state.totalMessage) {
                    await editTotalMessage(ctx);
                }
            }
                break;
            case 'CANCELORDER': {
                await ctx.answerCbQuery()
                let order = await Order.cancelOrder(requiredId);
                await ctx.editMessageText('Заказ отменен!')

                await Product.returnProductsToSclad(order.cart)
            }
                break;
            case '+': {
                let selectedProduct = await filterOutProducts(requiredId);
                console.log(selectedProduct)
                for (let item of ctx.scene.state.brands[ctx.scene.state.selectedBrand]) {
                    if (item._id == requiredId) {
                        if (selectedProduct.quantity > ctx.session.cart[selectedProduct._id]) {
                            ctx.session.cart[selectedProduct._id]++;
                            await ctx.answerCbQuery(`${selectedProduct.title} - добавлено в корзину!`)
                        } else {
                            await ctx.answerCbQuery(`Вы забираете последние ${ctx.session.cart[selectedProduct._id]} штуки. Товара больше нет!`)
                        }
                    }
                }
                await ctx.editMessageText(`${selectedProduct.title} \nКоличество: ${ctx.session.cart[selectedProduct._id]} - Стоимость ${await calculateThePrice(selectedProduct, ctx.session.cart)}Руб.`,
                    Markup.inlineKeyboard([
                        Markup.button.callback('+', '+|' + selectedProduct._id),
                        Markup.button.callback('-', '-|' + selectedProduct._id)

                    ])
                )
                await editTotalMessage(ctx);
                await ctx.answerCbQuery()
            }
                break;
            case '-': {
                let selectedProduct = await filterOutProducts(requiredId);
                ctx.session.cart[selectedProduct._id]--;
                if (ctx.session.cart[selectedProduct._id] <= 0) {
                    delete ctx.session.cart[selectedProduct._id];
                    await ctx.deleteMessage()
                } else {
                    await ctx.editMessageText(`${selectedProduct.title} \nКоличество: ${ctx.session.cart[selectedProduct._id]} - Стоимость ${await calculateThePrice(selectedProduct, ctx.session.cart)}Руб.`,
                        Markup.inlineKeyboard([
                            Markup.button.callback('+', '+|' + selectedProduct._id),
                            Markup.button.callback('-', '-|' + selectedProduct._id)

                        ])
                    )


                }
                await editTotalMessage(ctx);
                await ctx.answerCbQuery()
            }
                break;
            case 'CHOICE': {
                await deleteRenderedMessages(ctx)
                ctx.scene.state.selectedBrand = requiredId
                let brand = ctx.scene.state.brands[requiredId];
                for (let product of brand) {
                    if (product.publication === true) {
                        let cb = await Product.renderMessageWithProduct({ctx, product})
                        // let cb = await render(ctx, brand)
                        await addToRenderedMessages(ctx, cb);
                    }
                }
                setTimeout(() => {

                }, 60000)
                await ctx.answerCbQuery();
            }
                break;
            default: {
                next();
            }
                break;
        }
    } catch (e) {
        console.log('Ошибка в callback у пользователя ', e)
    }
})

// mainScene.on('text', async (ctx, next) => {
//     if (ctx.update.message.text === 'Отзывы' || ctx.update.message.text === 'Посмотреть ассортимент' || ctx.update.message.text === 'Контакты' || ctx.update.message.text === 'Мои заказы' || ctx.update.message.text === 'Корзина')
//         await ctx.scene.enter('MAIN_SCENE')
//     // if (ctx.update.message.text === '/start') return next()
// })


module.exports = {mainScene};
