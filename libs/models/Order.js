const {Scenes, Markup} = require('telegraf')
const mongo = require('mongodb');
const {addZero} = require("../../supportFunctions");

const {Database} = require('../../session');

class Order {
    static collection

    static async save(order) {
        try {
            if (!Order.collection) {
                Order.collection = await Database.getCollection('orders')
            }
            await Order.collection.insertOne(order)
        } catch (e) {
            console.log(e)
        }
    }

    static async endOrder({ctx, id}) {
        try {
            if (!Order.collection) {
                Order.collection = await Database.getCollection('orders')
            }

            const object = new mongo.ObjectID(id);
            return await Order.collection.findOneAndUpdate(
                {_id: object}, // критерий выборки
                {$set: {status: 'completed'}}
            )


        } catch (e) {
            console.log(e)
        }
    }

    static async rejectOrder(id, reason) {
        try {
            if (!Order.collection) {
                Order.collection = await Database.getCollection('orders')
            }
            const object = new mongo.ObjectID(id);
            return await Order.collection.findOneAndUpdate(
                {_id: object}, // критерий выборки
                {$set: {status: 'rejected', reason: reason}}
            )
        } catch (e) {
            console.log(e)
        }
    }

    static async cancelOrder(id) {
        try {
            const collection = await Database.getCollection('orders')
            const object = new mongo.ObjectID(id);
            return await collection.findOneAndUpdate(
                {_id: object}, // критерий выборки
                {$set: {status: 'canceled'}}
            )
        }
        catch (e) {
            console.log(e)
        }
    }

    static async determineStatus(order) {
        let index;
        let status;
        switch (order.status) {
            case 'completed': {
                index = '✅ ';
                status = `Статус заказа: ${index}Завершен`
            }
                break;
            case 'canceled': {
                index = '❌ ';
                status = `Статус заказа: ${index}Отменен пользователем`
            }
                break;
            case 'rejected': {
                index = '⛔ ';
                status = `Статус заказа: ${index}Отклонен\nПричина: ${order.reason}`
            }
                break;
            case 'in process': {
                index = '🔄 ';
                status = `Статус заказа: ${index}Обрабатывается`
            }
                break;
            case undefined: {
                index = '';
                status = `Статус заказа: Неизвестен`
            }
                break;
        }
        return {index, status}
    }

    static async createButtons({order, trigger, admin}) {
        try {
            let buttons = [];
            if (admin) {
                if (trigger === undefined || trigger === 'LESS') {
                    buttons = [Markup.button.callback('Подробнее', 'MORE|' + order._id)]
                } else if (trigger === 'MORE') {
                    if (order.status === 'completed' || order.status === 'rejected' || order.status === 'canceled') {
                        buttons = [
                            Markup.button.callback('Назад', 'LESS|' + order._id),
                            Markup.button.callback('Профиль', 'PROFILE|' + order.user.id)
                        ]
                    } else {
                        buttons = [[
                            Markup.button.callback('Назад', 'LESS|' + order._id),
                            Markup.button.callback('Завершить', 'END|' + order._id),
                            Markup.button.callback('Отклонить', 'REJECT|' + order._id)
                        ],
                            [
                                Markup.button.callback('Заблокировать', 'BLOCK|' + order.user.id),
                                Markup.button.callback('Профиль', 'PROFILE|' + order.user.id)
                            ]

                        ]
                    }
                }
            } else {
                if (trigger === undefined || trigger === 'LESSORDER') {
                    buttons = [
                        Markup.button.callback('Подробнее', 'MOREORDER|' + order._id)
                    ]
                } else if (trigger === 'MOREORDER') {
                    if (order.status === 'completed' || order.status === 'rejected' || order.status === 'canceled') {
                        buttons = [
                            Markup.button.callback('Назад', 'LESSORDER|' + order._id)
                        ]
                    } else {
                        buttons = [
                            Markup.button.callback('Назад', 'LESSORDER|' + order._id),
                            Markup.button.callback('Отменить', 'CANCELORDER|' + order._id)
                        ]
                    }
                }
            }
            return buttons;
        } catch (e) {
            throw new Error('Ошибка при создании КНОПОК сообщения заказа!')
        }
    }

    static async createMessage({order, trigger, admin, index, status, obj}) {
        try {
            let message;
            if (admin) {
                if (trigger === undefined || trigger === 'LESS') {
                    message = index + `Заказ ${order._id} от <b>${await addZero(order.date.getDate())}-${await addZero(order.date.getMonth() + 1)}-${order.date.getFullYear()}  ${await addZero(order.date.getHours())}:${await addZero(order.date.getMinutes())}</b>`
                } else if (trigger === 'MORE') {
                    message = obj.message + status + `\nПользователь: <a href="tg:user?id=${order.user.id}">Ссылка</a>\nОбщая стоимость: ${obj.coast}Руб.\n<b>Дата заказа: ${await addZero(order.date.getDate())}-${await addZero(order.date.getMonth() + 1)}-${order.date.getFullYear()}  ${await addZero(order.date.getHours())}:${await addZero(order.date.getMinutes())}</b>`
                }
            } else {
                if (trigger === undefined || trigger === 'LESSORDER') {
                    message = index + `Заказ от <b>${await addZero(order.date.getDate())}-${await addZero(order.date.getMonth() + 1)}-${order.date.getFullYear()}  ${await addZero(order.date.getHours())}:${await addZero(order.date.getMinutes())}</b>`
                } else if (trigger === 'MOREORDER') {
                    message = obj.message + status + `\nОбщая стоимость: ${obj.coast}Руб.\n<b>Дата заказа: ${await addZero(order.date.getDate())}-${await addZero(order.date.getMonth() + 1)}-${order.date.getFullYear()}  ${await addZero(order.date.getHours())}:${await addZero(order.date.getMinutes())}</b>`
                }
            }
            return message;
        } catch (e) {
            throw new Error('Ошибка при создании текста сообщения заказа!')
        }
    }

    static async render({ctx, order, trigger, admin = false, obj}) {
        try {
            let {index, status} = await this.determineStatus(order)
            // console.log('index ',index, 'status ', status,'order ', order,'admin ', admin,'obj ', obj)
            let message = await this.createMessage({order, trigger, admin, index, status, obj})
            let buttons = await this.createButtons({order, admin, trigger})
            return await ctx.reply(
                message,
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard(buttons)
                }
            );
        } catch (e) {
            console.log(e)
            throw new Error('Ошибка при отрисовке сообщения заказа!')

        }
    }

    static async edit({ctx, order, trigger, admin = false, obj}) {
        try {
            let {index, status} = await this.determineStatus(order)
            let message = await this.createMessage({order, trigger, admin, index, status, obj})
            let buttons = await this.createButtons({order, trigger, admin})
            return ctx.editMessageText(
                message,
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard(buttons)
                }
            )
        } catch (e) {
            throw new Error('При перерисовке сообщения заказа!')
        }
    }
}

module.exports = Order;