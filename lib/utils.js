const fs = require('fs');
const path = require('path');

/**
 * Realiza uma fusão profunda de dois objetos.
 * @param {object} target Objeto alvo que será modificado.
 * @param {object} source Objeto fonte cujos valores serão copiados.
 * @returns {object} O objeto alvo fundido.
 */
function deepMerge(target, source) {
    for (const key in source) {
        // Verifica se a chave existe em ambos e se ambos são objetos literais (não arrays)
        if (source[key] instanceof Object && key in target && target[key] instanceof Object && !Array.isArray(source[key]) && !Array.isArray(target[key])) {
            // Fusão profunda recursiva
            deepMerge(target[key], source[key]);
        } else {
            // Caso contrário, sobrescreve o valor ou adiciona a nova chave
            target[key] = source[key];
        }
    }
    return target;
}

/**
 * Encontra e carrega todos os arquivos .config recursivamente a partir de um diretório base,
 * mas limita a busca às pastas alvo: 'config', 'configs', 'database', 'databaseconfig'.
 * Os arquivos são ordenados alfabeticamente para garantir a precedência (ex: 01-base < 99-prod).
 * @param {string} baseDir O diretório raiz para começar a varredura (ex: root do projeto).
 * @returns {object} O objeto de cache global fundido (Configurações agregadas).
 */
function loadAllConfigs(baseDir) {
    // Diretórios que serão escaneados, relativos ao baseDir.
    const TARGET_DIRS = ['config', 'configs', 'database', 'databaseconfig']; 
    let allConfigPaths = [];
    let aggregatedData = {};
    const isDebug = process.env.MTX_DEBUG === 'true';

    if (!fs.existsSync(baseDir)) return aggregatedData;

    // --- FASE 1: VARREDURA E COLETA DE CAMINHOS SOMENTE NAS PASTAS ALVO ---
    
    // 1. Inicializa a varredura apenas com os diretórios alvos existentes
    const filesToScan = TARGET_DIRS.map(dir => path.join(baseDir, dir)).filter(dirPath => {
        const exists = fs.existsSync(dirPath);
        if (isDebug && !exists) {
            console.warn(`[mtx.config] Aviso: O diretório alvo '${path.basename(dirPath)}' não existe e será ignorado.`);
        }
        return exists && fs.statSync(dirPath).isDirectory();
    });
    
    // 2. Processa recursivamente (se houver subpastas) dentro das pastas alvo
    const initialFilesToScan = [...filesToScan]; // Copia para não modificar o array principal durante a iteração

    while (filesToScan.length) {
        const currentDir = filesToScan.shift();
        
        try {
            const files = fs.readdirSync(currentDir);

            files.forEach(file => {
                const filePath = path.join(currentDir, file);
                const stat = fs.statSync(filePath);

                if (stat.isDirectory()) {
                    // Continua recursivamente, mas apenas dentro das subpastas das pastas alvo
                    if (file !== 'node_modules' && file !== '.git' && file !== 'dist' && file !== 'temp') {
                        filesToScan.push(filePath);
                    }
                } else if (file.endsWith('.config')) {
                    allConfigPaths.push(filePath);
                }
            });
        } catch (e) {
             if (isDebug) {
                 console.warn(`[mtx.config] Aviso: Não foi possível ler o diretório '${currentDir}': ${e.message}`);
             }
        }
    }
    
    // --- FASE 2: ORDENAÇÃO E FUSÃO (Merge) ---
    
    // Ordena alfabeticamente para garantir a precedência (01-development < 99-production)
    allConfigPaths.sort((a, b) => a.localeCompare(b)); 

    let foundFilesCount = 0;
    
    for (const filePath of allConfigPaths) {
        try {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const fileData = JSON.parse(fileContent);
            
            deepMerge(aggregatedData, fileData); 
            foundFilesCount++;
            
            if (isDebug) {
                console.log(`[mtx.config] Carregado (Precedência: ${foundFilesCount}): ${path.relative(baseDir, filePath)}`);
            }
        } catch (e) {
            console.error(`[mtx.config] ERRO ao parsear ${path.relative(baseDir, filePath)}: ${e.message}`);
        }
    }
    
    if (foundFilesCount === 0 && isDebug) {
        console.warn(`[mtx.config] Aviso: Nenhum arquivo .config encontrado nas pastas alvos em '${baseDir}'.`);
    }

    return aggregatedData;
}

module.exports = {
    deepMerge,
    loadAllConfigs
};

