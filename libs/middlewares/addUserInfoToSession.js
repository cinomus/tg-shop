const ReferralSystem = require("../modules/referralSystem");
const {StatisticOfDay} = require("../modules/statistic");

module.exports = function addUserInfoToSession() {
    return async (ctx, next) => {
        try {
            if (ctx.session.user === undefined) { //new user
                ctx.session.user = ctx.update.message.from
                ctx.session.user.referrals = [];
                await StatisticOfDay.addNewUser();
                // await ReferralSystem.linkCheck(ctx)
            }
            else {  // old user
                if (ctx.session.user.hasOwnProperty('referral') === false){
                    ctx.session.user.referral = false;
                }
            }
            await next()
        }
        catch (e) {
            console.log(e)
        }
    }

}
//https://t.me/bigDaddylul_bot?start=449717342