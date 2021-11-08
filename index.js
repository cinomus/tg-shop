const fs = require('fs')
const bot = require('./app')
const {statisticStart} = require("./libs/modules/statistic");
const {Database} = require('./session')

console.log(process.env.NODE_ENV)
start();

/*
    function start - запускает все приложение(подключает бд, запускает бота)
    @private
   * @params: none
   * @returns: none
 */
async function start() {
    try {
        await statisticStart()
        await Database.start();
        console.log('ne use')
        await bot.launch();
        // await bot.launch({
        //     webhook: {
        //         domain: `https://6c19d14c8cfa.ngrok.io`,
        //         port: `5000`,
        //     },
        // });
        console.log('Started!')
    } catch (e) {
        console.log("ошибка" + e)
        process.exit(1)
    }
}
