//const mysql = require('mysql2');
// const conn = mysql.createConnection({
//     host:'localhost',
//     user: 'root',
//     password: '',
//     database:'banco_db'
// });
// module.exports = conn;
const mysql = require('mysql2');

const conn = mysql.createPool({
    host:'localhost',
    user: 'root',
    password: '',
    database:'banco_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
module.exports = conn;