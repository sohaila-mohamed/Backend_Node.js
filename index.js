const express=require('express');
const app=express();
var cors = require('cors');
app.use(cors());
const Joi=require('joi');
const DB=require('./app');
const notificationService=require('./notification_service');
var multiparty = require('multiparty');
const multer = require('multer');
const AWS = require('aws-sdk');
const env = require('./S3_Config');
const moment = require("moment");
let OpenTok = require('opentok'),
    opentok = new OpenTok("46767002", "d5d5933459840ce06d8a9b9abceb541bcb266856");

var storage = multer.memoryStorage();
let upload = multer({storage: storage});


const s3Client = new AWS.S3({
    accessKeyId: env.AWS_ACCESS_KEY,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    region : env.REGION
});

const uploadParams = {
    Bucket: env.Bucket,
    Key: '', // pass key
    Body: null, // pass file body
    ACL:'public-read',
    ContentType: ''
};

let s3 = {};
s3.s3Client = s3Client;
s3.uploadParams = uploadParams;



app.use(function(req, res, next) {
    console.log(req.headers);
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers",
               "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    next();
  });
console.log(DB);
app.use(express.json());
process.env.TZ = 'Africa/Cairo';
const datetime = new Date();
const Port=process.env.Port || 3000;
app.listen(Port,()=>{
    console.log(`Listening to port ${Port}`);
});

const connections=DB.connection;
app.get('/',async (req,res)=>{
    console.log(datetime.toLocaleString().slice(0,8));
    // console.log(CreateSlots(4,6));
    res.send(await intervals('2020-06-25 02:00:00 PM', '2020-06-25 06:00:00 PM',15));

});

function query( sql, args ) {
    return new Promise( ( resolve, reject ) => {
        DB.connection.query( sql, args, ( err, rows ) => {
            if ( err )
                return reject( err );
            resolve( rows );
        } );
    } );
}

//get users
app.get('/api/users',(req,res)=>{

    DB.connection.query("SELECT * FROM user",(error,rows,fields)=>{
        if(!!error){
            console.log("Error in query");
            return;
        }
        console.log("successful Query");
        res.send(rows);

    });

});

//request vitals by patient_id
app.get('/api/users/vitals/:id',(req,res)=>{
    console.log(req.params);
    const Id = parseInt(req.params.id);
    console.log("Id",Id);
    DB.connection.query("SELECT * FROM user.vitals WHERE id="+Id,(error,row,fields)=>{
        if(!!error){
            console.log("Error in query");
            return;
        }

   if(!row){
       res.status(404).send(`NOT FOUND`);
       return;
   }

       res.send(row);
       console.log("row",row);
   });


});


//////////////////////post vitals
app.post('/api/users/vitals/:id',(req,res)=>{

const vitals={
        id :parseInt(req.params.id),
        weight :parseInt(req.body.weight),
        height :parseInt(req.body.height),
        BMI:parseInt(req.body.BMI),
        body_fats_ratio:parseInt(req.body.body_fats_ratio),
        body_water_ratio:parseInt(req.body.body_water_ratio),
        stomic_area_fats:parseInt(req.body.stomic_area_fats),
        bone_desity:parseInt(req.body.bone_desity),
        muscle_desity:parseInt(req.body.muscle_desity)
  };

console.log("vitals",vitals);
DB.connection.query( `INSERT INTO user.vitals SET ?`,vitals,(error,results)=>{
    if(!!error){
        console.log("Error in query",error);
        return;
    }
    console.log("successful Query");
    console.log("result",results);
    res.send(results);
});



});

/////////////////////////////
app.put('/api/users/vitals/:id',(req,res)=>{
const Id = parseInt(req.params.id);
console.log("req.body",req.body);
DB.connection.query( `UPDATE user.vitals Set ${req.body.vital_Name} = ? Where id = ?`,
[req.body.new_value,Id],
(err, result) => {
  if (err) throw err;
  console.log(`Changed ${result.changedRows} row(s)`);
  res.send(result);
});

});
///////////////////////////////////////////////////////////////


