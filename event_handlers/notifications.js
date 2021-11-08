const EventEmitter = require('events');
const config = require('config')

class MyEmitter extends EventEmitter {}
const notifications = new MyEmitter();


notifications.on('new_order', async (ctx) => {
    let admins = config.get('admins');
    for (let key in admins){
        await ctx.telegram.sendMessage(admins[key], 'Новый заказ!')
    }

});


module.exports = {notifications}
