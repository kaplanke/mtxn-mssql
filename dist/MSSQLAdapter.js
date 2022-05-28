"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MssqlDBTask = exports.MssqlDBContext = void 0;
const log4js_api_1 = __importDefault(require("@log4js-node/log4js-api"));
const mssql_1 = require("mssql");
const uuid_1 = require("uuid");
class MssqlDBContext {
    constructor(connPool, isolationLevel) {
        this.txn = undefined;
        this.logger = log4js_api_1.default.getLogger("MultiTxnMngr");
        this.connPool = connPool;
        this.contextId = (0, uuid_1.v1)();
        this.isolationLevel = isolationLevel;
    }
    init() {
        return new Promise((resolve, reject) => {
            if (this.isInitialized()) {
                reject("Context already initialised.");
            }
            else {
                try {
                    this.txn = new mssql_1.Transaction(this.connPool);
                    this.txn.begin().then(() => {
                        resolve(this);
                    }).catch((err) => {
                        reject(err);
                    });
                }
                catch (err) {
                    reject(err);
                }
            }
        });
    }
    commit() {
        return new Promise((resolve, reject) => {
            var _a;
            if (!this.isInitialized()) {
                reject("Cannot commit. Context not initialised.");
            }
            else {
                (_a = this.txn) === null || _a === void 0 ? void 0 : _a.commit((err) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        this.logger.debug(this.getName() + " is committed.");
                        resolve(this);
                    }
                    this.txn = undefined;
                });
            }
        });
    }
    rollback() {
        return new Promise((resolve, reject) => {
            var _a;
            if (!this.isInitialized()) {
                reject("Cannot rollback. Context not initialised.");
            }
            else {
                (_a = this.txn) === null || _a === void 0 ? void 0 : _a.rollback((err) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        this.logger.debug(this.getName() + " is rollbacked.");
                        resolve(this);
                    }
                    this.txn = undefined;
                });
            }
        });
    }
    isInitialized() {
        return this.txn != undefined;
    }
    getName() {
        return "MSSQL DB Context: " + this.contextId;
    }
    getTransaction() {
        if (!this.txn)
            throw new Error("Transaction not initialised!");
        return this.txn;
    }
    addTask(txnMngr, querySql, params) {
        const task = new MssqlDBTask(this, querySql, params, undefined);
        txnMngr.addTask(task);
    }
    addFunctionTask(txnMngr, execFunc) {
        const task = new MssqlDBTask(this, "", undefined, execFunc);
        txnMngr.addTask(task);
    }
}
exports.MssqlDBContext = MssqlDBContext;
class MssqlDBTask {
    constructor(context, querySql, params, execFunc) {
        this.context = context;
        this.querySql = querySql;
        if (params)
            this.params = params;
        if (execFunc)
            this.execFunc = execFunc;
    }
    getResult() {
        return this.rs;
    }
    getContext() {
        return this.context;
    }
    exec() {
        return new Promise((resolveTask, rejectTask) => {
            let params;
            if (this.params) {
                if (this.params instanceof Function)
                    params = this.params();
                else
                    params = this.params;
            }
            if (this.execFunc) {
                this.execFunc(this.getContext().getTransaction(), this).then((res) => {
                    this.rs = res;
                    resolveTask(this);
                }).catch((err) => {
                    rejectTask(err);
                });
            }
            else {
                const request = this.getContext().getTransaction().request();
                if (params) {
                    params.forEach((element) => {
                        request.input(...element);
                    });
                }
                request.query(this.querySql, (err, result) => {
                    if (err) {
                        rejectTask(err);
                    }
                    else {
                        this.rs = result;
                        resolveTask(this);
                    }
                });
            }
        });
    }
    setParams(params) {
        this.params = params;
    }
}
exports.MssqlDBTask = MssqlDBTask;
