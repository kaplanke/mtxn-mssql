import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import log4js from "log4js";
import { ConnectionPool, IResult, TYPES } from "mssql";
import { FunctionContext, MultiTxnMngr } from "multiple-transaction-manager";
import { MssqlDBContext } from "../src/index";

log4js.configure({
    appenders: { 'out': { type: 'stdout' } },
    categories: {
        default: { appenders: ['out'], level: 'info' },
        MultiTxnMngr: { appenders: ['out'], level: 'debug' }
    }
});

const pool = new ConnectionPool({
    user: "sa",
    password: "changeme",
    database: "mtxnmngr",
    server: 'localhost',
    pool: {
        max: 3,
        min: 0,
        idleTimeoutMillis: 30000
    },
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
});


describe("Multiple transaction manager mssql workflow test...", () => {

    beforeAll(async () => {
        global.console = require('console');
        await pool.connect();
    });

    test("Success-commit case", async () => {

        // init manager & context
        const txnMngr: MultiTxnMngr = new MultiTxnMngr();
        const mssqlContext = new MssqlDBContext(txnMngr, pool);
        const functionContext = new FunctionContext(txnMngr);

        // Add first step
        mssqlContext.addTask("DELETE FROM test_table");

        // Add second step
        mssqlContext.addTask("INSERT INTO test_table(id, name) VALUES (@id, @name)", [["id", TYPES.Numeric(38), 1], ["name", TYPES.VarChar(100), "Dave"]]);

        // Add third step
        functionContext.addTask(
            (task) => { return new Promise((resolve, _) => { console.log("All done."); resolve(task); }); },
            null, // optional params
            (task) => { return new Promise((resolve, _) => { console.log("Committing..."); resolve(task); }); },
            (task) => { return new Promise((resolve, _) => { console.log("Rolling back..."); resolve(task); }); }
        );


        await expect(txnMngr.exec()).resolves.not.toBeNull();

    });


    test("Fail-rollback case", async () => {

        // init manager & context
        const txnMngr: MultiTxnMngr = new MultiTxnMngr();
        const mssqlContext = new MssqlDBContext(txnMngr, pool);
        const functionContext = new FunctionContext(txnMngr);

        // Add first step
        mssqlContext.addTask("DELETE FROM test_table");

        // Add second step
        mssqlContext.addTask("INSERT INTO test_table(id, name) VALUES (@id, @name)", [["id", TYPES.Numeric(38), 1], ["name", TYPES.VarChar(100), "Dave"]]);

        // Add third step -> Causes primary key violation
        mssqlContext.addTask("INSERT INTO test_table(id, name) VALUES (@id, @name)", [["id", TYPES.Numeric(38), 1], ["name", TYPES.VarChar(100), "Kevin"]]);

        // Add last step -> should not execute
        functionContext.addTask(
            (task) => { return new Promise((resolve, _reject) => { console.log("Face the thing that should not be..."); resolve(task); }); },
            null, // optional params
            (task) => Promise.resolve(task),
            (task) => Promise.resolve(task)
        );


        await expect(txnMngr.exec()).rejects.not.toBeNull();

    });


    test("Function task example", async () => {

        // init manager & context
        const txnMngr: MultiTxnMngr = new MultiTxnMngr();
        const mssqlContext = new MssqlDBContext(txnMngr, pool);

        // Add first step
        mssqlContext.addTask("DELETE FROM test_table");

        // Add second step
        mssqlContext.addFunctionTask(
            (txn, _task) => {
                return new Promise<IResult<unknown> | undefined>((resolve, reject) => {
                    txn.request().query("INSERT INTO test_table(id, name) VALUES (1, 'Stuart')", (err, result) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(result);
                        }
                    });
                });
            });


        // Add control step
        const controlTask = mssqlContext.addTask("SELECT * FROM test_table");

        await txnMngr.exec();

        expect(controlTask.getResult().recordset[0]["Name"]).toEqual("Stuart");

    });

    afterAll(async () => { await pool.close(); });

});