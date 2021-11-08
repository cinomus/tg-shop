const ObjectID = require("mongodb").ObjectID;
const {Database} = require('../../session');

let statistics = {}

class StatisticOfDay {
    static stats = {
        dailySales: 0,
        dailySalesAmount: 0,
        newUsers: 0,
        purchasedProducts: {},
        orders: 0
    }

    static addOrderToStats() {
        StatisticOfDay.stats.orders += 1
    }

    static async addToPurchasedProducts(cartOfOrder) {
        for (let key in cartOfOrder) {
            if (StatisticOfDay.stats.purchasedProducts.hasOwnProperty(key)) {
                StatisticOfDay.stats.purchasedProducts[key] += +cartOfOrder[key];
            } else {
                StatisticOfDay.stats.purchasedProducts[key] = +cartOfOrder[key];
            }
        }
    }

    static async addDailySaleAmount(cartOfOrder) {
        let collection = await Database.getCollection('products')
        for (let key in cartOfOrder) {
            const objectId = new ObjectID(key);
            let product = await collection.findOne(
                {_id: objectId}, // критерий выборки
            )
            console.log('addDailySaleAmount', +product.cost, +StatisticOfDay.stats.dailySalesAmount)
            StatisticOfDay.stats.dailySalesAmount = +StatisticOfDay.stats.dailySalesAmount + (+product.cost * cartOfOrder[key]);
        }
    }

    static async addNewUser() {
        StatisticOfDay.stats.newUsers += 1;
    }

    static async addDailySale() {
        StatisticOfDay.stats.dailySales++;
    }


}
async function getRemainingProducts() {
    let collection = await Database.getCollection('products');
    let products = await collection.find().toArray();
    let remainingProducts = 0;
    for (let product of products) {
        remainingProducts += +product.quantity;
    }
    return remainingProducts
}
async function getStatisticOfDay(){
    return StatisticOfDay.stats;
}
async function statisticStart() {
    statistics.statisticOfDay = StatisticOfDay.stats;
    setInterval(() => {
        let date = new Date()
        if (date.getHours() === 0 && date.getMinutes() === 0) {
            statistics.statisticOfDay = StatisticOfDay.stats = {
                dailySales: 0,
                dailySalesAmount: 0,
                orders: 0,
                newUsers: 0,
                purchasedProducts: {}
            }

        }
        // console.log('statistic update', statistics)

    }, 60000)
}

module.exports = {statistics, statisticStart, StatisticOfDay, getRemainingProducts, getStatisticOfDay};