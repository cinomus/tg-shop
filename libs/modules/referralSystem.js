const {Database} = require('../../session');



/*
генератор ссылки
проверка ссылки при старте

определение реферала
добавление реферала
рассчет скидки ?
 */
class ReferralSystem {
    static refS = true;
    static async generateLink(ctx){
        return `https://t.me/${ctx.botInfo.username}?start=${ctx.session.user.id}`
    }

    static async linkCheck(ctx){
        // в функцию приходят ТОЛЬКО новые юзеры
        const commandStart = ctx.update?.message.text.split(' ')[0];
        const startPayload = ctx.update?.message.text.split(' ')[1];
        // console.log(ctx)
        console.log('проверка реферала')
        if (commandStart === '/start'){
            if (startPayload !== '' && startPayload !== undefined){
                console.log('чел новый пользователь и пришел по реф ссылке')
                ctx.session.user.referral = true;
                const collection = await Database.getCollection('sessions')
                const referrer = await collection.findOne({'data.user.id': +startPayload}) //получаем юзера который пригласил
                if (referrer === null) {
                    console.log('чел новый пользователь но пришел по непрвильной реф ссылке')
                    ctx.session.user.referral = false;
                    return ctx.reply('Неверная реферальная ссылка!')
                }
                if (referrer.data.user?.referrals === undefined) referrer.data.user.referrals = [];
                if (referrer.data.user.referrals.includes(ctx.session.user.id) === false && +startPayload !== ctx.session.user.id){ // если приглашенный не является реферером и у него нет в рефералах данного юзера обновляем
                    referrer.data.user.referrals.push(ctx.session.user.id)
                    collection.updateOne({'data.user.id': +startPayload}, {$set: {'data.user.referrals':referrer.data.user.referrals}})
                }
            }
            else {
                console.log('чел новый пользователь но пришел сам')
                ctx.session.user.referral = false;
            }
        }

    }
}
module.exports = ReferralSystem;