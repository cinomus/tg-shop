const Order = require("../libs/models/Order");
const Product = require("../libs/models/Product");
const ObjectID = require("mongodb").ObjectID;
const {Scenes, Telegraf, Markup} = require('telegraf')
const {Database} = require('../session')

const {downloadFile, createProduct, parseXLSX, renderRequiredProductsFromExcel} = require('../supportFunctions')


const secondAddProduct = new Scenes.BaseScene('SECOND-SCENE-ADD-PRODUCT')
secondAddProduct.enter(async (ctx) => {
    await ctx.reply('Скиньте нужный файл боту.\n' +
        'В файле должна быть таблица из 5 столбцов в порядке: название, описание, бренд, цена, количество.\n' +
        'ПЕРВАЯ СТРОЧКА ТАБЛИЦЫ ПРОПУСКАЕТСЯ! В ней можете написать названия столбцов для удобства.\n' +
        'Если добавляете файл, ранее полученный от бота (вкладка "Статистика"), то товары, у которых есть поле id, будут изменены, а не добавлены еще раз.',
        Markup.keyboard([
            ['Выйти в админку']
        ]).resize()
    )
})
secondAddProduct.on('document', async (ctx)=>{
    let cb = await ctx.reply('Файл получен. Бот скачивает его с телеграмма...')
    ctx.scene.state.totalMessage = {id: cb.message_id, chatId: cb.chat.id}
    // ctx.scene.state.totalMessage.id = cb.message_id;
    // ctx.scene.state.totalMessage.chatId = cb.chat.id;
    let file = await ctx.telegram.getFile(ctx.update.message.document.file_id)
    await downloadFile(file);
    await ctx.telegram.editMessageText(ctx.scene.state.totalMessage.chatId, ctx.scene.state.totalMessage.id, [], 'Скачено. Разпознавание...')
    let data = await parseXLSX()
    let array = await createProduct(ctx, data)
    await ctx.telegram.editMessageText(ctx.scene.state.totalMessage.chatId, ctx.scene.state.totalMessage.id, [], 'Вывожу полученные товары...')
    await renderRequiredProductsFromExcel(ctx, array)

})
secondAddProduct.on('callback_query', async (ctx)=>{
    try {
        let trigger = ctx.callbackQuery.data.split('|')[0]
        let requiredId = ctx.callbackQuery.data.split('|')[1];
        switch (trigger) {
            case 'SAVE': {
                await ctx.answerCbQuery()
                // console.log(ctx.scene.state.RequiredProductsFromExcel)
                // const collection = await Database.getCollection('products')
                // await collection.insertOne(ctx.scene.state.RequiredProductsFromExcel[requiredId])
                if (ctx.scene.state.RequiredProductsFromExcel[requiredId]._id === undefined){
                    await Product.save(ctx.scene.state.RequiredProductsFromExcel[requiredId])
                    return await ctx.editMessageText('Сохранено!')
                }
                const collection = await Database.getCollection('products')
                const object = new ObjectID(ctx.scene.state.RequiredProductsFromExcel[requiredId]._id);
                let product = await collection.findOne({_id: object})
                if (product === null){
                    await Product.save(ctx.scene.state.RequiredProductsFromExcel[requiredId])
                    return await ctx.editMessageText('Сохранено!')
                }
                else {
                    await Product.edit(ctx.scene.state.RequiredProductsFromExcel[requiredId])
                    return await ctx.editMessageText('Изменено!')
                }

            }
                break;
        }
    }
    catch (e) {
        console.log(e)
    }
})

secondAddProduct.hears('Выйти в админку', async (ctx) => {
    await ctx.scene.enter('ADMIN_PANEL')
})

module.exports = {secondAddProduct}