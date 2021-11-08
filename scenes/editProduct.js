const {Scenes, Telegraf, Markup} = require('telegraf')
const {Database} = require('../session')
const mongo = require('mongodb');
const Product = require("../libs/models/Product");



const editProduct = new Scenes.WizardScene('EDIT_PRODUCT',
    async (ctx) => {
        await ctx.reply(`Предыдущее название: ${ctx.scene.state.productToEdit.title}\nНовое название:`, Markup.keyboard(['Пропустить', 'Отмена']).resize())
        await ctx.wizard.next();
    },
    async (ctx) => {
        if (ctx.message.text !== 'Пропустить') ctx.scene.state.productToEdit.title = ctx.message.text

        await ctx.reply(`Предыдущее описание: ${ctx.scene.state.productToEdit.description}\nНовое описание:`)
        return ctx.wizard.next();
    },
    async (ctx) => {
        if (ctx.message.text !== 'Пропустить') ctx.scene.state.productToEdit.description = ctx.message.text
        if (ctx.scene.state.productToEdit.brand !== undefined) {
            await ctx.reply(`Предыдущий бренд ${ctx.scene.state.productToEdit.brand}\nНовое название:`)
        } else {
            await ctx.reply('Бренд: ')
        }
        return ctx.wizard.next();
    },
    async (ctx) => {
        if (ctx.message.text !== 'Пропустить') ctx.scene.state.productToEdit.quantity = +ctx.message.text
        if (ctx.scene.state.productToEdit.quantity !== undefined) {
            await ctx.reply(`Предыдущее количество ${ctx.scene.state.productToEdit.quantity}\nНовое количество:`)
        } else {
            await ctx.reply('Количество: ')
        }
        return ctx.wizard.next();
    },
    async (ctx) => {
        if (ctx.message.text !== 'Пропустить') {
            if (isNaN(+ctx.message.text )) {
                await ctx.reply('Введите число!');
            } else {
                if (+ctx.message.text < 0) await ctx.reply('Введите число больше, либо равное 0!');
                else {
                    ctx.scene.state.productToEdit.quantity = ctx.message.text
                    await ctx.reply(`Предыдущая стоимость: ${ctx.scene.state.productToEdit.cost}\nНовая стоимость:`)
                    return ctx.wizard.next();
                }
            }
        }
        else {
            await ctx.reply(`Предыдущая стоимость: ${ctx.scene.state.productToEdit.cost}\nНовая стоимость:`)
            return ctx.wizard.next();
        }
    },
    async (ctx) => {
        if (ctx.message.text === 'Пропустить') {
            return await ctx.reply(`${ctx.scene.state.productToEdit.title}\nБренд: ${ctx.scene.state.productToEdit.brand}\nКоличество: ${ctx.scene.state.productToEdit.quantity}\nСтоимость: ${ctx.scene.state.productToEdit.cost}руб`,
                Markup.inlineKeyboard(
                    [
                        Markup.button.callback('Сохранить', 'SAVE'),
                        Markup.button.callback('Отменить', 'CANCEL'),
                    ]
                )
            )
        }
        if (isNaN(+ctx.message.text )) {
            await ctx.reply('Введите число!');
        } else {
            if (+ctx.message.text < 0) await ctx.reply('Введите число больше, либо равное 0!');
            else {
                if (ctx.message.text !== 'Пропустить') ctx.scene.state.productToEdit.cost = +ctx.message.text
                return await ctx.reply(`${ctx.scene.state.productToEdit.title}\n${ctx.scene.state.productToEdit.description}\nБренд: ${ctx.scene.state.productToEdit.brand}\nКоличество: ${ctx.scene.state.productToEdit.quantity}\n${ctx.scene.state.productToEdit.description}\nСтоимость: ${ctx.scene.state.productToEdit.cost}руб`,
                    Markup.inlineKeyboard(
                        [
                            Markup.button.callback('Сохранить', 'SAVE'),
                            Markup.button.callback('Отменить', 'CANCEL'),
                        ]
                    )
                )
            }
        }

    }
);

editProduct.action('SAVE', async (ctx) => {
    await ctx.answerCbQuery()
    await Product.edit(ctx.scene.state.productToEdit)
    delete ctx.scene.state.productToEdit;
    await ctx.editMessageText('Сохранено!')
    return await ctx.scene.enter('ADMIN_PANEL');
})

editProduct.action('CANCEL', async (ctx) => {
    delete ctx.scene.state.productToEdit;
    await ctx.scene.enter('ADMIN_PANEL')
    await ctx.answerCbQuery()
})

editProduct.hears('Отмена', async (ctx) => {
    delete ctx.scene.state.productToEdit;
    await ctx.scene.enter('ADMIN_PANEL')
})


module.exports = {editProduct}