//Post Thread
app.post('/api/users/threads/:sender_id',(req,res)=>{

    const thread={
            sender_id    :   parseInt(req.params.sender_id),
            receiver_id  :   parseInt(req.body.receiver_id),
            msg_subject  :   req.body.msg_subject,
            created_date :   GetDate(),
            is_readed    :   parseInt(req.body.is_readed),
            sender_name  :   req.body.sender_name,
            receiver_name:   req.body.receiver_name,
            msg_body     :   req.body.msg_body
      };

    console.log("thread",thread);
    const sql=`INSERT INTO user.inbox SET ?`;
    const sql2=`INSERT INTO user.msg SET ?`;
    let postThreadResults="";
    query(sql,thread).then(result=>{postThreadResults=result;
    console.log("post thread results",result);
        const msg={
            thread_id:	parseInt(result.insertId),
            sender_id: parseInt(req.body.sender_id),
            sender_name:req.body.sender_name,
            receiver_name:req.body.receiver_name,
            receiver_id	:parseInt(req.body.receiver_id),
            msg_body:	req.body.msg_body,
            created_date: GetDate(),
            media:""
        };
        console.log("msg",msg);
    return query(sql2,msg)}).then(result2=>{console.log("post reply result",result2);
        try {
            notificationService.notify(req.body);
        }
        catch (e) {
            console.log(e);

        }
        res.send(postThreadResults);}).catch(err=>{console.log("err",err);
        res.send(err);});


    });

//////////////////////////////////////////////////////////
//Update read state
app.put('/api/threads/state/:thread_id',(req,res)=>{
    const state = parseInt(req.body.state);
    const id=parseInt(req.params.thread_id);
    console.log("req.body",req.body);
    console.log("id ",id, " state",state);
    DB.connection.query( `UPDATE user.inbox Set  is_readed = ?  Where thread_id = ?`,
    [state,id],
    (err, result) => {
      if (err) throw err;
      console.log(`Changed ${result.changedRows} row(s)`);
      res.send(result);
    });

    });

////////////////////////////////////////////////////////
//get threads by sender_id

app.get('/api/users/threads/sent/:sender_id/:offset',(req,res)=>{

    DB.connection.query("SELECT  * FROM user.inbox where sender_id="+parseInt(req.params.sender_id)+" Limit 10 offset "+parseInt(req.params.offset),(error,rows,fields)=>{
        if(!!error){
            console.log("Error in query");
            return;
        }
        if(!rows){
            res.status(404).send(`NOT FOUND`);
            return;
        }
        rows.forEach(row=>row.created_date=hour12(row.created_date));
        console.log(rows);
        res.send(rows);
            console.log("row",rows);


    });

});
/////////////////////////////////////////////////////////////////
//get threads by receiver_id
app.get('/api/users/threads/inbox/:receiver_id/:offset',(req,res)=>{

    DB.connection.query("SELECT  * FROM user.inbox  where  receiver_id="+parseInt(req.params.receiver_id)+" Limit 10 offset "+parseInt(req.params.offset),
    (error,rows,fields)=>{
        if(!!error){
            console.log("Error in query",error);
            res.status(500).send(new Error("internal server error"));
            return;
        }
        if(!rows){
            res.status(404).send(`NOT FOUND`);
            return;
        }
            rows.forEach(row=>row.created_date=hour12(row.created_date));
            console.log(rows);

            res.send(rows);
            console.log("row",rows);


    });
});

