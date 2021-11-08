const config = require('config')
const {TelegrafMongoSession} = require('telegraf-session-mongodb');
const {MongoClient} = require('mongodb');



class Database {
    static database;
    static session;
    static async getCollection(name){
        return Database.database.collection(name);

    }
    static async start(){
        Database.database = await Database._dbConnect();
        Database.session = await Database._sessionStart();

    }
    static async _dbConnect() {
        try {
            let client = await MongoClient.connect(config.get('mongoURL'), {
                useNewUrlParser: true,
                useUnifiedTopology: true
            })
            return client.db(config.get('dbName'));
        } catch (e) {
            console.log("Ошибка ", e)
            process.exit(1)
        }

    }

    static async _sessionStart() {
        try {
            return new TelegrafMongoSession(Database.database, {
                collectionName: 'sessions',
                sessionName: 'session'
            })
        } catch (e) {
            console.log(e)
            process.exit(1)
        }
    }

}

function returnSession() {
    return session
}

module.exports = {Database};
