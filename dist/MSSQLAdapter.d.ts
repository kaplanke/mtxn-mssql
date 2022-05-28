import log4js from "@log4js-node/log4js-api";
import { ConnectionPool, IIsolationLevel, IResult, Transaction } from "mssql";
import { Context, MultiTxnMngr, Task } from "multiple-transaction-manager";
export declare class MssqlDBContext implements Context {
    connPool: ConnectionPool;
    txn: Transaction | undefined;
    contextId: string;
    isolationLevel: IIsolationLevel | undefined;
    logger: log4js.Logger;
    constructor(connPool: ConnectionPool, isolationLevel?: IIsolationLevel);
    init(): Promise<Context>;
    commit(): Promise<Context>;
    rollback(): Promise<Context>;
    isInitialized(): boolean;
    getName(): string;
    getTransaction(): Transaction;
    addTask(txnMngr: MultiTxnMngr, querySql: string, params?: any | undefined): void;
    addFunctionTask(txnMngr: MultiTxnMngr, execFunc: ((txn: Transaction, task: Task) => Promise<IResult<any> | undefined>) | undefined): void;
}
export declare class MssqlDBTask implements Task {
    params: any;
    context: MssqlDBContext;
    querySql: string;
    rs: IResult<any> | undefined;
    execFunc: ((txn: Transaction, task: Task) => Promise<IResult<any> | undefined>) | undefined;
    constructor(context: MssqlDBContext, querySql: string, params: any, execFunc: ((txn: Transaction, task: Task) => Promise<IResult<any> | undefined>) | undefined);
    getResult(): IResult<any> | undefined;
    getContext(): MssqlDBContext;
    exec(): Promise<Task>;
    setParams(params: any): void;
}
