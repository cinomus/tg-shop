var exports = module.exports = {}; // тут именно var нужен из за какой то там особенности
exports.banChecker = require('./banChecker')
exports.detectNewUser = require('./detectNewUser-DEPRECATED')
exports.addUserInfoToSession = require('./addUserInfoToSession')