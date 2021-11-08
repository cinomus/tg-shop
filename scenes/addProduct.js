const Product = require("../libs/models/Product");
const {Scenes, Telegraf, Markup} = require('telegraf')
const {Database} = require('../session')



const addProduct = new Scenes.WizardScene('ADD_PRODUCT',
    async (ctx) => {
        await ctx.reply('Название: ',
            Markup.keyboard(['Отмена'])
                .resize()
        )
        return ctx.wizard.next();
    },
    async (ctx) => {
        if (ctx.session.product !== undefined) {
            await ctx.reply(`Предыдущее описание: ${ctx.session.product.description}\nНовое описание:`)
        } else {
            ctx.session.product = {}
            ctx.session.product.title = ctx.message.text
            await ctx.reply('Описание: ')
        }
        return ctx.wizard.next();
    },
    async (ctx) => {
        ctx.session.product.description = ctx.message.text
        if (ctx.session.product.brand !== undefined) {
            await ctx.reply(`Предыдущий бренд: ${ctx.session.product.brand}\nНовое название:`)
        } else {
            await ctx.reply('Бренд: ')
        }
        return ctx.wizard.next();
    },
    async (ctx) => {
        ctx.session.product.brand = ctx.message.text.toUpperCase()
        if (ctx.session.product.quantity !== undefined) {
            await ctx.reply(`Предыдущее количество: ${ctx.session.product.quantity}\nНовое количество:`)
        } else {
            await ctx.reply('Количество: ')
        }
        return ctx.wizard.next();
    },
    async (ctx) => {
        if (isNaN(+ctx.message.text)) {
            await ctx.reply('Введите число!');
        } else {
        ctx.session.product.quantity = +ctx.message.text
        if (ctx.session.product.cost !== undefined) {
            await ctx.reply(`Предыдущая стоимость: ${ctx.session.product.cost}\nНовая стоимость:`)
        } else {
            await ctx.reply('Стоимость: ')
        }
        return ctx.wizard.next();
        }
    },


    async (ctx) => {
        if (isNaN(+ctx.message.text)) {
            await ctx.reply('Введите число!');
        } else {
            ctx.session.product.cost = +ctx.message.text
            if (ctx.session.product.quantity !== 0){
                ctx.session.product.publication = true
            }

            await ctx.reply(`${ctx.session.product.title} \nБренд: ${ctx.session.product.brand}\nКоличество: ${ctx.session.product.quantity} \n${ctx.session.product.description} \nСтоимость: ${ctx.session.product.cost}руб`,
                Markup.inlineKeyboard(
                    [
                        Markup.button.callback('Сохранить', 'SAVE'),
                        Markup.button.callback('Отменить', 'CANCEL'),
                    ]
                ))
        }
    }
);


addProduct.action('SAVE', async (ctx) => {
    await ctx.answerCbQuery()
    await Product.save(ctx.session.product)
    delete ctx.session.product;
    await ctx.editMessageText('Сохранено!')
    return await ctx.scene.enter('ADMIN_PANEL');
})


addProduct.action('CANCEL', async (ctx) => {
    await ctx.answerCbQuery()
    ctx.reply(`Предыдущее название: ${ctx.session.product.title}\nНовое название:`)
    return ctx.wizard.selectStep(1)
})


addProduct.hears('Отмена', async (ctx) => {
    delete ctx.session.product;
    await ctx.scene.enter('ADMIN_PANEL')
})


module.exports = {addProduct}