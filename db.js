const mysql = require('mysql2');

const conn = mysql.createConnection({
    host:'localhost',
    user: 'root',
    password: '',
    database:'banco_db'
});
module.exports = conn;