// SELECT  * FROM user.inbox FORCE INDEX (index_created_at_sender_id) where created_date BETWEEN date( NOW()) AND DATE_ADD(NOW(), INTERVAL 150 DAY) and sender_id=24  ;
//get threads' messages by thread_id
app.get('/api/users/threads/replies/:thread_id/:offset',(req,res)=>{

    DB.connection.query("SELECT  * FROM user.msg  where  thread_id="+parseInt(req.params.thread_id)+" Limit 10 offset "+parseInt(req.params.offset),
    (error,rows,fields)=>{
        if(!!error){
            console.log("Error in query");
            return;
        }
        if(!rows){
            res.status(404).send(`NOT FOUND`);
            return;
        }
           rows.forEach(row=>row.created_date=hour12(row.created_date));
           console.log(rows);

            res.send(rows);
            console.log("row",rows);


    });

});
///////////////////////////////////////////////////////////////
//Post Message
app.post('/api/users/threads/msg/:thread_id',(req,res)=>{

    const msg={
                thread_id:	parseInt( req.params.thread_id),
                sender_id: parseInt(req.body.sender_id),
                sender_name:req.body.sender_name,
                receiver_name:req.body.receiver_name,
                receiver_id	:parseInt(req.body.receiver_id),
                msg_body:	req.body.msg_body,
                created_date: GetDate(),
                media:req.body.media
      };
    console.log("msg",msg);
    DB.connection.query( `INSERT INTO user.msg SET ?`,msg,(error,results)=>{
        if(!!error){
            console.log("Error in query",error);
            return;
        }
        console.log("successful Query");
        console.log("result",results);
        res.send(results);
        console.log("req body ",req.body);
        try {
            notificationService.notify(req.body);

        }
        catch (e) {
            console.log(e);

        }


    });


    });
///////////////////////////////////////////////////////////////
//Post Message with media
app.post('/api/users/threads/msg/media/:thread_id',upload.fields([{ name: 'file' }, { name: 'data'}]), sendMediaMessage);

async function sendMediaMessage(req, res){

    console.log("entered sendMediaMssage",req.body);
    console.log("entered doUpload");
    const s3Client = s3.s3Client;
    const params = s3.uploadParams;
    let file = req.files.file[0];
    let mymsg = JSON.parse(req.body.data);

    const msg={
        thread_id:	parseInt( req.params.thread_id),
        sender_id: parseInt(mymsg.sender_id),
        sender_name:mymsg.sender_name,
        receiver_name:mymsg.receiver_name,
        receiver_id	:parseInt(mymsg.receiver_id),
        msg_body:	mymsg.msg_body,
        created_date: GetDate(),
        media: ''
    };

    params.Key =file.originalname;
    params.Body = file.buffer;
    params.ContentType= file.mimetype;


    s3Client.upload(params, (err, data) => {
        if (err) {
            res.status(500).json({error:"Error -> " + err});
        }
        console.log("uploaded");

        var fileUrl = env.endpoint+ env.Bucket +"/" + params.Key;


        console.log(fileUrl);

        console.log("Data: ", mymsg);

        msg.media = fileUrl;

        console.log("msg",msg);
        DB.connection.query( `INSERT INTO user.msg SET ?`,msg,(error,results)=>{
            if(!!error){
                console.log("Error in query",error);
                return;
            }
            console.log("successful Query");
            console.log("result",results);

            res.json({message: 'File uploaded successfully!', url:fileUrl });
            console.log("req body ",mymsg);
            try {
                notificationService.notify(mymsg);

            }
            catch (e) {
                console.log(e);

            }


        });
    });




}
////////////////////////////////////////////////////////////////////////
//Post Schedule
app.post('/api/users/doctor/schedule/', async (req, res) => {
   await createSchedule(req.body).then((results)=>{
        console.log("response",results);
        res.send(results);

    }).catch(err=>res.send(err));
});

async function createSchedule(body){
    console.log("creating schedule");
    let postScheduleResults = [];
    return await new Promise( async resolve=>{
        for(let i=0;i<body.length;i++ ){
        console.log("object",body[i]);
        const schedule = {
            doc_id: parseInt(body[i].doc_id),
            start_time: body[i].start_time,
            end_time: body[i].end_time,
            slot_duration: parseInt(body[i].slot_duration),
            year: parseInt(moment(body[i].date, 'YYYY-MM-DD').format('YYYY')),
            month: parseInt(moment(body[i].date, 'YYYY-MM-DD').format('MM')),
            day: parseInt(moment(body[i].date, 'YYYY-MM-DD').format('DD'))
        };
        console.log("schedule", schedule);
        console.log("for each index ",i);
        const promise=await postSchedule(schedule);
        console.log("post schedule promise",promise);
        const result={
            date:body[i].date+" from "+body[i].start_time+" to "+body[i].end_time,
            id:promise.insertId
        };
        await postScheduleResults.push(result);
        if(i===body.length-1){
            console.log("resolving////////////////////////");
            await resolve(postScheduleResults);
        }


    }

    });




}

