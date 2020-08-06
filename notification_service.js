var sys = require("util");
console.log("Hello World"); 
var admin = require("firebase-admin");

var serviceAccount = require("./fortify-72739-firebase-adminsdk-4q383-8703a2c399.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://notification-bbcb1.firebaseio.com"
  });
var registrationToken="";
var data="";
var notification="";
var payload="";
var options="";

function initNotification(notiData){

    registrationToken = notiData.fcm_token;
    console.log("from notification service ", notiData);
    data = {
        title : "Message Received",
        body : notiData.msg_body,
        notificationType:"Test",
        sound:"default"
    };
        
    notification={
        title : "Message Received",
        body : notiData.msg_body,
        notificationType:"Test",
        sound:"default" 
       };
       
    payload = {
        notification: notification,
        data: data
      };
    options = {
        priority: "normal",
        timeToLive: 60 * 60
      };
      sendNotification();

     
      


}
function sendNotification(){

      
      admin.messaging().sendToDevice(registrationToken, payload, options)
        .then(function(response) {
          console.log("token",registrationToken);
          console.log("payload",payload);
          console.log("Successfully sent message:", response.results[0].error);
        })
        .catch(function(error) {
          console.log("Error sending message:", error);
        });

}
module.exports.notify=initNotification;

 

  
