const fs = require('fs');
const path = require('path');

class MtxConfig {
    
    constructor(filePath, initialData = {}) {
        this.filePath = path.resolve(filePath);
        this.cache = initialData; 
        this.isReady = false;
        this.saveScheduled = false;
        
        this.isSilent = process.env.MTX_DEBUG !== 'true'; 

        this._initializeCache();
    }
    
    _log(level, message) {
        if (!this.isSilent) {
            const prefix = `[mtx.config] `;
            if (level === 'error') {
                console.error(prefix + message);
            } else if (level === 'warn') {
                console.warn(prefix + message);
            } else {
                console.log(prefix + message);
            }
        }
    }

    _parsePath(keyPath) {
        return keyPath.replace(/\[(\w+)\]/g, '.$1').split('.').filter(p => p.length);
    }

    _getNative(keyPath, defaultValue) {
        let current = this.cache;
        const keys = this._parsePath(keyPath);
        
        for (const key of keys) {
            if (current && typeof current === 'object' && current !== null && key in current) {
                current = current[key];
            } else {
                return defaultValue;
            }
        }
        return current;
    }

    _setNative(keyPath, value) {
        let current = this.cache;
        const keys = this._parsePath(keyPath);
        
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            
            if (i === keys.length - 1) {
                current[key] = value;
            } else {
                if (typeof current[key] !== 'object' || current[key] === null || Array.isArray(current[key])) {
                    const nextKeyIsIndex = keys[i+1] && !isNaN(parseInt(keys[i+1], 10));
                    current[key] = nextKeyIsIndex ? [] : {};
                }
                current = current[key];
            }
        }
    }
    
    _deleteNative(keyPath) {
        let current = this.cache;
        const keys = this._parsePath(keyPath);
        
        if (keys.length === 0) return false;

        const lastKey = keys.pop();
        
        for (const key of keys) {
            if (current && typeof current === 'object' && current !== null && key in current) {
                current = current[key];
            } else {
                return false; 
            }
        }

        if (current && typeof current === 'object' && lastKey in current) {
            delete current[lastKey];
            return true;
        }
        
        return false;
    }

    _initializeCache() {
        try {
            const dir = path.dirname(this.filePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

            if (!fs.existsSync(this.filePath)) {
                 this._save(true);
            }
            this.isReady = true;
            this._log('info', `Persistência do Cache definida: ${path.basename(this.filePath)}`);
        } catch (e) {
            this._log('error', `ERRO FATAL na inicialização de persistência: ${e.message}`);
        }
    }
    
    _scheduleSave() { 
        if (this.saveScheduled) return;
        this.saveScheduled = true;
        setTimeout(() => { this._save(); this.saveScheduled = false; }, 100);
    }
    
    _save(sync = false) { 
        if (!this.isReady) return;
        const jsonString = JSON.stringify(this.cache, null, 4);
        try {
            if (sync) {
                fs.writeFileSync(this.filePath, jsonString, 'utf8');
            } else {
                fs.writeFile(this.filePath, jsonString, 'utf8', (err) => {
                    if (err) this._log('error', `ERRO ao salvar: ${err.message}`);
                });
            }
        } catch (e) { this._log('error', `ERRO ao salvar: ${e.message}`); }
    }

    get(keyPath, defaultValue) {
        return this._getNative(keyPath, defaultValue);
    }

    set(keyPath, value) {
        this._setNative(keyPath, value);
        this._scheduleSave();
    }

    has(keyPath) {
        return this._getNative(keyPath) !== undefined;
    }

    delete(keyPath) {
        const result = this._deleteNative(keyPath);
        if (result) {
            this._scheduleSave();
        }
        return result;
    }

    export(key) {
        const value = this.get(`export.${key}`);
        if (value === undefined && process.env.MTX_DEBUG === 'true') {
            this._log('warn', `Chave de exportação/global '${key}' não encontrada em 'export.${key}'.`);
        }
        return value;
    }
    
    all() {
        return JSON.parse(JSON.stringify(this.cache));
    }
}

module.exports = MtxConfig;

