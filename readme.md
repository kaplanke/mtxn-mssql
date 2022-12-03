# @multiple-transaction-manager/mssql

> MSSQL context implementation for multiple-transaction-manager library. 

## API

### Classes

#### __MssqlDBContext__

####  `constructor(txnMngr, connPool, isolationLevel)`
-   `txnMngr`: _{MultiTxnMngr}_ The multiple transaction manager to to bind with the context.
-   `connPool`: _{ConnectionPool}_ The MSSQL connection pool obtain the session from.
-   `isolationLevel`: _{IIsolationLevel}_ The MSSQL isolation level.
-   Returns: {MssqlDBContext} The created _MssqlDBContext_ instance.

#### `addFunctionTask(execFunc)`

Adds a task to the transaction manager.

-   `execFunc`: _{execFunc: (txn: Transaction, task: Task) =>  Promise\<IResult\<unknown> | undefined>  | undefined}_ The function to be executes in promise. MSSQL connection is provided to the function.
-   Returns: {MssqlDBTask} Returns the created _MssqlDBTask_ instance.

#### `addTask(querySql: string, params?: unknown | undefined)`

A shortcut to add a SQL task to the transaction manager.

-   `querySql`: _{string}_ The query string to be executes in promise.
-   `params`: _{unknown | undefined}_ Optional parameter object to bind SQL statement variables.
-   Returns: {MssqlDBTask} The created _MssqlDBTask_ instance.


#### __MssqlDBTask__

####  `constructor(context, querySql, params, execFunc)`
-   `context`: _{MssqlDBContext}_ The _MssqlDBContext_ to to bind with the task.
-   `querySql`: _{string}_ The query string to be executes in promise. __Ignored if execFunc parameter is provided__.
-   `params`: _{unknown | undefined}_ Optional parameter object to bind SQL statement variables. __Ignored if execFunc parameter is provided__.
-   `execFunc`: _{execFunc: (txn: Transaction, task: Task) =>  Promise\<IResult\<unknown> | undefined>  | undefined}_  The function to be executes in promise. MSSQL connection is provided to the function.
-   Returns: {MssqlDBTask} The created _MssqlDBTask_ instance.

## Example

https://github.com/kaplanke/mtxn-mssql/blob/master/test/mtxn.mssql.test.ts

```js

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
        (task) => { return new Promise((resolve, _) => { console.log("On Txn Commit..."); resolve(task); }); },
        (task) => { return new Promise((resolve, _) => { console.log("On Txn Rollback..."); resolve(task); }); }
    );

    // jest
    await expect(txnMngr.exec()).resolves.not.toBeNull();
```