async function postSchedule(schedule){
    const sql = `INSERT INTO user.schedule SET ?`;
    let postResults="";
    await query(sql, schedule).then(async result => {
        console.log("start posting schedule");
        postResults=await result;
        console.log("post schedule results", postResults);
        const PostSloltsResults = await postAppointments(result.insertId, schedule.start_time, schedule.end_time, parseInt(schedule.slot_duration));
        console.log("posting an object slots results", PostSloltsResults);
        console.log("end posting results");


    })
        .catch(err => {
            console.log("err", err);
            return err;
        });
    console.log("post post schedule results to return",postResults);
    return await postResults;


}

async function postAppointments(schedule_id,start_time,end_time,slot_duration) {
    //create slots
    let slots=[];
        await intervals(start_time, end_time,slot_duration).then(
            async (Slots)=>{
                await (slots=Slots);
                console.log("slots returned",slots);
                if(slots.length%2){slots.pop()}
            }
        );
        ///////////////////////////////////////////
      ////////////////posting Slots
     let results=await postSlots(schedule_id, slots);
         console.log("post appointments results returned",results);
       return await results;

}

async function postSlots(schedule_id,slots){
    console.log("creat appointments called");
    let postAppointmentsResults=[];
    const sql2=`INSERT INTO user.Appointments SET ?`;
    let index=0;
    for(index;index<(slots.length-1);index=index+2){
        let appointment={
            schedule_id:schedule_id,
            start_time: slots[index],
            end_time: slots[index+1],
            booked:0,
            patient_id:null
        };
        ///post appointment
       await query(sql2,appointment).then(async res => {
           console.log("post appointment results", res);
           await postAppointmentsResults.push(res);
           console.log("current length of post appointment results", postAppointmentsResults.length);

       })
            .catch(err=>{console.log("post appointment error",err);});
        /////////////////////////////////////////////////
    }
    return  await postAppointmentsResults;


}
///////////////////////////////////////////////////////////////////////////////////
/////////get doctor schedule
app.get('/api/users/doctor/schedule/:doc_id',(req,res)=>{

    query("SELECT  * FROM user.schedule  where  doc_id="+parseInt(req.params.doc_id)).then(
        async (rows)=>{
            let results=[];
            // console.log("returned schedule",rows);
            rows.forEach(schedule=>{
                const result={
                    id:schedule.id,
                    date:moment((schedule.year+"-"+schedule.month+"-"+schedule.day),'YYYY-MM-DD').format('YYYY-MM-DD'),
                    start_time:schedule.start_time,
                    end_time:schedule.end_time,
                    slot_duration: schedule.slot_duration
                };
                results.push(result);
                console.log("results",result.date);
            });
            await res.send(results);
        }
    ).catch((err)=>{
        console.log("Error in query",err);



    })

});
///////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////
//////////get doctor schedule by year
app.get('/api/users/doctor/schedule/:doc_id/:year',(req,res)=>{

    query("SELECT  * FROM user.schedule  where  doc_id = "+parseInt(req.params.doc_id)+" and year = "+parseInt(req.params.year)).then(
        async (rows)=>{
            console.log("returned schedule",rows);
            await res.send(rows);
        }
    ).catch((err)=>{
        console.log("Error in query",err);



    })

});
///////////////////////////////////////////////////////////////
//////////get doctor schedule by year and month
app.get('/api/users/doctor/schedule/:doc_id/:year/:month',(req,res)=>{

    query("SELECT  * FROM user.schedule  where  doc_id = "+parseInt(req.params.doc_id)+" and year = "+parseInt(req.params.year)+" and month = "+parseInt(req.params.month)).then(
        async (rows)=>{
            console.log("returned schedule",rows);
            await res.send(rows);

        }
    ).catch((err)=>{
        console.log("Error in query",err);



    })

});
///////////////////////////////////////////////////////////////
//////////get doctor schedule by year and month and day
app.get('/api/users/doctor/day/schedule/:doc_id',(req,res)=>{
    const year=moment(req.body.date,'YYYY-MM-DD').format('YYYY');
    const month=moment(req.body.date,'YYYY-MM-DD').format('MM');
    const day=moment(req.body.date,'YYYY-MM-DD').format('DD');
    const doctor_id=parseInt(req.params.doc_id);
    const sql="SELECT  * FROM user.schedule  where  doc_id = "+doctor_id+" and year = "+year+" and month = "+month+" and day = "+day;
    console.log("year",year,"month",month,"day",day);
    query(sql).then(
        async (rows)=>{
            console.log("returned schedule",rows);
            await res.send(rows);

        }
    ).catch((err)=>{
        console.log("Error in query",err);



    })

});
///////////////////////////////////////////////////////////////
//////////get Schedule slots
app.get('/api/users/doctor/slots/:schedule_id',(req,res)=>{

    query("SELECT  * FROM user.Appointments where  schedule_id = "+parseInt(req.params.schedule_id)).then(
        async (rows)=>{
            rows.forEach(row=>{console.log("slot booking state",row.booked[0])});
            // console.log("returned schedule slots",rows);
            await res.send(rows);


        }
    ).catch((err)=>{
        console.log("Error in query",err);



    })

});
///////////////////////////////////////////////////////////////
//////////get patient schedule
app.get('/api/users/patient/schedule/:patient_id',(req,res)=>{
    const sql="SELECT Appointments.id, Appointments.patient_id, Appointments.start_time,Appointments.end_time," +
        "Appointments.schedule_id,schedule.year,schedule.month,schedule.day,schedule.slot_duration,schedule.doc_id " +
        "FROM ((user.Appointments INNER JOIN user.schedule ON schedule.id = Appointments.schedule_id))" +
        "where patient_id= ";

    query(sql+req.params.patient_id).then(
        async (rows)=>{
            let results=[];
            console.log("returned schedule",rows);
            rows.forEach(Appointment=>{
                const result={
                    appointment_id:Appointment.id,
                    schedule_id:Appointment.schedule_id,
                    patient_id:Appointment.patient_id,
                    doctor_id:Appointment.doc_id,
                    date:moment((Appointment.year+"-"+Appointment.month+"-"+Appointment.day),'YYYY-MM-DD').format('YYYY-MM-DD'),
                    start_time:Appointment.start_time,
                    end_time:Appointment.end_time,
                    slot_duration: Appointment.slot_duration
                };
                results.push(result);
                console.log("results",results);});
            await res.send(results);
        }
    ).catch((err)=>{
        console.log("Error in query",err);



    })

});
////////////////////////////////////////////////
//////////get doctor free slots by day
app.post('/api/users/doctor/day/slots/:doctor_id',(req,res)=>{
    const sql="SELECT Appointments.id, Appointments.start_time,Appointments.end_time," +
        "Appointments.schedule_id,schedule.year,schedule.month,schedule.day,schedule.slot_duration,schedule.doc_id " +
        "FROM ((user.Appointments INNER JOIN user.schedule ON schedule.id = Appointments.schedule_id))" +
        "where schedule.doc_id= ? and Appointments.booked=0 and schedule.year= ? and schedule.month= ? and schedule.day= ? ";
    const year=moment(req.body.date,'YYYY-MM-DD').format('YYYY');
    const month=moment(req.body.date,'YYYY-MM-DD').format('MM');
    const day=moment(req.body.date,'YYYY-MM-DD').format('DD');
    const doctor_id=parseInt(req.params.doctor_id);
    query(sql,[doctor_id,year,month,day]).then(
        async (rows)=>{
            let results=[];
            console.log("returned schedule",rows);
            rows.forEach(Appointment=>{
                const result={
                    slot_id:Appointment.id,
                    schedule_id:Appointment.schedule_id,
                    doctor_id:Appointment.doc_id,
                    date:moment((Appointment.year+"-"+Appointment.month+"-"+Appointment.day),'YYYY-MM-DD').format('YYYY-MM-DD'),
                    start_time:Appointment.start_time,
                    end_time:Appointment.end_time,
                    slot_duration: Appointment.slot_duration
                };
                results.push(result);
                console.log("results",results);});
            await res.send(results);
        }
    ).catch((err)=>{
        console.log("Error in query",err);



    })

});
/////////////////////////////////////////////
//get doctor free slots only
app.get('/api/users/doctor/free/slots/:doc_id',(req,res)=>{
    const sql= "SELECT Appointments.id, Appointments.start_time,Appointments.end_time," +
        "Appointments.schedule_id,schedule.doc_id,schedule.slot_duration,schedule.year,schedule.month,schedule.day FROM ((user.Appointments INNER JOIN user.schedule ON schedule.id = Appointments.schedule_id))" +
        " where schedule.doc_id = ? and Appointments.booked=0";
    let results=[];
    query(sql,parseInt(req.params.doc_id)).then(
        async (rows)=>{
            rows.forEach(async Appointment=>{
                const result={
                    slot_id:Appointment.id,
                    schedule_id:Appointment.schedule_id,
                    doctor_id:Appointment.doc_id,
                    date:moment((Appointment.year+"-"+Appointment.month+"-"+Appointment.day),'YYYY-MM-DD').format('YYYY-MM-DD'),
                    start_time:Appointment.start_time,
                    end_time:Appointment.end_time,
                    slot_duration: Appointment.slot_duration
                };
                results.push(result);
                console.log("results",results);});
            await res.send(results);
                })
        .catch((err)=>{
        console.log("Error in query",err);


    });


        }
    );


