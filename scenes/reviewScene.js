const {Scenes, Telegraf, Markup} = require('telegraf')
const {Database} = require('../session')
const mongo = require('mongodb');
const {addZero, addToRenderedMessages, deleteRenderedMessages} = require('../supportFunctions')

const reviewScene = new Scenes.BaseScene('REVIEW_SCENE')
reviewScene.enter(async (ctx) => {
    const collection = await Database.getCollection('reviews')
    let reviews = await collection.find().toArray() // ??? Возможно потом надо будет ограничить колличество отображаемых отзывов
    await ctx.reply('Здесь собраны все отзывы ПОКУПАТЕЛЕЙ о нас:', Markup.keyboard(['✅ Добавить отзыв', '↪ Назад']).resize())

    for await (let review of reviews) {
        await ctx.reply(`${review.sender.first_name}   <code>${await addZero(review.date.getDate())}.${await addZero(review.date.getMonth() + 1)}.${review.date.getFullYear()}</code>\n\n<em>${review.text}</em>`, {parse_mode:'HTML'})

    }
})
reviewScene.hears('↪ Назад', async (ctx) => {
    await ctx.scene.enter('MAIN_SCENE')
})

reviewScene.hears('✅ Добавить отзыв', async (ctx) => {
    if (await orderChecker(ctx.update.message.from.id) === false) {
        return ctx.reply('Вы не сделали еще ни одного заказа!')
    }
    await ctx.scene.enter('REVIEW_ADD_SCENE')
})

const reviewAddScene = new Scenes.WizardScene('REVIEW_ADD_SCENE',
    async (ctx) => {
        let cb = await ctx.reply(`Напишите, пожалуйста, свои впечатления и пожелания: `, Markup.keyboard(['🚫 Отмена']).resize())
        await addToRenderedMessages(ctx, cb);
        await ctx.wizard.next();
    },
    async (ctx) => {
        let review = {}
        review.text = ctx.update.message.text
        review.sender = ctx.update.message.from
        review.date = new Date();
        // await deleteRenderedMessages(ctx)       // для того чтобы удалить предудещее сообщение бота
        // await ctx.deleteMessage();              //для того чтобы удалить сообщение пользователя
        await addReview(review)
        await ctx.reply('Спасибо за отзыв!)')
        await ctx.scene.enter('REVIEW_SCENE')
    }
);
reviewAddScene.hears('🚫 Отмена', async (ctx) => {
    await ctx.scene.enter('REVIEW_SCENE')
})

async function addReview(obj) {
    const collection = await Database.getCollection('reviews')
    await collection.insertOne(obj)

}
async function orderChecker(id){
    const collection = await Database.getCollection('orders')
    let orders = await collection.find({'user.id': id}).toArray()
    return orders.length > 0;
}

module.exports = {reviewScene, reviewAddScene}