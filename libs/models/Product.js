const {Scenes, Markup} = require('telegraf')
const mongo = require('mongodb');

const {Database} = require('../../session');

class Product {
    static collection

    static async save(product) {
        try {
            if (!Product.collection) {
                Product.collection = await Database.getCollection('products')
            }
            await Product.collection.insertOne(product)
        } catch (e) {
            console.log(e)
        }
    }
    static async edit(product) {
        try {
            if (!Product.collection) {
                Product.collection = await Database.getCollection('products')
            }
            const object = new mongo.ObjectID(product._id);
            delete product._id;
            await Product.collection.updateOne(
                {_id: object}, // критерий выборки
                { $set: product}
            )
            console.log('updated')
        } catch (e) {
            console.log(e)
        }
    }

    static async returnProductsToSclad(orderCart) {
        if (!Product.collection) {
            Product.collection = await Database.getCollection('products')
        }
        for (let key in orderCart) {
            const objectId = new mongo.ObjectID(key);
            let product = await Product.collection.findOne(
                {_id: objectId} // критерий выборки
            )
            Product.collection.updateOne({_id: objectId}, {$set: {quantity: product.quantity + orderCart[key]}})
        }
    }

    static async createMessage({product, trigger, admin}) {
        try {
            let message = '';
            if (admin) {
                message = `${product.title}\n${product.description}\nСтоимость: ${product.cost}Руб.\nКоличество: ${product.quantity}`

            } else {
                if (trigger === undefined || trigger === 'LESS') {
                    message = `${product.title} - ${product.cost}Руб.`
                } else if (trigger === 'MORE') {
                    message = `${product.title}\n\n${product.description}\nСтоимость: ${product.cost}руб.`
                }
            }
            return message
        } catch (e) {
            throw new Error('Ошибка при создании текста сообщения товара!')
        }

    }

    static async createButtons({product, trigger, admin}) {
        try {
            let buttons = [];
            if (admin) {
                buttons = [
                    [
                        Markup.button.callback('Изменить', 'EDIT|' + product._id),
                        Markup.button.callback('Удалить', 'DELETE|' + product._id)
                    ],
                    [
                        product.publication === true ?
                            Markup.button.callback('Снять с публикации', 'REMOVE_FROM_PUBLICATION|' + product._id) :
                            Markup.button.callback('Опубликовать', 'ADD_TO_PUBLICATION|' + product._id)
                    ]
                ]
            } else {
                if (trigger === undefined || trigger === 'LESS') {
                    buttons = [
                        Markup.button.callback('Подробнее', 'MORE|' + product._id),
                        Markup.button.callback('Купить', 'BUY|' + product._id)
                    ]
                } else if (trigger === 'MORE') {
                    buttons = [
                        Markup.button.callback('Назад', 'LESS|' + product._id),
                        Markup.button.callback('Купить', 'BUY|' + product._id)
                    ]
                }
            }
            return buttons
        } catch (e) {
            throw new Error('Ошибка при создании кнопок сообщения товара!')
        }
    }

    static async renderMessageWithProduct({ctx, product, trigger, admin = false}) {
        try {
            let message = await this.createMessage({product, trigger, admin})
            let buttons = await this.createButtons({product, trigger, admin})
            return ctx.reply(
                message,
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard(buttons)
                }
            );
        } catch (e) {
            throw new Error('Ошибка при отрисовке сообщения товара!')
        }

    }

    static async editMessageWithProduct({ctx, product, trigger, admin = false}) {
        try {
            let message = await this.createMessage({product, trigger, admin})
            let buttons = await this.createButtons({product, trigger, admin})
            return ctx.editMessageText(
                message,
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard(buttons)
                }
            )
        } catch (e) {
            throw new Error('Ошибка при перерисовке сообщения товара!')
        }
    }

    static async removeFromPublication({ctx, id}) {
        try {
            if (!Product.collection) {
                Product.collection = await Database.getCollection('products')
            }

            const object = new mongo.ObjectID(id);
            let product = await Product.collection.findOne({_id: object})
            await Product.collection.updateOne({_id: object}, {$set: {'publication': false}})
            await ctx.editMessageText(`${product.title} - ${product.cost}Руб.\nКоличество: ${product.quantity}`,
                Markup.inlineKeyboard([
                    [
                        Markup.button.callback('Изменить', 'EDIT|' + product._id),
                        Markup.button.callback('Удалить', 'DELETE|' + product._id)
                    ],
                    [
                        Markup.button.callback('Опубликовать', 'ADD_TO_PUBLICATION|' + product._id)
                    ]
                ])
            )
        } catch (e) {
            console.log(e)
        }

    }

    static async addToPublication({ctx, id}) {
        try {
            if (!Product.collection) {
                Product.collection = await Database.getCollection('products')
            }
            const object = new mongo.ObjectID(id);
            let product = await Product.collection.findOne({_id: object})
            if (product.quantity === 0) {
                await ctx.answerCbQuery()
                return await ctx.editMessageText(`${product.title} - ${product.cost}Руб.\nКОЛИЧЕСТВО: ${product.quantity}`,
                    Markup.inlineKeyboard([
                        [
                            Markup.button.callback('Изменить', 'EDIT|' + product._id),
                            Markup.button.callback('Удалить', 'DELETE|' + product._id)
                        ]
                    ])
                )

            }
            await Product.collection.updateOne({_id: object}, {$set: {'publication': true}})
            await ctx.editMessageText(`${product.title} - ${product.cost}Руб.\nКоличество: ${product.quantity}`,
                Markup.inlineKeyboard([
                    [
                        Markup.button.callback('Изменить', 'EDIT|' + product._id),
                        Markup.button.callback('Удалить', 'DELETE|' + product._id)
                    ],
                    [
                        Markup.button.callback('Снять с публикации', 'REMOVE_FROM_PUBLICATION|' + product._id)
                    ]
                ])
            )
        } catch (e) {
            console.log(e)
        }
    }

//    строки которые больше не нужны, их нужно перенести в контроллер
//    delete ctx.session.product;
//         await ctx.editMessageText('Сохранено!')
//         return await ctx.scene.enter('ADMIN_PANEL');
//
}

module.exports = Product;