/// patient book appointment
app.put('/api/user/patient/appointment/:patient_id',(req,res)=>{
    const slot_id= parseInt(req.body.slot_id);
    const patient_id=parseInt(req.params.patient_id);
    console.log("req.body",req.body);
    console.log("id ",slot_id);
    const sql= "UPDATE user.Appointments Set  booked = ?, patient_id= ?  Where id = ?";
    query(sql,[1,patient_id,slot_id]).then(
        async (response)=>{
            console.log("returned response from booking appointment",response.changedRows);
            await res.send(response);

        }).catch((err)=>{
        console.log("Error in query",err);
        res.send(err);



    });


});
//////////////////////////////////////////////////////////////////////////////////////////
///Online Sessions

// so you can get or extract the request body parameters
app.use(express.json());


app.post('/token', (req, res) => {
    const sessionId = req.body.sessionId;
    const expireTime = req.body.expireTime;

    console.log(sessionId, expireTime);

    if(sessionId && expireTime)
    {

        var tokenOptions = {};
        tokenOptions.role = "publisher";
        tokenOptions.expireTime = (new Date().getTime() / 1000)+(expireTime*60);

        // Generate a token.
        res.json({"token":opentok.generateToken(sessionId, tokenOptions)});
    }
    else
    {
        res.status(404).send("Please Provide Session Id and expiration Time");
    }

});

