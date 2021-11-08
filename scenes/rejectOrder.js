const {Scenes, Telegraf, Markup} = require('telegraf')
const {Database} = require('../session')
const mongo = require('mongodb');
const Order = require("../libs/models/Order");
const {rejectOrder, addToRenderedMessages, deleteRenderedMessages} = require('../supportFunctions')


const rejectOrderScene = new Scenes.WizardScene('REJECT_ORDER',
    async (ctx)=>{
        let cb = await ctx.reply(`Причина отклонения заказа: `, Markup.keyboard(['Отмена']).resize())
        await addToRenderedMessages(ctx, cb);
        await ctx.wizard.next();
    },
    async (ctx)=>{
        await deleteRenderedMessages(ctx)       // для того чтобы удалить предудещее сообщение бота
        await ctx.deleteMessage();              //для того чтобы удалить сообщение пользователя
        await Order.rejectOrder(ctx.scene.state.id, ctx.message.text)
        await ctx.reply('Заказ отклонен.')
        await ctx.scene.enter('ADMIN_PANEL')
    }
);
rejectOrderScene.hears('Отмена', async (ctx) => {
    await ctx.scene.enter('ADMIN_PANEL')
})
module.exports = {rejectOrderScene}