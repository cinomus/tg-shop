const {StatisticOfDay} = require('../modules/statistic')
const {Database} = require('../../session')

module.exports = function detectNewUser() {
    return async (ctx, next) => {
        try {
            let collection = await Database.getCollection('sessions')
            // console.log(ctx.update.message !== undefined? ctx.update.message.from.id : ctx.update.callback_query.from.id)
            let id = ctx.update.message !== undefined ? ctx.update.message.from.id : ctx.update.callback_query.from.id
            let sessionOfUser = await collection.findOne({'data.user.id': id})
            if (sessionOfUser === null) {
                await StatisticOfDay.addNewUser();
            }
            await next();
        }
        catch (e) {
            console.log(e)
        }
    }

}