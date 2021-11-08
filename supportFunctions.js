const {Scenes, Markup} = require('telegraf')
const {Database} = require('./session');
const mongo = require('mongodb');
const xlsx = require('node-xlsx');
const fs = require('fs')
const https = require('https')
const config = require('config')

async function blockUser(ctx, id) {
    try {
        const collection = await Database.getCollection('sessions')
        await collection.findOneAndUpdate({key: `${id}:${id}`}, {$set: {'data.banned': true}})
        await ctx.reply('Пользователь заблокирован!')
    } catch (e) {
        console.log(e)
    }
}


async function filterOutOrders(id) {
    try {
        const collection = await Database.getCollection('orders')
        const object = new mongo.ObjectID(id);
        return await collection.findOne({_id: object})
    } catch (e) {
        console.log(e)
    }

}

async function filterOutProducts(id) {
    try {
        const collection = await Database.getCollection('products')
        const object = new mongo.ObjectID(id);
        return await collection.findOne({_id: object})
    } catch (e) {
        console.log(e)
    }

}


async function calculateThePrice(product, cart) {
    return +product.cost * +cart[product._id];
}

async function editTotalMessage(ctx) {
    await calculateCostOfAll(ctx)
    if (ctx.scene.state.totalMessage.value === 0) {
        await ctx.telegram.editMessageText(ctx.scene.state.totalMessage.chatId, ctx.scene.state.totalMessage.id, [], `Корзина пуста!`)
    } else {
        await ctx.telegram.editMessageText(ctx.scene.state.totalMessage.chatId, ctx.scene.state.totalMessage.id, [], `Общая стоимость: ${ctx.scene.state.totalMessage.value}Руб.`, Markup.inlineKeyboard([
            Markup.button.callback('Заказать', 'ORDER')
        ]))
    }
}

async function calculateCostOfAll(ctx) {
    let cost = 0;
    for (let key in ctx.session.cart) {
        let product = await filterOutProducts(key);
        cost += await calculateThePrice(product, ctx.session.cart)
    }
    ctx.scene.state.totalMessage.value = cost;
}

async function addToRenderedMessages(ctx, cb) {
    if (ctx.scene.state.renderedMessages === undefined) {
        ctx.scene.state.renderedMessages = [];
    }
    await ctx.scene.state.renderedMessages.push({chatId: cb.chat.id, messageId: cb.message_id})
}

async function deleteRenderedMessages(ctx, deleteLastMes = true) {
    // console.log('delete last mess11',ctx.scene.state.renderedMessages, deleteLastMes)
    if (ctx.scene.state.renderedMessages === undefined) {
        ctx.scene.state.renderedMessages = [];
    }
    let num = 0;
    for (let key in ctx.scene.state.renderedMessages) {
        if (deleteLastMes === true) {
            try {
                // console.log('deleteMessage', ctx.scene.state.renderedMessages[key].chatId, ctx.scene.state.renderedMessages[key].messageId)
                await ctx.telegram.deleteMessage(ctx.scene.state.renderedMessages[key].chatId, ctx.scene.state.renderedMessages[key].messageId)
            } catch (e) {
                console.log('Ошибка при удалении сообщения в телеграмм(не критично)')
            }
        } else {
            // console.log('delete last mess',ctx.scene.state.renderedMessages)
            if (+key !== ctx.scene.state.renderedMessages.length - 1) {
                try {
                    await ctx.telegram.deleteMessage(ctx.scene.state.renderedMessages[key].chatId, ctx.scene.state.renderedMessages[key].messageId)
                    num++

                } catch (e) {
                    console.log('error', e)
                }

            }
        }
    }
    ctx.scene.state.renderedMessages.splice(0, num);
    if (deleteLastMes === true) ctx.scene.state.renderedMessages = [];

}


async function addZero(value) {
    if (value < 10) {
        value = `0${value}`
    }
    return value
}

async function sort(array) {
    let canceled = 0;
    let rejected = 0;
    let completed = 0;
    for (let item of array) {
        if (item.status === 'completed') completed++
        if (item.status === 'rejected') rejected++
        if (item.status === 'canceled') canceled++
    }

    return {canceled: canceled, rejected: rejected, completed: completed}

}

async function downloadFile(file) {
    return new Promise(((resolve, reject) => {
        let token = config.get('BOT_TOKEN')
        let url = `https://api.telegram.org/file/bot${token}/${file.file_path}`
        let downloadedFile = fs.createWriteStream(__dirname + '/downloads/file.xlsx')
        let request = https.get(url, function (response) {
            response.pipe(downloadedFile);
            downloadedFile.on('finish', function () {
                console.log('finish')
                downloadedFile.close()
                resolve()
            })
        }).on('error', function (err) {
            fs.unlink(__dirname, '../downloads')
            console.log(err)
        })
    }))

}

