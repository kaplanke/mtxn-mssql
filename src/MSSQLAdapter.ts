import log4js from "@log4js-node/log4js-api";
import { ConnectionPool, IIsolationLevel, IResult, ISqlType, Transaction } from "mssql";
import { Context, MultiTxnMngr, Task } from "multiple-transaction-manager";
import { v1 } from "uuid";

export class MssqlDBContext implements Context {

    connPool: ConnectionPool;
    txn: Transaction | undefined = undefined;
    contextId: string;
    isolationLevel: IIsolationLevel | undefined;
    logger = log4js.getLogger("MultiTxnMngr");

    constructor(connPool: ConnectionPool, isolationLevel?: IIsolationLevel) {
        this.connPool = connPool;
        this.contextId = v1();
        this.isolationLevel = isolationLevel
    }

    init(): Promise<Context> {
        return new Promise((resolve, reject) => {
            if (this.isInitialized()) {
                reject("Context already initialised.");
            } else {
                try {
                    this.txn = new Transaction(this.connPool);
                    this.txn.begin().then(() => {
                        resolve(this);
                    }).catch((err) => {
                        reject(err);
                    });
                } catch (err) {
                    reject(err);
                }
            }
        });
    }

    commit(): Promise<Context> {
        return new Promise((resolve, reject) => {
            if (!this.isInitialized()) {
                reject("Cannot commit. Context not initialised.");
            } else {
                this.txn?.commit((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        this.logger.debug(this.getName() + " is committed.");
                        resolve(this);
                    }
                    this.txn = undefined;
                });
            }
        });
    }

    rollback(): Promise<Context> {
        return new Promise((resolve, reject) => {
            if (!this.isInitialized()) {
                reject("Cannot rollback. Context not initialised.");
            } else {
                this.txn?.rollback((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        this.logger.debug(this.getName() + " is rollbacked.");
                        resolve(this);
                    }
                    this.txn = undefined;
                });
            }
        });
    }

    isInitialized(): boolean {
        return this.txn != undefined;
    }

    getName(): string {
        return "MSSQL DB Context: " + this.contextId;
    }

    getTransaction(): Transaction {
        if (!this.txn)
            throw new Error("Transaction not initialised!");
        return this.txn;
    }

    addTask(txnMngr: MultiTxnMngr, querySql: string, params?: any | undefined) {
        const task = new MssqlDBTask(this, querySql, params, undefined);
        txnMngr.addTask(task);
    }

    addFunctionTask(txnMngr: MultiTxnMngr,
        execFunc: ((txn: Transaction, task: Task) => Promise<IResult<any> | undefined>) | undefined) {
        const task = new MssqlDBTask(this, "", undefined, execFunc);
        txnMngr.addTask(task);
    }
}

export class MssqlDBTask implements Task {
    params: any;
    context: MssqlDBContext;
    querySql: string;
    rs: IResult<any> | undefined;
    execFunc: ((txn: Transaction, task: Task) => Promise<IResult<any> | undefined>) | undefined;

    constructor(context: MssqlDBContext,
        querySql: string,
        params: any,
        execFunc: ((txn: Transaction, task: Task) => Promise<IResult<any> | undefined>) | undefined) {
        this.context = context;
        this.querySql = querySql;
        if (params)
            this.params = params;
        if (execFunc)
            this.execFunc = execFunc;
    }
    
    getResult(): IResult<any> | undefined {
        return this.rs;
    }

    getContext(): MssqlDBContext {
        return this.context;
    }

    exec(): Promise<Task> {
        return new Promise<Task>((resolveTask, rejectTask) => {
            let params: any;
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
            } else {
                const request = this.getContext().getTransaction().request();
                if (params) {
                    params.forEach((element: [string, ISqlType, any]) => {
                        request.input(...element);
                    });
                }
                request.query(this.querySql, (err, result) => {
                    if (err) {
                        rejectTask(err);
                    } else {
                        this.rs = result;
                        resolveTask(this);
                    }
                });
            }
        });
    }

    setParams(params: any) {
        this.params = params;
    }

}