// time setting
/**
 * @return {string}
 */
function GetDate(){
    var today = new Date();
    var day = today.getDate() + "";
    var month = (today.getMonth() + 1) + "";
    var year = today.getFullYear() + "";
    var hour = today.getHours() ;
    console.log("hour",typeof (hour));
    var ampm = hour >= 12 ? 'PM' : 'AM';
    // hour = hour % 12;
    // hour = hour ? hour : 12; // the hour '0' should be '12'
    hour=hour + ""; //final hour form
    console.log("hours after modification",hour);
    var minutes = today.getMinutes() + "";
    var seconds = today.getSeconds() + "";
    day = checkZero(day);
    month = checkZero(month);
    year = checkZero(year);
    hour = checkZero(hour);
    console.log("hour after zero",hour);
    minutes = checkZero(minutes);
    seconds = checkZero(seconds);
    let formateddate=(day + "/" + month + "/" + year + " " + hour + ":" + minutes + ":" + seconds +" "+ampm);
    console.log(day + "/" + month + "/" + year + " " + hour + ":" + minutes + ":" + seconds+ampm);
    let newDataTime=hour12(formateddate.toString());
    console.log('12hour date time ',newDataTime);
    return formateddate.toString()

}
function checkZero(data){
    console.log("Check zero");
    console.log("data",data,'length',data.length);
    if(data.length === 1){
        data = "0" + data;
    }
    return data;
}

