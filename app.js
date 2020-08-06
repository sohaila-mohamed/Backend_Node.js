const mysql = require('mysql');

const connection = mysql.createConnection({
  host: 'testdatabase.cwu6ls2obhre.us-east-1.rds.amazonaws.com',
  user: 'admin',
  password: 'beebz1997',
  database: 'user',
  multipleStatements: true
});
connection.connect((err) => {
  if (err) throw err;
  console.log('Connected!');
});
console.log("connection",connection);

// class Database {
// constructor( config ) {
//   this.connection = mysql.createConnection( config );
// }
//
//   query( sql, args ) {
//     return new Promise( ( resolve, reject ) => {
//       connection.query( sql, args, ( err, rows ) => {
//         if ( err )
//           return reject( err );
//         resolve( rows );
//       } );
//     } );
//   }
//   close() {
//     return new Promise( ( resolve, reject ) => {
//       connection.end( err => {
//         if ( err )
//           return reject( err );
//         resolve();
//       } );
//     } );
//   }
// }
// Link:https://codeburst.io/node-js-mysql-and-promises-4c3be599909b

module.exports.connection=connection;