async function createXLSX() {
    const arrayOfProducts = await getArrayOfProductsFromDB();
    const data = await objectsFromDBToElemOfArray(arrayOfProducts);
    let buffer = xlsx.build([{name: "list1", data: data}])
    let writeStream = fs.createWriteStream("./created_files/file.xlsx");

    writeStream.write(buffer);

    async function getArrayOfProductsFromDB() {
        try {
            const collection = await Database.getCollection('products')
            return await collection.find({}).toArray()

        } catch (e) {
            console.log(e)
        }
    }

    // преобразует [{},{}] в [[],[]]
    async function objectsFromDBToElemOfArray(ArrayOfProducts) {
        let array = []
        array[0] = [
            'Название',
            'Описание',
            'Бренд',
            'Цена',
            'Количество',
            'Опубликовано',
            'id'
        ]
        let index = 1;
        for (let product of ArrayOfProducts) {
            array[index] = [
                product.title,
                product.description,
                product.brand,
                product.cost,
                product.quantity,
                product.publication,
                product._id
            ]
            index++;
        }
        return array
    }
}

async function parseXLSX() {
    const workSheetsFromFile = xlsx.parse(`${__dirname}/downloads/file.xlsx`);
    return workSheetsFromFile[0].data;
}

async function createProduct(ctx, productsFromExcel) {
    let arrayOfProducts = []
    let index = 0;
    for (let product of productsFromExcel) {
        if (index === 0) {
            index++
            continue
        }
        let productToSave = {
            title: product[0],
            description: product[1],
            brand: product[2].toUpperCase(),
            cost: +product[3],
            quantity: +product[4],
            publication: product[4] > 0,
        }
        product[5] ? productToSave.publication = product[5] : productToSave.publication = product[4] > 0
        if (product[6]) productToSave._id = product[6];
        arrayOfProducts.push(productToSave)
        index++;
    }
    return arrayOfProducts
}

async function renderRequiredProductsFromExcel(ctx, arrayOfProducts) {
    let index = 0;
    ctx.scene.state.RequiredProductsFromExcel = arrayOfProducts;
    for (let product of ctx.scene.state.RequiredProductsFromExcel) {
        let cb = await ctx.reply(`${product.title} \nБренд: ${product.brand}\nКоличество: ${product.quantity} \n${product.description} \nСтоимость: ${product.cost}руб`,
            Markup.inlineKeyboard(
                [
                    Markup.button.callback('Сохранить', 'SAVE|' + index),
                ]
            ))
        index++;
        await addToRenderedMessages(ctx, cb)
    }

}

async function render_cart({ctx, brokenProducts}) {
    let costOfAll = 0
    await deleteRenderedMessages(ctx)
    for (let key in ctx.session.cart) {
        let renderedProduct = await filterOutProducts(key);
        let defaultMessage = `${renderedProduct.title} \nКоличество: ${ctx.session.cart[key]} - Стоимость ${await calculateThePrice(renderedProduct, ctx.session.cart)}Руб.`
        let defaultButtons = [
            Markup.button.callback('+', '+|' + key),
            Markup.button.callback('-', '-|' + key)

        ];
        if (brokenProducts) {
            let result = brokenProducts.filter(async (item) => {
                if (item.key === key) {
                    const collection = await Database.getCollection('products')
                    const object = new mongo.ObjectID(item.key);
                    return await collection.findOne({_id: object})
                }
            })
            if (result.length !== 0) {
                if (result[0].quantity !== 0) {
                    ctx.session.cart[key] = result[0].quantity
                    defaultMessage = `Упс! Видимо кто-то успел приобрести товар до вас!\nДоступное количество ${renderedProduct.title} - ${ctx.session.cart[key]} стоимостью ${await calculateThePrice(renderedProduct, ctx.session.cart)}Руб.`

                } else {
                    delete ctx.session.cart[key]
                    defaultMessage = `Упс!\n Видимо кто-то успел приобрести ${renderedProduct.title} до вас. \nВыберите что-нибудь другое.`
                    defaultButtons = []
                }


            }
        }

        if (ctx.session.cart[renderedProduct._id]) {
            costOfAll += await calculateThePrice(renderedProduct, ctx.session.cart);
        }

        let cb = await ctx.reply(defaultMessage,
            Markup.inlineKeyboard(defaultButtons).resize()
        )
        await addToRenderedMessages(ctx, cb);
    }

    if (costOfAll === 0) {
        await ctx.reply(`Корзина пуста!`)
    } else {
        let cb = await ctx.reply(`Общая стоимость: ${costOfAll}Руб.`, Markup.inlineKeyboard([
            Markup.button.callback('Заказать', 'ORDER')
        ]))
        if (ctx.scene.state.totalMessage === undefined) {
            ctx.scene.state.totalMessage = {};
        }
        await addToRenderedMessages(ctx, cb);
        ctx.scene.state.totalMessage.id = cb.message_id;
        ctx.scene.state.totalMessage.chatId = cb.chat.id;
        ctx.scene.state.totalMessage.value = costOfAll;
    }
    return costOfAll
}


module.exports = {
    sort,
    createXLSX,
    render_cart,
    blockUser,
    addZero,
    filterOutOrders,
    filterOutProducts,
    calculateCostOfAll,
    calculateThePrice,
    editTotalMessage,
    addToRenderedMessages,
    deleteRenderedMessages,
    downloadFile,
    parseXLSX,
    createProduct,
    renderRequiredProductsFromExcel
}