function hour12(datetime24) {
    console.log('[11]',parseInt(datetime24[11]));
    console.log('[12]',parseInt(datetime24[12]));
    hourInt=parseInt(datetime24[11])*10+parseInt(datetime24[12]);
    hourInt = hourInt % 12;
    hourInt = hourInt ? hourInt : 12; // the hour '0' should be '12'
    hourInt=hourInt+ "";
    hourInt=checkZero(hourInt);
    console.log('hour int',hourInt);
    let start=datetime24.slice(0,10);
    let end=datetime24.slice(13,22);
    console.log('start',start);
    console.log('end',end);
    let newDateTime=start+' '+ hourInt.toString()+end;
    console.log('new dateTime',newDateTime);
    return newDateTime;



}

async function intervals(startString, endString,interval) {
    var start = moment(startString, 'hh:mm A');
    var end = moment(endString, 'hh:mm A');
    console.log('start',start);
    console.log('end',end);
    // round starting minutes up to nearest 15 (12 --> 15, 17 --> 30)
    // note that 59 will round up to 60, and moment.js handles that correctly
    // start.minutes(Math.ceil(start.minutes() / interval) * interval);
    let result = [];
    let current = moment(start);
    for (let i=0;current <= end;i++) {
        result.push(current.format('hh:mm A'));
        if(i%2!==0){
            current.add(5,'minutes');
        }
        else {
            current.add(interval, 'minutes');
        }

    }

    return result;
}



//
// function CreateSlots(start,end){
//     const slotDuration=15;
//     const restTime=10;
//     let slots=[];
//     let numOfSlots=Math.floor(((end-start)*60)/(slotDuration+restTime));
//     console.log("number of slots",numOfSlots);
//     let startOffset=0;
//     let endOffset=0;
//     let formatStart=(start+":"+startOffset);
//     let formatEnd="";
//     let flag=false;
//     for(let i=0;i<=numOfSlots;i++){
//         ////////////////create new end
//           endOffset=startOffset+15;
//         if (Math.floor(endOffset/60)>0){
//             endOffset=endOffset%60;
//             if(!flag){
//                 start=start+1;
//                 flag=true;
//             }
//         }
//         formatEnd=(start+":"+endOffset);
//         let formateddate=( formatStart+ " to " + formatEnd );
//         console.log(formateddate);
//         slots.push(formateddate.toString());
//         flag=false;
//         //////////end of iteration
//
//         ///////////////////create new start
//         startOffset=endOffset+10;
//         if(Math.floor(startOffset/60)>0){
//             startOffset=startOffset%60;
//             if(!flag){
//                 start=start+1;
//                 flag=true;
//             }
//         }
//         formatStart=(start + ":" + startOffset);
//
//
//     }
//     return slots;
//
//
//
//
//
// }

//data model of thread
// {

//     "reciever_id":"reciever_id",
//     "msg_subject":"msg_subject",
//     "created_date":"created_date",
//     "is_readed":"is_readed",
//     "sender_name":"sender_name",
//     "reciever_name":"reciever_name",
//     "msg_body":"msg_body"
// }
//date model of reply
// {
//
//
//     "sender_id":"28",
//     "reciever_id":"31",
//     "msg_body":"can i ask ....",
//     "fcm_token":"",
//     "media":""
//
//
// }
// {
//     thread_id:	parseInt( req.params.thread_id),
//         sender_id: parseInt(req.body.sender_id),
//     reciever_id	:parseInt(req.body.reciever_id),
//     msg_body:	req.body.msg_body,
//     created_date: GetDate()
// }

