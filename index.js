const path = require('path');
// Supondo que MtxConfig e utils estejam em './lib'
const MtxConfig = require('./lib/MtxConfig');
const { loadAllConfigs } = require('./lib/utils'); 

const BASE_DIRECTORY = path.resolve('./'); 
const DEFAULT_CONFIG_FILE = 'mtx.cache.config'; 

// O scanner varre o diretório de execução (ou seja, a pasta 'project-test' quando o teste roda)
const aggregatedCache = loadAllConfigs(BASE_DIRECTORY);

const configInstance = new MtxConfig(DEFAULT_CONFIG_FILE, aggregatedCache);

module.exports = configInstance;

