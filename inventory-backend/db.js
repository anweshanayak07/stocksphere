import sql from "mssql";
import dotenv from "dotenv";

dotenv.config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: process.env.DB_ENCRYPT === "true",
        trustServerCertificate: true,
        instanceName: process.env.DB_INSTANCE || undefined,
    },
    port: parseInt(process.env.DB_PORT) || 1433,
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let poolPromise = null;

function getPool() {
    if (!poolPromise) {
        poolPromise = new sql.ConnectionPool(config)
            .connect()
            .then(pool => {
                console.log("Connected to MSSQL Pool");
                return pool;
            })
            .catch(err => {
                poolPromise = null;
                console.error("Database Connection Failed!", err);
                throw err;
            });
    }
    return poolPromise;
}

export async function queryDatabase(query, params = []) {
    try {
        const pool = await getPool();
        const request = pool.request();
        params.forEach((param, i) =>
            request.input(`param${i}`, param));

        const result = await request.query(query);
        return result.recordset;
    } catch (err) {
        console.error("DB Query Error:", err.message);
        throw err;
    }
}