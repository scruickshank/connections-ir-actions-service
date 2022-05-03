const createLogger = require('@meltwater/mlabs-logger');
const fs = require('fs');
const path = require('path');


const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json')));

const logBase = {
    '@service': process.env.LOGGER_SERVICE,
    '@system': process.env.LOGGER_SYSTEM,
    '@env': process.env.LOGGER_ENVIRONMENT,
}

const config = {
    name: process.env.LOGGER_NAME,
    version: pkg.version,
    isAppLog: true,
    base: logBase
}



const log = createLogger.createLogger(config);

const info = async (obj, message) => {
    try {
        if (obj) {
            log.info(obj, message);
        } else {
            log.info(message);
        }
    } catch (error) {
        throw new Error(error.message);
    }
}

const error = async (obj, message) => {
    try {
        if (obj) {
            log.error(obj, message);
        } else {
            log.error(message);
        }
        
    } catch (error) {
        throw new Error(error.message);
    }
}

const fatal = async (obj, message) => {
    try {
        if (obj) {
            log.fatal(obj, message);
        } else {
            log.fatal(message);
        }
    } catch (error) {
        throw new Error(error.message);
    }
}

module.exports = {
    info,
    error,
    fatal
}