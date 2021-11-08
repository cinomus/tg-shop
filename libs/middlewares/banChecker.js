module.exports = function banChecker() {
    return async (ctx, next) => {
        if (ctx.session.banned === undefined) ctx.session.banned = false;
        if (ctx.session.banned === true) {
            return ctx.reply('Вы заблокированы!')
        }
        if (ctx.session.banned === false) {
            await next()
        }
    }

}